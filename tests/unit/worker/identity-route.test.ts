import { afterEach, beforeAll, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../../../worker/env";
import { handleApi } from "../../../worker/index";
import { createIdentity } from "../../helpers/identity";

const remoteFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
const origin = "http://127.0.0.1";
let identity: Awaited<ReturnType<typeof createIdentity>>;
let env: WorkerEnv;

beforeAll(async () => {
	identity = await createIdentity();
	env = {
		RESOURCE_ENV: "test",
		DEPLOY_REVISION: "test",
		OWNER_SUB: "rhino-local-owner",
		ACCESS_ISSUER: "https://nocoo.cloudflareaccess.com",
		ACCESS_AUD: "rhino-test",
		TEST_ACCESS_JWKS: identity.jwks,
		APP_ORIGIN: origin,
		DB: {} as D1Database,
		ASSETS: {} as Fetcher,
	} as WorkerEnv;
});

afterEach(() => {
	remoteFetch.mockReset();
	vi.unstubAllGlobals();
});

it("uses only verified JWT email for profile lookup and rejects invalid assertions before fetching", async () => {
	vi.stubGlobal("fetch", remoteFetch);
	remoteFetch.mockResolvedValue(
		Response.json({ name: "Verified Owner", avatar: "https://images.example.test/avatar.webp" }),
	);

	const invalid = new Request(`${origin}/api/identity`, {
		headers: {
			"Cf-Access-Jwt-Assertion": identity.tokens.badSignature,
			"Cf-Access-Authenticated-User-Email": "spoof@example.test",
		},
	});
	await expect(handleApi(invalid, env)).rejects.toMatchObject({ status: 403 });
	expect(remoteFetch).not.toHaveBeenCalled();

	const verifiedEmail = "signed@example.test";
	const valid = new Request(`${origin}/api/identity`, {
		headers: {
			"Cf-Access-Jwt-Assertion": await identity.token({ email: verifiedEmail }),
			"Cf-Access-Authenticated-User-Email": "spoof@example.test",
		},
	});
	const response = await handleApi(valid, env);
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({
		data: { name: "Verified Owner", avatar: "https://images.example.test/avatar.webp" },
	});

	const [input] = remoteFetch.mock.calls[0] ?? [];
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifiedEmail));
	const hash = Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
	expect(remoteFetch).toHaveBeenCalledOnce();
	expect(new URL(String(input)).searchParams.get("hash")).toBe(hash);
	expect(String(input)).not.toContain("spoof@example.test");
});
