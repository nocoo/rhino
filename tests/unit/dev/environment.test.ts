import { once } from "node:events";
import { createServer, type IncomingHttpHeaders, request } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createEnvironmentLayer,
	type EnvironmentDescriptor,
	isMode,
	readProductionAccessToken,
	rhinoEnvironments,
} from "../../../dev/environment.ts";

const mocks = vi.hoisted(() => ({
	exec: vi.fn(),
	cleanup: vi.fn(),
	start: vi.fn(),
	upstream: vi.fn(),
}));

vi.mock("../../../tests/helpers/isolation.ts", () => ({ cleanupDatabase: mocks.cleanup }));

vi.mock("node:child_process", async (load) => {
	const actual = await load<typeof import("node:child_process")>();
	return { ...actual, execFileSync: mocks.exec };
});

type Layer = ReturnType<typeof createEnvironmentLayer>;
type Child = {
	instanceId: string;
	url: string;
	token: ReturnType<typeof vi.fn>;
	stop: ReturnType<typeof vi.fn>;
};

const servers: Array<{ url: string; close: () => Promise<void>; layer: Layer }> = [];
let sequence = 0;

function child(): Child {
	sequence += 1;
	return {
		instanceId: `e2e-${sequence}`,
		url: `http://127.0.0.1:${43000 + sequence}`,
		token: vi.fn().mockResolvedValue("signed-fixture-jwt"),
		stop: vi.fn().mockResolvedValue(undefined),
	};
}

async function start(options: Parameters<typeof createEnvironmentLayer>[0] = { port: 0 }) {
	const layer = createEnvironmentLayer({
		startE2E: mocks.start,
		prodToken: mocks.exec,
		...options,
		port: 0,
	});
	const server = createServer((req, res) => {
		layer.middleware(req, res, () => {
			const incoming = req as typeof req & { originalUrl?: string };
			if (incoming.originalUrl) incoming.url = incoming.originalUrl;
			if ((req.url ?? "").startsWith("/api/")) {
				res.writeHead(200, {
					"content-type": "application/json",
					"cache-control": "no-store",
				});
				res.end(JSON.stringify({ data: { ok: true, url: req.url } }));
				return;
			}
			res.writeHead(200, { "content-type": "text/html" });
			res.end("<html>app</html>");
		});
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("No test port");
	layer.setPort(address.port);
	const url = `http://127.0.0.1:${address.port}`;
	const handle = {
		url,
		layer,
		close: async () => {
			await layer.close().catch(() => {});
			server.closeAllConnections();
			await new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve())),
			);
		},
	};
	servers.push(handle);
	return handle;
}

function http(
	url: string,
	options: {
		method?: string;
		headers?: Record<string, string | string[] | undefined>;
		body?: string;
		onData?: (chunk: Buffer) => void;
	} = {},
) {
	return new Promise<{
		status: number;
		headers: IncomingHttpHeaders;
		body: string;
		json: () => EnvironmentDescriptor & { error?: string; data?: { url?: string } };
	}>((resolve, reject) => {
		const req = request(
			url,
			{ method: options.method ?? "GET", headers: options.headers },
			(res) => {
				const chunks: Buffer[] = [];
				res.on("data", (chunk: Buffer) => {
					chunks.push(chunk);
					options.onData?.(chunk);
				});
				res.on("error", reject);
				res.on("end", () => {
					const body = Buffer.concat(chunks).toString();
					resolve({
						status: res.statusCode ?? 0,
						headers: res.headers,
						body,
						json: () => JSON.parse(body),
					});
				});
			},
		);
		req.setTimeout(3000, () => req.destroy(new Error("Gateway test request timed out")));
		req.on("error", reject);
		req.end(options.body);
	});
}

function select(
	server: Awaited<ReturnType<typeof start>>,
	mode: string,
	instanceId = server.layer.descriptor().instanceId,
) {
	return http(`${server.url}/__local/environment/select`, {
		method: "POST",
		headers: {
			origin: server.url,
			"content-type": "application/json",
			"x-rhino-local-csrf": server.layer.descriptor().csrfToken,
		},
		body: JSON.stringify({ mode, instanceId }),
	});
}

