import { spawn } from "node:child_process";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import {
	createServer as createHttpServer,
	type IncomingMessage,
	type Server,
	type ServerResponse,
} from "node:http";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createIdentity } from "../tests/helpers/identity.ts";
import { cleanupDatabase, createTestRun, initializeDatabase } from "../tests/helpers/isolation.ts";
import { run } from "./process.ts";

async function allocatePort(): Promise<number> {
	return new Promise<number>((resolvePort, reject) => {
		const probe = createServer();
		probe.once("error", reject);
		probe.listen(0, "127.0.0.1", () => {
			const address = probe.address();
			if (!address || typeof address === "string") {
				probe.close();
				reject(new Error("No test port"));
				return;
			}
			probe.close(() => resolvePort(address.port));
		});
	});
}

async function readRequestBody(req: IncomingMessage): Promise<Buffer | undefined> {
	const method = req.method ?? "GET";
	if (method === "GET" || method === "HEAD") return undefined;
	const chunks: Buffer[] = [];
	for await (const chunk of req) chunks.push(Buffer.from(chunk));
	return Buffer.concat(chunks);
}

function injectLocalScript(html: string): string {
	const snippet = "<script>window.__RHINO_LOCAL__=true</script>";
	return /<head[^>]*>/i.test(html)
		? html.replace(/<head([^>]*)>/i, `<head$1>${snippet}`)
		: `${snippet}${html}`;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
	res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
	res.end(JSON.stringify(body));
}

function isLocalOriginAllowed(req: IncomingMessage, port: number): boolean {
	const host = req.headers.host;
	const origin = req.headers.origin;
	const allowed =
		host === `127.0.0.1:${port}` || host === `localhost:${port}` || host === "rhino.dev.hexly.ai";
	return (
		allowed &&
		req.headers["sec-fetch-site"] !== "cross-site" &&
		(!origin || origin === `http://${host}` || origin === `https://${host}`)
	);
}

async function startPrebuiltProxy(port: number, workerPort: number): Promise<Server> {
	const instanceId = randomUUID();
	const csrfToken = randomUUID();
	const descriptor = {
		local: true as const,
		mode: "e2e" as const,
		locked: true,
		automated: true,
		instanceId,
		csrfToken,
	};
	const server = createHttpServer((req, res) => {
		void (async () => {
			const url = new URL(req.url ?? "/", "http://local.invalid");
			if (url.pathname.startsWith("/__local/")) {
				if (!isLocalOriginAllowed(req, port)) {
					sendJson(res, 403, { error: "Local origin required" });
					return;
				}
				if (url.pathname === "/__local/environment" && req.method === "GET") {
					sendJson(res, 200, descriptor);
					return;
				}
				if (url.pathname === "/__local/environment/select") {
					const csrf = req.headers["x-rhino-local-csrf"];
					const csrfMatch =
						typeof csrf === "string" &&
						Buffer.byteLength(csrf) === Buffer.byteLength(csrfToken) &&
						timingSafeEqual(Buffer.from(csrf), Buffer.from(csrfToken));
					if (req.method !== "POST" || !csrfMatch || !req.headers.origin) {
						sendJson(res, 403, { error: "Invalid local selection request" });
						return;
					}
					const body = await readRequestBody(req);
					const parsed = JSON.parse((body ?? Buffer.alloc(0)).toString()) as {
						mode?: unknown;
						instanceId?: unknown;
					};
					if (parsed.instanceId !== instanceId) {
						sendJson(res, 409, { error: "Invalid or expired environment instance" });
						return;
					}
					if (parsed.mode !== "e2e") {
						sendJson(res, 409, { error: "E2E is locked until this instance stops" });
						return;
					}
					sendJson(res, 200, descriptor);
					return;
				}
				sendJson(res, 404, { error: "Not found" });
				return;
			}
			await proxyToWorker(req, res, workerPort);
		})().catch(() => {
			if (!res.headersSent) {
				res.writeHead(502, { "content-type": "text/plain" });
				res.end("Prebuilt Worker proxy failed");
			} else {
				res.destroy();
			}
		});
	});
	await new Promise<void>((resolveListen, reject) => {
		server.once("error", reject);
		server.listen(port, "127.0.0.1", () => resolveListen());
	});
	return server;
}

async function proxyToWorker(
	req: IncomingMessage,
	res: ServerResponse,
	workerPort: number,
): Promise<void> {
	const headers = new Headers();
	for (const [key, value] of Object.entries(req.headers)) {
		if (value === undefined) continue;
		if (
			key === "host" ||
			key === "connection" ||
			key === "content-length" ||
			key === "accept-encoding"
		) {
			continue;
		}
		headers.set(key, Array.isArray(value) ? value.join(",") : value);
	}
	const body = await readRequestBody(req);
	const upstream = await fetch(`http://127.0.0.1:${workerPort}${req.url ?? "/"}`, {
		method: req.method ?? "GET",
		headers,
		body: body ? new Uint8Array(body) : undefined,
		redirect: "manual",
		signal: AbortSignal.timeout(30_000),
	});
	res.statusCode = upstream.status;
	const contentType = upstream.headers.get("content-type") ?? "";
	const isHtml = contentType.includes("text/html");
	upstream.headers.forEach((value, name) => {
		if (
			name === "transfer-encoding" ||
			name === "connection" ||
			name === "content-encoding" ||
			name === "content-length"
		) {
			return;
		}
		res.setHeader(name, value);
	});
	if (isHtml) {
		const html = injectLocalScript(await upstream.text());
		res.setHeader("content-length", Buffer.byteLength(html));
		res.end(html);
		return;
	}
	if (upstream.body) {
		await pipeline(Readable.from(upstream.body as AsyncIterable<Uint8Array>), res);
	} else {
		res.end();
	}
}

