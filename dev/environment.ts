import { execFileSync } from "node:child_process";
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Connect, Plugin } from "vite";
import { MAX_BODY_BYTES } from "../src/domain/contracts.ts";
import { type E2EChild, startE2EChild } from "./e2e-child.ts";

export type Mode = "local" | "e2e" | "prod";
export type EnvironmentDescriptor = {
	local: true;
	mode: Mode;
	locked: boolean;
	automated: boolean;
	instanceId: string;
	csrfToken: string;
};

const PROD_ORIGIN = "https://rhino.hexly.ai";
const CSRF_HEADER = "x-rhino-local-csrf";
const ALLOWED_REQUEST_HEADERS = new Set(["accept", "content-type", "if-none-match"]);
const BLOCKED_RESPONSE_HEADERS = new Set([
	"set-cookie",
	"content-encoding",
	"content-length",
	"transfer-encoding",
	"connection",
]);

type DevRequest = Connect.IncomingMessage;
type Next = (error?: unknown) => void;
type Kind = "inline" | "child" | "prod";
type Target = {
	mode: Mode;
	kind: Kind;
	instanceId: string;
	url: string;
	runtime?: E2EChild;
};

class GatewayError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

export function isMode(value: unknown): value is Mode {
	return value === "local" || value === "e2e" || value === "prod";
}