function api(
	server: Awaited<ReturnType<typeof start>>,
	path = "/api/live",
	headers: Record<string, string> = {},
) {
	return http(`${server.url}/__local/instances/${server.layer.descriptor().instanceId}${path}`, {
		headers,
	});
}

afterEach(async () => {
	for (const server of servers.splice(0)) await server.close();
	vi.unstubAllGlobals();
	vi.resetAllMocks();
	sequence = 0;
});

describe("descriptor and authorization", () => {
	it("boots Local with a live instance and rejects invalid or stale selection", async () => {
		const server = await start();
		const response = await http(`${server.url}/__local/environment`);
		expect(response.status).toBe(200);
		expect(response.headers["cache-control"]).toBe("no-store");
		expect(response.json()).toEqual({
			local: true,
			mode: "local",
			locked: false,
			automated: false,
			instanceId: expect.any(String),
			csrfToken: expect.any(String),
		});
		expect(isMode("local")).toBe(true);
		expect(isMode("mock")).toBe(false);
		for (const mode of ["invalid", "demo", "http://elsewhere.test"]) {
			expect((await select(server, mode)).status).toBe(409);
		}
		expect((await select(server, "e2e", "foreign")).status).toBe(409);
		expect((await select(server, "local")).json()).toMatchObject({ mode: "local" });
		expect(mocks.start).not.toHaveBeenCalled();
		expect(mocks.exec).not.toHaveBeenCalled();
	});

	it("Host, Origin, cross-site and CSRF checks fail before runtime or credentials", async () => {
		const server = await start();
		for (const headers of [
			{ host: "attacker.test" },
			{ origin: "https://attacker.test" },
			{ "sec-fetch-site": "cross-site" },
		]) {
			expect((await http(`${server.url}/__local/environment`, { headers })).status).toBe(403);
		}
		for (const headers of [
			{},
			{ origin: server.url },
			{ origin: server.url, "x-rhino-local-csrf": "wrong" },
			{
				origin: server.url,
				"x-rhino-local-csrf": "x".repeat(server.layer.descriptor().csrfToken.length),
			},
			{ "x-rhino-local-csrf": server.layer.descriptor().csrfToken },
		]) {
			expect(
				(
					await http(`${server.url}/__local/environment/select`, {
						method: "POST",
						headers,
						body: '{"mode":"e2e","instanceId":null}',
					})
				).status,
			).toBe(403);
		}
		expect((await http(`${server.url}/__local/environment/select`)).status).toBe(403);
		expect(
			(
				await http(`${server.url}/__local/environment`, {
					headers: { host: "rhino.dev.hexly.ai", origin: "https://rhino.dev.hexly.ai" },
				})
			).status,
		).toBe(200);
		const port = new URL(server.url).port;
		expect(
			(
				await http(`${server.url}/__local/environment`, {
					headers: { host: `localhost:${port}`, origin: `http://localhost:${port}` },
				})
			).status,
		).toBe(200);
		expect(mocks.start).not.toHaveBeenCalled();
		expect(mocks.exec).not.toHaveBeenCalled();
	});

	it("bad and oversized selection bodies fail without switching", async () => {
		const server = await start();
		const original = server.layer.descriptor();
		for (const body of ["{bad json", "x".repeat(256 * 1024 + 1)]) {
			const response = await http(`${server.url}/__local/environment/select`, {
				method: "POST",
				headers: {
					origin: server.url,
					"content-type": "application/json",
					"x-rhino-local-csrf": original.csrfToken,
				},
				body,
			});
			expect(response.status).toBeGreaterThanOrEqual(400);
		}
		expect(server.layer.descriptor()).toEqual(original);
		expect(
			(
				await http(`${server.url}/__local/environment/select`, {
					method: "POST",
					headers: {
						origin: server.url,
						"content-type": "application/json",
						"x-rhino-local-csrf": original.csrfToken,
					},
					body: "null",
				})
			).status,
		).toBe(400);
		expect(mocks.start).not.toHaveBeenCalled();
	});

	it("interactive Local rewrites captured instance API onto this process and rejects bare /api", async () => {
		const server = await start();
		expect((await http(`${server.url}/api/live`)).status).toBe(404);
		expect((await http(`${server.url}/`)).body).toBe("<html>app</html>");
		const response = await http(
			`${server.url}/__local/instances/${server.layer.descriptor().instanceId}/api/live?x=1`,
		);
		expect(response.status).toBe(200);
		expect(response.json().data?.url).toBe("/api/live?x=1");
		expect((await http(`${server.url}/__local/instances/absent/api/live`)).status).toBe(409);
		expect((await http(`${server.url}/__local/other`)).status).toBe(404);
		expect((await http(`${server.url}/cdn-cgi/local/explorer`)).status).toBe(404);
		expect((await http(`${server.url}/cdn-cgi/local/explorer/api/d1/database`)).status).toBe(404);
		expect(mocks.upstream).not.toHaveBeenCalled();
	});

	it("automated E2E is locked, keeps the direct /api lane, and never calls cloudflared", async () => {
		const server = await start({ port: 0, automated: true });
		expect((await http(`${server.url}/__local/environment`)).json()).toMatchObject({
			local: true,
			mode: "e2e",
			locked: true,
			automated: true,
		});
		expect((await http(`${server.url}/api/live`)).json().data?.url).toBe("/api/live");
		expect(
			(
				await http(`${server.url}/api/live`, {
					headers: { origin: "https://attacker.test" },
				})
			).json().data?.url,
		).toBe("/api/live");
		expect((await api(server)).json().data?.url).toBe("/api/live");
		expect((await http(`${server.url}/cdn-cgi/local/explorer/api/d1/database`)).status).toBe(404);
		for (const mode of ["local", "prod"]) expect((await select(server, mode)).status).toBe(409);
		expect((await select(server, "e2e")).status).toBe(200);
		expect(mocks.start).not.toHaveBeenCalled();
		expect(mocks.exec).not.toHaveBeenCalled();
	});
});

