import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { ApiError } from "../../src/domain/contracts";
import {
	assertOwner,
	authenticate,
	configuredOwner,
	resetAuthCaches,
	testKeySet,
} from "../../worker/auth";
import type { WorkerEnv } from "../../worker/env";
import {
	jsonError,
	jsonOk,
	logSafe,
	queryValue,
	readJsonBody,
	requireOrigin,
} from "../../worker/http";
import { createIdentity } from "./identity";

const remote = vi.hoisted(() => ({ jwks: "", calls: 0 }));
vi.mock("jose", async (load) => {
	const actual = await load<typeof import("jose")>();
	return {
		...actual,
		createRemoteJWKSet: () => {
			remote.calls++;
			return actual.createLocalJWKSet(JSON.parse(remote.jwks));
		},
	};
});
let identity: Awaited<ReturnType<typeof createIdentity>>;
let env: WorkerEnv;
beforeAll(async () => {
	identity = await createIdentity();
	remote.jwks = identity.jwks;
	env = {
		RESOURCE_ENV: "test",
		DEPLOY_REVISION: "test",
		OWNER_SUB: "rhino-local-owner",
		ACCESS_ISSUER: "https://nocoo.cloudflareaccess.com",
		ACCESS_AUD: "rhino-test",
		TEST_ACCESS_JWKS: identity.jwks,
		APP_ORIGIN: "http://127.0.0.1",
		DB: {} as D1Database,
		ASSETS: {} as Fetcher,
	};
});
afterEach(() => {
	vi.unstubAllGlobals();
	resetAuthCaches();
});
const request = (token?: string) =>
	new Request("http://127.0.0.1/api/live", {
		headers: token ? { "Cf-Access-Jwt-Assertion": token } : {},
	});
it("enforces synthetic claims and single owner without using production test keys", async () => {
	expect(await authenticate(request(identity.tokens.owner), env)).toEqual({
		sub: "rhino-local-owner",
		mode: "access",
		email: null,
	});
	expect(await authenticate(request(), { ...env, RESOURCE_ENV: "local" })).toEqual({
		sub: "rhino-local-owner",
		mode: "local",
		email: null,
	});
	expect(
		await authenticate(request(await identity.token({ email: "synthetic@example.test" })), env),
	).toMatchObject({ email: "synthetic@example.test" });
	await expect(authenticate(request(), env)).rejects.toMatchObject({ status: 401 });
	for (const [key, token] of Object.entries(identity.tokens))
		if (key !== "owner" && key !== "rotated")
			await expect(authenticate(request(token), env)).rejects.toMatchObject({ status: 403 });
	await expect(
		authenticate(request(await identity.token({ subject: "" })), env),
	).rejects.toMatchObject({ status: 401 });
	await expect(
		authenticate(request(identity.tokens.owner), { ...env, ACCESS_AUD: "" }),
	).rejects.toMatchObject({ status: 500 });
	await expect(
		authenticate(request(identity.tokens.owner), { ...env, ACCESS_ISSUER: "" }),
	).rejects.toMatchObject({ status: 500 });
	expect(() => configuredOwner({ ...env, OWNER_SUB: " " })).toThrow("Owner identity");
	expect(() => assertOwner("other", env)).toThrow("not the owner");
	await expect(
		authenticate(request(), { ...env, RESOURCE_ENV: "unknown" as WorkerEnv["RESOURCE_ENV"] }),
	).rejects.toMatchObject({ status: 500 });
});
it("selects and caches production issuer keys, ignoring synthetic test override", async () => {
	resetAuthCaches();
	remote.calls = 0;
	const production = {
		...env,
		RESOURCE_ENV: "production" as const,
		TEST_ACCESS_JWKS: "invalid-test-config",
	};
	await authenticate(request(identity.tokens.owner), production);
	await authenticate(request(identity.tokens.rotated), production);
	expect(remote.calls).toBe(1);
	const issuer = "https://new-team.example.test/";
	await authenticate(request(await identity.token({ issuer })), {
		...production,
		ACCESS_ISSUER: issuer,
	});
	expect(remote.calls).toBe(2);
	await expect(
		authenticate(request(identity.tokens.owner), { ...production, OWNER_SUB: "" }),
	).rejects.toMatchObject({ code: "owner_not_configured" });
});
it("fails closed on absent or malformed test JWKS", async () => {
	for (const jwks of ["", "{", "{}", '{"keys":null}', "https://outside.example.test/keys"])
		await expect(testKeySet({ ...env, TEST_ACCESS_JWKS: jwks })).rejects.toMatchObject({
			status: 500,
		});
	await expect(testKeySet({ ...env, RESOURCE_ENV: "production" })).rejects.toMatchObject({
		status: 500,
	});
});
it("handles bounded streaming JSON, missing bodies and malformed content", async () => {
	const jsonRequest = (body?: string, headers = {}) =>
		new Request("http://127.0.0.1", {
			method: "PUT",
			body,
			headers: { "Content-Type": "application/json", ...headers },
		});
	expect(await readJsonBody(jsonRequest('{"x":1}'))).toEqual({ x: 1 });
	await expect(
		readJsonBody(jsonRequest("{}", { "Content-Length": "300000" })),
	).rejects.toMatchObject({ status: 413 });
	await expect(
		readJsonBody(jsonRequest("too long", { "Content-Length": "garbage" }), 2),
	).rejects.toMatchObject({ status: 413 });
	await expect(
		readJsonBody(new Request("http://127.0.0.1", { method: "PUT", body: "{}" })),
	).rejects.toMatchObject({ status: 400 });
	await expect(readJsonBody(jsonRequest())).rejects.toMatchObject({ status: 400 });
	await expect(readJsonBody(jsonRequest("{"))).rejects.toMatchObject({ status: 400 });
	await expect(
		readJsonBody(jsonRequest("{}", { "Content-Type": "text/plain" })),
	).rejects.toMatchObject({ status: 400 });
	const encoded = new TextEncoder();
	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(encoded.encode('{"'));
			controller.enqueue(encoded.encode('x":1}'));
			controller.close();
		},
	});
	expect(
		await readJsonBody(
			new Request("http://127.0.0.1", {
				method: "PUT",
				body: stream,
				headers: { "Content-Type": "application/json" },
				duplex: "half",
			} as RequestInit),
		),
	).toEqual({ x: 1 });
});
it("does not cache sensitive JSON and only logs explicit safe metadata", async () => {
	expect(await jsonOk({ a: 1 }, 201).json()).toEqual({ data: { a: 1 } });
	expect(jsonOk(null).headers.get("cache-control")).toBe("no-store");
	expect(jsonError(new ApiError(409, "conflict", "Stale")).status).toBe(409);
	const origin = "http://127.0.0.1";
	requireOrigin(new Request(origin, { headers: { Origin: origin } }), origin);
	expect(() => requireOrigin(request(), origin)).toThrow();
	expect(() =>
		requireOrigin(
			new Request(origin, { headers: { Origin: origin, "Sec-Fetch-Site": "cross-site" } }),
			origin,
		),
	).toThrow();
	expect(queryValue(new URL(`${origin}?q=ok`), "q")).toBe("ok");
	expect(queryValue(new URL(origin), "q")).toBeUndefined();
	const spy = vi.spyOn(console, "log").mockImplementation(() => {});
	const entry = { requestId: "synthetic", method: "GET", route: "/api/live", status: 200, ms: 1 };
	logSafe(entry);
	expect(spy).toHaveBeenCalledWith(JSON.stringify(entry));
	spy.mockRestore();
});