function writePrebuiltWranglerConfig(test: { state: string; config: string }): string {
	const workerMain = resolve("dist/rhino/index.js");
	const assetsDir = resolve("dist/client");
	if (!existsSync(workerMain) || !existsSync(join(assetsDir, "index.html"))) {
		throw new Error(
			"RHINO_PREBUILT_E2E=1 requires B1 build artifacts in dist/rhino and dist/client",
		);
	}
	const parsed = JSON.parse(readFileSync(test.config, "utf8")) as {
		env: { test: Record<string, unknown> };
	};
	const baseConfig = {
		...parsed.env.test,
		main: workerMain,
		no_bundle: true,
		assets: {
			...(parsed.env.test.assets as Record<string, unknown>),
			directory: assetsDir,
		},
	};
	const prebuiltPath = join(test.state, "wrangler.prebuilt.json");
	writeFileSync(prebuiltPath, JSON.stringify({ ...baseConfig, env: { test: baseConfig } }));
	return prebuiltPath;
}

const tier = process.argv[2];
if (tier !== "l2" && tier !== "l3") throw new Error("Use run-tests.ts l2|l3");
const port = await allocatePort();
const base = `http://127.0.0.1:${port}`;
const identity = await createIdentity();
const test = createTestRun(base, identity.jwks);
const env = { ...test.env, RHINO_TEST_TOKENS: JSON.stringify(identity.tokens) };
const prebuiltE2E = tier === "l3" && process.env.RHINO_PREBUILT_E2E === "1";
mkdirSync(`test-results/${tier}`, { recursive: true });
const log = openSync(`test-results/${tier}/server.log`, "w");
let server: ReturnType<typeof spawn> | undefined;
let proxy: Server | undefined;
let interrupted = false;
const stop = () => {
	interrupted = true;
	if (server?.pid) {
		try {
			process.kill(-server.pid, "SIGTERM");
		} catch {}
	}
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
try {
	await initializeDatabase(test);
	if (prebuiltE2E) {
		const workerPort = await allocatePort();
		const prebuiltConfig = writePrebuiltWranglerConfig(test);
		proxy = await startPrebuiltProxy(port, workerPort);
		server = spawn(
			"node",
			[
				"node_modules/wrangler/bin/wrangler.js",
				"dev",
				"--config",
				prebuiltConfig,
				"--env",
				"test",
				"--no-bundle",
				"--local",
				"--persist-to",
				test.state,
				"--ip",
				"127.0.0.1",
				"--port",
				String(workerPort),
				"--show-interactive-dev-session=false",
			],
			{ env, detached: true, stdio: ["ignore", log, log] },
		);
	} else {
		server = spawn(
			"node",
			[
				"node_modules/vite/bin/vite.js",
				"--host",
				"127.0.0.1",
				"--port",
				String(port),
				"--strictPort",
			],
			{ env, detached: true, stdio: ["ignore", log, log] },
		);
	}
	server.once("error", stop);
	const started = Date.now();
	while (true) {
		if (interrupted || server.exitCode !== null)
			throw new Error(
				`Test Worker exited\n${readFileSync(`test-results/${tier}/server.log`, "utf8")}`,
			);
		try {
			const response = await fetch(`${base}/api/live`, {
				headers: { "Cf-Access-Jwt-Assertion": identity.tokens.owner },
				signal: AbortSignal.timeout(1000),
			});
			if (response.ok) break;
		} catch {}
		if (Date.now() - started > 45_000)
			throw new Error(`Worker startup timeout. See test-results/${tier}/server.log`);
		await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
	}
	console.log(
		`${tier.toUpperCase()}: 本地 Worker ${base}${prebuiltE2E ? " (prebuilt)" : ""}，隔离 D1 ${test.id}`,
	);
	if (tier === "l2") {
		const { nodeFetch } = await import("../tests/helpers/node-fetch.ts");
		for (let attempt = 0; attempt < 5; attempt++) {
			const response = await nodeFetch(`${base}/api/live`, {
				headers: { "Cf-Access-Jwt-Assertion": identity.tokens.owner },
			});
			if (!response.ok) throw new Error(`L2 warmup failed (${response.status})`);
			await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
		}
	}
	await run(
		tier === "l2"
			? ["bun", "test", "./tests/l2", "--sequential", ...process.argv.slice(3)]
			: ["node", "node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(3)],
		{ env, timeout: tier === "l2" ? 120_000 : 900_000 },
	);
	if (interrupted) throw new Error("Test run interrupted");
} finally {
	if (proxy) {
		await new Promise<void>((resolveClose) => proxy?.close(() => resolveClose()));
	}
	if (server?.pid && server.exitCode === null) {
		const exited = new Promise<void>((resolveExit) => server?.once("close", () => resolveExit()));
		try {
			process.kill(-server.pid, "SIGTERM");
		} catch {}
		await Promise.race([exited, new Promise((resolveDelay) => setTimeout(resolveDelay, 3000))]);
		if (server.exitCode === null) {
			try {
				process.kill(-server.pid, "SIGKILL");
			} catch {}
			await exited;
		}
	}
	closeSync(log);
	process.removeListener("SIGINT", stop);
	process.removeListener("SIGTERM", stop);
	await cleanupDatabase(test);
}