describe("selection races and captured targets", () => {
	it("can leave and reenter a fresh E2E child and retires the previous instance", async () => {
		mocks.start.mockImplementation(async () => child());
		const server = await start();
		const localId = server.layer.descriptor().instanceId;
		const first = await select(server, "e2e");
		expect(first.json()).toMatchObject({ mode: "e2e", locked: false });
		expect(first.json().instanceId).toBe("e2e-1");
		expect((await select(server, "e2e", localId)).status).toBe(409);
		expect((await http(`${server.url}/__local/instances/${localId}/api/live`)).status).toBe(409);
		const runtime = (await mocks.start.mock.results[0]?.value) as Child;
		expect((await select(server, "local")).json()).toMatchObject({ mode: "local" });
		expect(runtime.stop).toHaveBeenCalledOnce();
		expect(
			(await http(`${server.url}/__local/instances/${runtime.instanceId}/api/live`)).status,
		).toBe(409);
		const again = await select(server, "e2e");
		expect(again.json().instanceId).toBe("e2e-2");
		expect(again.json().instanceId).not.toBe(runtime.instanceId);
	});

	it("concurrent selections cannot race and a failed child leaves the original target", async () => {
		const server = await start();
		const original = server.layer.descriptor();
		mocks.start.mockRejectedValueOnce(new Error("secret-child-log"));
		const failed = await select(server, "e2e");
		expect(failed.status).toBe(503);
		expect(failed.body).not.toContain("secret-child-log");
		expect(failed.json().error).toBe("Local environment unavailable");
		expect(server.layer.descriptor()).toEqual(original);
		let finish!: (value: Child) => void;
		mocks.start.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		const switching = select(server, "e2e");
		await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
		expect((await select(server, "prod")).status).toBe(503);
		expect((await http(`${server.url}/__local/environment`)).json()).toEqual(original);
		finish(child());
		expect((await switching).status).toBe(200);
	});

	it("failed old E2E cleanup keeps that instance and a late child is still stopped", async () => {
		const previous = child();
		const candidate = child();
		mocks.start.mockResolvedValueOnce(previous);
		const server = await start();
		await select(server, "e2e");
		const original = server.layer.descriptor();
		let rejectStop!: (reason: Error) => void;
		previous.stop.mockImplementationOnce(
			() =>
				new Promise((_resolve, reject) => {
					rejectStop = reject;
				}),
		);
		const switching = select(server, "local");
		await vi.waitFor(() => expect(rejectStop).toBeTypeOf("function"));
		expect((await http(`${server.url}/__local/environment`)).json()).toEqual(original);
		rejectStop(new Error("D1 ownership marker mismatch"));
		expect((await switching).status).toBe(503);
		expect(server.layer.descriptor()).toEqual(original);
		previous.stop.mockResolvedValue(undefined);
		expect((await select(server, "local")).status).toBe(200);
		let finish!: (value: Child) => void;
		mocks.start.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		previous.stop.mockResolvedValue(undefined);
		const reopen = select(server, "e2e");
		await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
		const closing = server.layer.close();
		finish(candidate);
		await closing;
		await reopen;
		expect(candidate.stop).toHaveBeenCalledOnce();
	});

	it("a captured Local mutation never follows a later Prod target", async () => {
		mocks.exec.mockReturnValue("production-jwt");
		const server = await start();
		const pending = http(
			`${server.url}/__local/instances/${server.layer.descriptor().instanceId}/api/profile`,
			{ method: "PUT", headers: { origin: server.url }, body: '{"name":"Original"}' },
		);
		expect((await select(server, "prod")).status).toBe(200);
		expect((await pending).json().data?.url).toBe("/api/profile");
		expect(mocks.upstream).not.toHaveBeenCalled();
	});

	it("failed Prod sign-in keeps the previous target", async () => {
		mocks.start.mockResolvedValueOnce(child());
		const server = await start();
		await select(server, "e2e");
		const original = server.layer.descriptor();
		const runtime = (await mocks.start.mock.results[0]?.value) as Child;
		mocks.exec.mockImplementation(() => {
			throw new Error("cloudflared missing");
		});
		const denied = await select(server, "prod");
		expect(denied.status).toBe(401);
		expect(denied.json().error).toBe("Production sign-in required");
		expect(denied.body).not.toContain("cloudflared");
		expect(server.layer.descriptor()).toEqual(original);
		expect(runtime.stop).not.toHaveBeenCalled();
	});

	it("a captured E2E request keeps the original child after switching to Prod", async () => {
		vi.stubGlobal("fetch", mocks.upstream);
		mocks.upstream.mockImplementation(async () => Response.json({ ok: true }));
		const runtime = child();
		mocks.start.mockResolvedValueOnce(runtime);
		const server = await start();
		await select(server, "e2e");
		let issue!: (token: string) => void;
		runtime.token.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					issue = resolve;
				}),
		);
		const pending = api(server);
		await vi.waitFor(() => expect(issue).toBeTypeOf("function"));
		mocks.exec.mockReturnValue("production-jwt");
		expect((await select(server, "prod")).status).toBe(200);
		issue("original-signed-jwt");
		expect((await pending).status).toBe(200);
		expect(mocks.upstream.mock.lastCall?.[0]).toBe("http://127.0.0.1:43001/api/live");
	});
});

