import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { version } from "../../../package.json";
import { run } from "../../../scripts/process";

vi.mock("../../../scripts/process", () => ({ run: vi.fn() }));

const revision = "a".repeat(40);
const health = { status: "ok", name: "rhino", version, revision };
const access = {
	status: 302,
	headers: {
		location: "https://nocoo.cloudflareaccess.com/cdn-cgi/access/login/rhino.hexly.ai",
	},
};

beforeEach(() => {
	vi.mocked(run).mockResolvedValue(`${revision}\n`);
	vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	vi.resetModules();
});

function responses(
	body: unknown = health,
	init: ResponseInit = { headers: { "cache-control": "no-store" } },
) {
	return vi
		.fn()
		.mockResolvedValueOnce(Response.json(body, init))
		.mockResolvedValueOnce(new Response(null, access));
}

it("checks anonymous exact-revision D1 health and the protected Access boundary", async () => {
	const fetch = responses();
	vi.stubGlobal("fetch", fetch);
	await import("../../../scripts/verify-deployment");
	expect(run).toHaveBeenCalledWith(["git", "rev-parse", "HEAD"], { capture: true });
	for (const [index, path] of ["live", "profile"].entries()) {
		expect(fetch).toHaveBeenNthCalledWith(index + 1, `https://rhino.hexly.ai/api/${path}`, {
			redirect: "manual",
			signal: expect.any(AbortSignal),
		});
	}
	expect(fetch).toHaveBeenCalledTimes(2);
});

it.each([
	{ ...health, version: "0.0.0" },
	{ ...health, revision: "b".repeat(40) },
	{ ...health, status: "error" },
	{ ...health, name: "other" },
	{ status: "ok", name: "rhino", version },
	{ ...health, extra: "unexpected" },
	null,
])("rejects mismatched or malformed health: %j", async (body) => {
	const fetch = responses(body);
	vi.stubGlobal("fetch", fetch);
	await expect(import("../../../scripts/verify-deployment")).rejects.toThrow(
		"Production health must match the proven version and revision",
	);
	expect(fetch).toHaveBeenCalledTimes(1);
});

it.each([
	{ status: 503, headers: { "cache-control": "no-store" } },
	{ status: 302, headers: { "cache-control": "no-store" } },
	{ status: 200 },
	{ status: 200, headers: { "cache-control": "public, max-age=60" } },
])("rejects non-200 or cacheable health: %j", async (init) => {
	vi.stubGlobal("fetch", responses(health, init));
	await expect(import("../../../scripts/verify-deployment")).rejects.toThrow(
		"Production health must return uncached HTTP 200",
	);
});

it.each([
	{ status: 200 },
	{ status: 401 },
	{ status: 302 },
	{ status: 302, headers: { location: "https://other.cloudflareaccess.com/login" } },
])("rejects a response without the exact Access boundary: %j", async (init) => {
	const fetch = vi
		.fn()
		.mockResolvedValueOnce(Response.json(health, { headers: { "cache-control": "no-store" } }))
		.mockResolvedValueOnce(new Response(null, init));
	vi.stubGlobal("fetch", fetch);
	await expect(import("../../../scripts/verify-deployment")).rejects.toThrow(
		"Unauthenticated production API must redirect to the configured Access team",
	);
});

it("rejects invalid checkout metadata before networking", async () => {
	vi.mocked(run).mockResolvedValue("main");
	const fetch = vi.fn();
	vi.stubGlobal("fetch", fetch);
	await expect(import("../../../scripts/verify-deployment")).rejects.toThrow(
		"Deployment verification requires the proven checkout revision",
	);
	expect(fetch).not.toHaveBeenCalled();
});

it("fails closed on a network error", async () => {
	vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network unavailable")));
	await expect(import("../../../scripts/verify-deployment")).rejects.toThrow("Network unavailable");
});
