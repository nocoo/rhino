import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	vi.resetModules();
});

it("checks an Access-protected route, not the shared health bypass", async () => {
	const fetch = vi.fn().mockResolvedValue(
		new Response(null, {
			status: 302,
			headers: {
				location: "https://nocoo.cloudflareaccess.com/cdn-cgi/access/login/rhino.hexly.ai",
			},
		}),
	);
	vi.stubGlobal("fetch", fetch);
	vi.spyOn(console, "log").mockImplementation(() => {});
	await import("../../../scripts/verify-deployment");
	expect(fetch).toHaveBeenCalledWith(
		"https://rhino.hexly.ai/api/profile",
		expect.objectContaining({ redirect: "manual", signal: expect.any(AbortSignal) }),
	);
});

it.each([
	{ status: 200 },
	{ status: 401 },
	{ status: 302 },
	{ status: 302, headers: { location: "https://other.cloudflareaccess.com/login" } },
])("rejects a response without the exact Access boundary: %j", async (init) => {
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, init)));
	await expect(import("../../../scripts/verify-deployment")).rejects.toThrow(
		"Unauthenticated production API must redirect to the configured Access team",
	);
});