describe("child and production transport", () => {
	it("preserves empty production responses and refuses unexpected binary content", async () => {
		vi.stubGlobal("fetch", mocks.upstream);
		mocks.exec.mockReturnValue("production-jwt");
		const server = await start();
		await select(server, "prod");
		for (const status of [204, 304]) {
			mocks.upstream.mockResolvedValueOnce(new Response(null, { status }));
			expect((await api(server)).status).toBe(status);
		}
		mocks.upstream.mockResolvedValueOnce(new Response(new Uint8Array([1, 2])));
		expect((await api(server)).status).toBe(503);
	});

	it("keeps failed marker cleanup retryable and rejects requests after close", async () => {
		const runtime = child();
		mocks.start.mockResolvedValueOnce(runtime);
		const server = await start();
		await select(server, "e2e");
		runtime.stop.mockRejectedValueOnce(new Error("wrong marker"));
		await expect(server.layer.close()).rejects.toThrow("cleanup failed");
		expect((await http(`${server.url}/__local/environment`)).status).toBe(503);
		await server.layer.close();
		expect(runtime.stop).toHaveBeenCalledTimes(2);
	});
	it("forwards E2E method, body and query with signed identity and strips credentials", async () => {
		vi.stubGlobal("fetch", mocks.upstream);
		mocks.upstream.mockResolvedValueOnce(
			new Response("saved", {
				status: 201,
				headers: { "set-cookie": "secret=private", "content-length": "5", "x-result": "accepted" },
			}),
		);
		mocks.start.mockResolvedValueOnce(child());
		const server = await start();
		await select(server, "e2e");
		const response = await http(
			`${server.url}/__local/instances/${server.layer.descriptor().instanceId}/api/profile?q=1`,
			{
				method: "POST",
				headers: {
					origin: server.url,
					cookie: "private-browser",
					authorization: "Bearer client-token",
					"cf-access-jwt-assertion": "client-jwt",
					"x-test-tenant": "other",
					"x-rhino-local-csrf": "leak",
					"x-list": ["one", "two"],
					"content-type": "application/json",
				},
				body: '{"name":"Research"}',
			},
		);
		expect(response.status).toBe(201);
		expect(response.body).toBe("saved");
		expect(response.headers["set-cookie"]).toBeUndefined();
		expect(response.headers["x-result"]).toBe("accepted");
		expect(response.headers["cache-control"]).toBe("no-store");
		const [url, init] = mocks.upstream.mock.lastCall as [string, RequestInit];
		expect(url).toBe("http://127.0.0.1:43001/api/profile?q=1");
		expect(init.method).toBe("POST");
		expect(new TextDecoder().decode(init.body as Uint8Array)).toBe('{"name":"Research"}');
		const headers = new Headers(init.headers);
		expect(headers.get("cf-access-jwt-assertion")).toBe("signed-fixture-jwt");
		expect(headers.get("origin")).toBe("http://127.0.0.1:43001");
		for (const name of ["cookie", "authorization", "x-test-tenant", "x-rhino-local-csrf"]) {
			expect(headers.has(name)).toBe(false);
		}
		expect(headers.has("x-list")).toBe(false);
		expect(headers.get("content-type")).toBe("application/json");
	});

	it("production proxy authenticates server-side, caches the token, and hides Access pages", async () => {
		vi.stubGlobal("fetch", mocks.upstream);
		mocks.upstream.mockResolvedValue(Response.json({ ok: true }));
		mocks.exec.mockReturnValue("production-jwt");
		const server = await start();
		await select(server, "prod");
		await api(server, "/api/live", { cookie: "attacker", authorization: "Bearer attacker" });
		await api(server);
		expect(mocks.exec).toHaveBeenCalledOnce();
		const [, init] = mocks.upstream.mock.lastCall as [string, RequestInit];
		expect(mocks.upstream.mock.lastCall?.[0]).toBe("https://rhino.hexly.ai/api/live");
		const headers = new Headers(init.headers);
		expect(headers.get("cookie")).toBe("CF_Authorization=production-jwt");
		expect(headers.get("origin")).toBe("https://rhino.hexly.ai");
		expect(headers.get("sec-fetch-site")).toBe("same-origin");
		expect(headers.has("authorization")).toBe(false);
		const expired = createEnvironmentLayer({
			port: 0,
			prodToken: () => {
				throw new Error("Sign-in required");
			},
		});
		expect(expired.descriptor().mode).toBe("local");
		mocks.upstream.mockResolvedValueOnce(
			new Response("<html>Login</html>", { headers: { "content-type": "text/html" } }),
		);
		const html = await api(server);
		expect(html.status).toBe(401);
		expect(html.body).toContain("sign-in required");
		mocks.upstream.mockResolvedValueOnce(
			new Response(null, { status: 302, headers: { location: "https://access.test/login" } }),
		);
		expect((await api(server)).status).toBe(401);
		mocks.upstream.mockResolvedValueOnce(Response.json({ error: "Expired" }, { status: 403 }));
		expect((await api(server)).status).toBe(403);
		mocks.upstream.mockResolvedValueOnce(
			new Response("not-json", { headers: { "content-type": "text/plain" } }),
		);
		expect((await api(server)).status).toBe(503);
		expect((await api(server, "/api/live", { authorization: "Bearer attacker" })).status).toBe(200);
		await http(`${server.url}/__local/instances/${server.layer.descriptor().instanceId}/api/live`, {
			method: "DELETE",
			headers: { origin: server.url },
		});
		expect(mocks.upstream.mock.lastCall?.[1]).toMatchObject({ method: "DELETE" });
	});

	it("missing production token never switches or reaches upstream", async () => {
		vi.stubGlobal("fetch", mocks.upstream);
		mocks.exec.mockReturnValueOnce("");
		const server = await start();
		const original = server.layer.descriptor();
		expect((await select(server, "prod")).status).toBe(401);
		expect(server.layer.descriptor()).toEqual(original);
		expect(mocks.upstream).not.toHaveBeenCalled();
	});

	it("HEAD and empty upstream responses keep semantics, and stream failure leaves the gateway up", async () => {
		vi.stubGlobal("fetch", mocks.upstream);
		mocks.start.mockResolvedValueOnce(child());
		const server = await start();
		await select(server, "e2e");
		mocks.upstream.mockResolvedValueOnce(new Response(null, { status: 204 }));
		expect((await api(server)).status).toBe(204);
		mocks.upstream.mockResolvedValueOnce(new Response(null, { status: 200 }));
		await http(`${server.url}/__local/instances/${server.layer.descriptor().instanceId}/api/live`, {
			method: "HEAD",
		});
		expect(mocks.upstream.mock.lastCall?.[1]).toMatchObject({ method: "HEAD", body: undefined });
		let controller!: ReadableStreamDefaultController<Uint8Array>;
		mocks.upstream.mockResolvedValueOnce(
			new Response(
				new ReadableStream<Uint8Array>({
					start(value) {
						controller = value;
						controller.enqueue(new TextEncoder().encode("partial"));
					},
				}),
			),
		);
		let received = "";
		const streamed = http(
			`${server.url}/__local/instances/${server.layer.descriptor().instanceId}/api/live`,
			{
				onData(chunk) {
					received += chunk.toString();
					controller.error(new Error("Upstream interrupted after headers"));
				},
			},
		);
		await expect(streamed).rejects.toThrow();
		expect(received).toBe("partial");
		mocks.upstream.mockResolvedValueOnce(Response.json({ ok: true }));
		expect((await api(server)).status).toBe(200);
	});
});