export function readProductionAccessToken(): string {
	const token = execFileSync("cloudflared", ["access", "token", "--app", PROD_ORIGIN], {
		encoding: "utf8",
		timeout: 5000,
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
	if (!token) throw new Error("Missing credential");
	return token;
}

function json(res: ServerResponse, status: number, body: unknown): void {
	if (res.headersSent) {
		res.destroy();
		return;
	}
	res.writeHead(status, {
		"content-type": "application/json",
		"cache-control": "no-store",
	});
	res.end(JSON.stringify(body));
}

function fail(res: ServerResponse, status: number, error: string): void {
	json(res, status, { error });
}

function publicFail(res: ServerResponse, error: unknown): void {
	if (error instanceof GatewayError) fail(res, error.status, error.message);
	else fail(res, 503, "Local environment unavailable");
}

function allowedHosts(port: number): string[] {
	return ["rhino.dev.hexly.ai", `127.0.0.1:${port}`, `localhost:${port}`];
}

function originMatchesHost(req: DevRequest): boolean {
	const host = req.headers.host;
	const origin = req.headers.origin;
	return !!host && !!origin && (origin === `http://${host}` || origin === `https://${host}`);
}

function localRequest(req: DevRequest, port: number): boolean {
	const host = req.headers.host;
	return (
		!!host &&
		allowedHosts(port).includes(host) &&
		req.headers["sec-fetch-site"] !== "cross-site" &&
		(!req.headers.origin || originMatchesHost(req))
	);
}

function mutationAllowed(req: DevRequest, port: number): boolean {
	return localRequest(req, port) && originMatchesHost(req);
}

async function readBody(req: DevRequest): Promise<Buffer> {
	const declared = req.headers["content-length"];
	if (declared) {
		const length = Number(declared);
		if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
			throw new GatewayError(413, "Request body exceeds 256 KiB");
		}
	}
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const value of req) {
		const chunk = Buffer.from(value);
		size += chunk.length;
		if (size > MAX_BODY_BYTES) {
			req.destroy();
			throw new GatewayError(413, "Request body exceeds 256 KiB");
		}
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
}

function csrfOk(req: DevRequest, csrfToken: string): boolean {
	const csrf = req.headers[CSRF_HEADER];
	return (
		typeof csrf === "string" &&
		Buffer.byteLength(csrf) === Buffer.byteLength(csrfToken) &&
		timingSafeEqual(Buffer.from(csrf), Buffer.from(csrfToken))
	);
}

function copyRequestHeaders(req: DevRequest): Headers {
	const headers = new Headers();
	for (const name of ALLOWED_REQUEST_HEADERS) {
		const value = req.headers[name];
		if (value) headers.set(name, Array.isArray(value) ? value.join(",") : value);
	}
	return headers;
}

async function forward(response: Response, res: ServerResponse): Promise<void> {
	res.statusCode = response.status;
	response.headers.forEach((value, name) => {
		if (!BLOCKED_RESPONSE_HEADERS.has(name)) res.setHeader(name, value);
	});
	res.setHeader("cache-control", "no-store");
	if (response.body) {
		await pipeline(Readable.from(response.body as AsyncIterable<Uint8Array>), res);
	} else res.end();
}

function rejectProductionPayload(response: Response): "auth" | "generic" | null {
	if (response.headers.has("location")) return "auth";
	if (response.status === 204 || response.status === 304) return null;
	const type = response.headers.get("content-type") ?? "";
	if (type.includes("text/html")) return "auth";
	if (!type.includes("application/json")) return "generic";
	return null;
}

export type EnvironmentLayer = {
	middleware: (req: DevRequest, res: ServerResponse, next: Next) => void;
	descriptor: () => EnvironmentDescriptor;
	setPort: (port: number) => void;
	close: () => Promise<void>;
};

export function createEnvironmentLayer(options: {
	port: number;
	automated?: boolean;
	startE2E?: () => Promise<E2EChild>;
	prodToken?: () => string;
	now?: () => number;
}): EnvironmentLayer {
	const automated = !!options.automated;
	const locked = automated;
	const csrfToken = randomUUID();
	const startE2E = options.startE2E ?? startE2EChild;
	const readToken = options.prodToken ?? readProductionAccessToken;
	const now = options.now ?? Date.now;
	let port = options.port;
	let target: Target = {
		mode: automated ? "e2e" : "local",
		kind: "inline",
		instanceId: randomUUID(),
		url: "",
	};
	let selection: Promise<EnvironmentDescriptor> | undefined;
	let closing = false;
	let closed: Promise<void> | undefined;
	const owned = new Set<E2EChild>();
	let prodToken = "";
	let prodTokenExpiry = 0;

	const descriptor = (): EnvironmentDescriptor => ({
		local: true,
		mode: target.mode,
		locked,
		automated,
		instanceId: target.instanceId,
		csrfToken,
	});

	const release = async (runtime: E2EChild | undefined) => {
		if (!runtime) return;
		await runtime.stop();
		owned.delete(runtime);
	};

	const requireProdToken = () => {
		try {
			if (now() >= prodTokenExpiry || !prodToken) {
				prodToken = readToken();
				prodTokenExpiry = now() + 60_000;
			}
			if (!prodToken) throw new Error("missing");
		} catch {
			prodToken = "";
			prodTokenExpiry = 0;
			throw new GatewayError(401, "Production sign-in required");
		}
	};

	const select = async (mode: Mode): Promise<EnvironmentDescriptor> => {
		if (closing) throw new GatewayError(503, "Local environment is shutting down");
		if (locked && mode !== "e2e") {
			throw new GatewayError(409, "E2E is locked until this instance stops");
		}
		if (target.mode === mode) return descriptor();
		if (selection) throw new GatewayError(503, "An environment switch is already in progress");
		selection = (async () => {
			if (mode === "prod") requireProdToken();
			const previous = target;
			const runtime = mode === "e2e" && !automated ? await startE2E() : undefined;
			if (runtime) owned.add(runtime);
			try {
				if (closing) throw new GatewayError(503, "Local environment is shutting down");
				await release(previous.runtime);
				if (closing) throw new GatewayError(503, "Local environment is shutting down");
				target = {
					mode,
					kind: mode === "prod" ? "prod" : runtime ? "child" : "inline",
					instanceId: runtime?.instanceId ?? randomUUID(),
					url: runtime?.url ?? (mode === "prod" ? PROD_ORIGIN : ""),
					runtime,
				};
				if (mode !== "prod") {
					prodToken = "";
					prodTokenExpiry = 0;
				}
				return descriptor();
			} catch (error) {
				await release(runtime);
				throw error;
			}
		})().finally(() => {
			selection = undefined;
		});
		return selection;
	};

	async function proxy(captured: Target, req: DevRequest, apiPath: string, res: ServerResponse) {
		if (automated) throw new GatewayError(403, "Production unavailable");
		const headers = copyRequestHeaders(req);
		if (captured.kind === "prod") {
			requireProdToken();
			headers.set("cookie", `CF_Authorization=${prodToken}`);
			headers.set("origin", PROD_ORIGIN);
			headers.set("sec-fetch-site", "same-origin");
		} else if (captured.runtime) {
			headers.set("Cf-Access-Jwt-Assertion", await captured.runtime.token());
			headers.set("origin", captured.url);
			headers.set("sec-fetch-site", "same-origin");
		}
		const method = req.method ?? "GET";
		const body =
			method === "GET" || method === "HEAD" ? undefined : new Uint8Array(await readBody(req));
		const response = await fetch(`${captured.url}${apiPath}`, {
			method,
			headers,
			body,
			redirect: "manual",
			signal: AbortSignal.timeout(180_000),
		});
		if (captured.kind === "prod") {
			const rejected = rejectProductionPayload(response);
			if (rejected) {
				await response.body?.cancel();
				if (rejected === "auth") {
					prodToken = "";
					prodTokenExpiry = 0;
					throw new GatewayError(401, "Production sign-in required");
				}
				throw new GatewayError(503, "Local environment unavailable");
			}
			if ([401, 403].includes(response.status)) prodTokenExpiry = 0;
		}
		await forward(response, res);
	}

	const middleware = (req: DevRequest, res: ServerResponse, next: Next) => {
		void (async () => {
			const url = new URL(req.url ?? "/", "http://local.invalid");
			if (automated && (url.pathname === "/api" || url.pathname.startsWith("/api/"))) {
				next();
				return;
			}
			if (closing) throw new GatewayError(503, "Local environment is shutting down");
			if (!localRequest(req, port)) throw new GatewayError(403, "Local origin required");
			if (url.pathname === "/__local/environment" && req.method === "GET") {
				json(res, 200, descriptor());
				return;
			}
			if (url.pathname === "/__local/environment/select") {
				if (req.method !== "POST" || !csrfOk(req, csrfToken) || !mutationAllowed(req, port)) {
					throw new GatewayError(403, "Invalid local selection request");
				}
				const contentType = (req.headers["content-type"] ?? "").split(";")[0]?.trim().toLowerCase();
				if (contentType !== "application/json") {
					throw new GatewayError(400, "JSON content type is required");
				}
				let parsed: unknown;
				try {
					parsed = JSON.parse((await readBody(req)).toString());
				} catch (error) {
					if (error instanceof GatewayError) throw error;
					throw new GatewayError(400, "Invalid JSON");
				}
				if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
					throw new GatewayError(400, "Invalid JSON");
				}
				const input = parsed as { mode?: unknown; instanceId?: unknown };
				if (!isMode(input.mode) || input.instanceId !== target.instanceId) {
					throw new GatewayError(409, "Invalid or expired environment instance");
				}
				json(res, 200, await select(input.mode));
				return;
			}
			const match = /^\/__local\/instances\/([^/]+)(\/api\/.*)$/.exec(url.pathname);
			if (match) {
				const captured = target;
				if (match[1] !== captured.instanceId) {
					throw new GatewayError(409, "Environment instance expired. Reload explicitly.");
				}
				if (
					["POST", "PUT", "PATCH", "DELETE"].includes(req.method ?? "") &&
					!mutationAllowed(req, port)
				) {
					throw new GatewayError(403, "Local origin required");
				}
				if (captured.kind === "inline") {
					const rewritten = `${match[2]}${url.search}`;
					req.url = rewritten;
					req.originalUrl = rewritten;
					next();
					return;
				}
				await proxy(captured, req, `${match[2]}${url.search}`, res);
				return;
			}
			if (url.pathname.startsWith("/__local/")) {
				throw new GatewayError(404, "Not found");
			}
			if (
				url.pathname === "/cdn-cgi/local/explorer" ||
				url.pathname.startsWith("/cdn-cgi/local/explorer/")
			) {
				throw new GatewayError(404, "Not found");
			}
			if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
				throw new GatewayError(404, "Not found");
			}
			next();
		})().catch((error: unknown) => {
			if (!res.headersSent) publicFail(res, error);
			else res.destroy();
		});
	};

	const close = () =>
		(closed ??= (async () => {
			closing = true;
			await selection?.catch(() => {});
			const results = await Promise.allSettled([...owned].map((runtime) => release(runtime)));
			const errors = results
				.filter((result) => result.status === "rejected")
				.map((result) => result.reason);
			if (errors.length) throw new AggregateError(errors, "Local environment cleanup failed");
		})().catch((error: unknown) => {
			closed = undefined;
			throw error;
		}));

	return {
		middleware,
		descriptor,
		setPort: (value) => {
			port = value;
		},
		close,
	};
}

export function rhinoEnvironments(): Plugin {
	if (
		process.env.CLOUDFLARE_ENV === "test" &&
		(!process.env.RHINO_TEST_STATE || !process.env.RHINO_TEST_CONFIG)
	) {
		throw new Error("Test environment requires RHINO_TEST_STATE and RHINO_TEST_CONFIG");
	}
	let layer: EnvironmentLayer | undefined;
	return {
		name: "rhino-environments",
		apply: "serve",
		enforce: "pre",
		transformIndexHtml: () => [
			{ tag: "script", children: "window.__RHINO_LOCAL__=true", injectTo: "head-prepend" },
		],
		configureServer(server) {
			const automated =
				process.env.CLOUDFLARE_ENV === "test" && Boolean(process.env.RHINO_TEST_STATE);
			layer = createEnvironmentLayer({
				port: server.config.server.port ?? 7057,
				automated,
			});
			server.middlewares.use((req, res, next) => {
				const address = server.httpServer?.address();
				if (address && typeof address !== "string") layer?.setPort(address.port);
				layer?.middleware(req, res, next);
			});
		},
		async closeServer() {
			await layer?.close();
		},
	};
}