describe("plugin wiring and production token helper", () => {
	it("reclaims the isolated child on IPC disconnect, preserving cleanup errors", async () => {
		vi.stubEnv("CLOUDFLARE_ENV", "test");
		vi.stubEnv("RHINO_TEST_STATE", "/tmp/owned");
		vi.stubEnv("RHINO_TEST_CONFIG", "/tmp/owned/wrangler.json");
		vi.stubEnv("RHINO_TEST_RUN_ID", "run-id");
		const send = process.send;
		process.send = vi.fn();
		const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
		try {
			const plugin = rhinoEnvironments();
			const close = vi.fn().mockResolvedValue(undefined);
			const configure = plugin.configureServer;
			if (typeof configure !== "function") throw new Error("configure missing");
			const server = { config: { server: {} }, middlewares: { use: vi.fn() }, close };
			configure.call({} as never, server as never);
			mocks.cleanup.mockResolvedValue(undefined);
			process.emit("disconnect");
			await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
			expect(mocks.cleanup).toHaveBeenCalledWith(
				expect.objectContaining({ state: "/tmp/owned", id: "run-id" }),
			);
			configure.call({} as never, server as never);
			mocks.cleanup.mockRejectedValueOnce(new Error("marker mismatch"));
			process.emit("disconnect");
			await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
			if (typeof plugin.closeServer === "function")
				await plugin.closeServer.call({} as never, {} as never);
			delete process.env.RHINO_TEST_RUN_ID;
			expect(() => configure.call({} as never, server as never)).toThrow("owned E2E state");
		} finally {
			process.send = send;
			exit.mockRestore();
			vi.unstubAllEnvs();
		}
	});
	it("fails closed when CLOUDFLARE_ENV=test lacks state or config", () => {
		const previous = {
			env: process.env.CLOUDFLARE_ENV,
			state: process.env.RHINO_TEST_STATE,
			config: process.env.RHINO_TEST_CONFIG,
		};
		const restore = (
			key: "CLOUDFLARE_ENV" | "RHINO_TEST_STATE" | "RHINO_TEST_CONFIG",
			value?: string,
		) => {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		};
		try {
			process.env.CLOUDFLARE_ENV = "test";
			delete process.env.RHINO_TEST_STATE;
			delete process.env.RHINO_TEST_CONFIG;
			expect(() => rhinoEnvironments()).toThrow("RHINO_TEST_STATE");
			process.env.RHINO_TEST_STATE = "/tmp/rhino-env-test";
			expect(() => rhinoEnvironments()).toThrow("RHINO_TEST_CONFIG");
		} finally {
			restore("CLOUDFLARE_ENV", previous.env);
			restore("RHINO_TEST_STATE", previous.state);
			restore("RHINO_TEST_CONFIG", previous.config);
		}
	});

	it("applies only on serve, enforces pre, and closeServer awaits layer close", async () => {
		const send = process.send;
		process.send = undefined;
		const plugin = rhinoEnvironments();
		expect(plugin.name).toBe("rhino-environments");
		expect(plugin.apply).toBe("serve");
		expect(plugin.enforce).toBe("pre");
		const transform = plugin.transformIndexHtml;
		expect(
			typeof transform === "function" ? transform.call({} as never, "", {} as never) : transform,
		).toEqual([
			{ tag: "script", children: "window.__RHINO_LOCAL__=true", injectTo: "head-prepend" },
		]);
		const uses: Array<(req: unknown, res: unknown, next: unknown) => void> = [];
		const onceClose = vi.fn();
		const previous = process.env.CLOUDFLARE_ENV;
		const previousState = process.env.RHINO_TEST_STATE;
		const previousConfig = process.env.RHINO_TEST_CONFIG;
		process.env.CLOUDFLARE_ENV = "test";
		process.env.RHINO_TEST_STATE = "/tmp/rhino-env-test";
		process.env.RHINO_TEST_CONFIG = "/tmp/rhino-env-test/wrangler.json";
		try {
			const configure = plugin.configureServer;
			if (typeof configure !== "function") throw new Error("configureServer missing");
			configure.call(
				{} as never,
				{
					config: { server: { port: 7057 } },
					middlewares: { use: (fn: (typeof uses)[0]) => uses.push(fn) },
					httpServer: {
						once: onceClose,
						address: () => ({ port: 7057 }),
					},
				} as never,
			);
			const middleware = uses[0];
			if (!middleware) throw new Error("middleware missing");
			const httpServer = createServer((req, res) => middleware(req, res, () => res.end("next")));
			httpServer.listen(0, "127.0.0.1");
			await once(httpServer, "listening");
			const address = httpServer.address();
			if (!address || typeof address === "string") throw new Error("port missing");
			try {
				expect(
					(
						await http(`http://127.0.0.1:${address.port}/__local/environment`, {
							headers: { host: "localhost:7057" },
						})
					).json().mode,
				).toBe("e2e");
			} finally {
				httpServer.closeAllConnections();
				await new Promise<void>((resolve) => httpServer.close(() => resolve()));
			}
			if (typeof plugin.closeServer !== "function") throw new Error("closeServer missing");
			await plugin.closeServer.call({} as never, {} as never);
		} finally {
			process.send = send;
			if (previous) process.env.CLOUDFLARE_ENV = previous;
			else delete process.env.CLOUDFLARE_ENV;
			if (previousState) process.env.RHINO_TEST_STATE = previousState;
			else delete process.env.RHINO_TEST_STATE;
			if (previousConfig) process.env.RHINO_TEST_CONFIG = previousConfig;
			else delete process.env.RHINO_TEST_CONFIG;
		}
		expect(uses).toHaveLength(1);
		expect(onceClose).not.toHaveBeenCalled();
	});

	it("reads a trimmed Access token and refuses a blank cloudflared result", () => {
		mocks.exec.mockReturnValueOnce(" production-jwt \n");
		expect(readProductionAccessToken()).toBe("production-jwt");
		mocks.exec.mockReturnValueOnce("\n");
		expect(() => readProductionAccessToken()).toThrow("Missing credential");
	});
});
