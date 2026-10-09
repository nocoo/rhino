import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const local = {
	local: true,
	mode: "local",
	locked: false,
	automated: false,
	instanceId: "instance-a",
	csrfToken: "csrf-a",
};
const fetcher = vi.fn();
const assign = vi.fn();
const respond = (value: unknown, status = 200) =>
	fetcher.mockResolvedValueOnce(Response.json(value, { status }));

beforeEach(() => {
	vi.resetModules();
	vi.resetAllMocks();
	vi.stubGlobal("fetch", fetcher);
	vi.stubGlobal("window", { __RHINO_LOCAL__: true, location: { assign } });
});
afterEach(() => vi.unstubAllGlobals());

describe("instance-scoped browser transport", () => {
	it("leaves hosted and non-browser transport untouched", async () => {
		window.__RHINO_LOCAL__ = false;
		const model = await import("../../../src/models/environment");
		await model.initializeEnvironment();
		expect(model.getEnvironment()).toBeNull();
		expect(model.apiPath("/api/profile")).toBe("/api/profile");
		expect(await model.selectEnvironment("local", vi.fn())).toBe(false);
		expect(fetcher).not.toHaveBeenCalled();
		vi.stubGlobal("window", undefined);
		expect(model.apiPath("/api/live")).toBe("/api/live");
	});
	it("fails closed before initialization and freezes the accepted descriptor", async () => {
		const model = await import("../../../src/models/environment");
		expect(() => model.apiPath("/api/profile")).toThrow("尚未初始化");
		respond(local);
		await model.initializeEnvironment();
		expect(Object.isFrozen(model.getEnvironment())).toBe(true);
		expect(model.apiPath("/api/profile")).toBe("/__local/instances/instance-a/api/profile");
		expect(await model.selectEnvironment("local", vi.fn())).toBe(false);
		expect(await model.selectEnvironment("unknown", vi.fn())).toBe(false);
	});
	it("locks automated E2E and preserves real Worker authentication", async () => {
		respond({ ...local, mode: "e2e", automated: true, locked: true });
		const model = await import("../../../src/models/environment");
		await model.initializeEnvironment();
		expect(model.apiPath("/api/profile")).toBe("/api/profile");
		expect(await model.selectEnvironment("prod", vi.fn())).toBe(false);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
	it.each([
		{ ...local, instanceId: "../outside" },
		{ ...local, local: false },
		{ ...local, csrfToken: "" },
		{ ...local, mode: "other" },
		{ ...local, locked: true },
		{ ...local, automated: true },
	])("rejects invalid descriptors: %j", async (invalid) => {
		respond(invalid);
		const model = await import("../../../src/models/environment");
		await expect(model.initializeEnvironment()).rejects.toThrow("环境配置无效");
		expect(() => model.apiPath("/api/profile")).toThrow();
	});
	it("requires confirmation, serializes switches, and reloads only after acceptance", async () => {
		respond(local);
		const model = await import("../../../src/models/environment");
		await model.initializeEnvironment();
		expect(await model.selectEnvironment("e2e", async () => false)).toBe(false);
		expect(fetcher).toHaveBeenCalledTimes(1);
		let accept!: (value: boolean) => void;
		const pending = model.selectEnvironment(
			"prod",
			() =>
				new Promise((yes) => {
					accept = yes;
				}),
		);
		expect(await model.selectEnvironment("e2e", vi.fn())).toBe(false);
		respond({ ...local, mode: "prod", instanceId: "instance-b" });
		accept(true);
		expect(await pending).toBe(true);
		expect(fetcher).toHaveBeenLastCalledWith("/__local/environment/select", {
			credentials: "same-origin",
			method: "POST",
			headers: { "Content-Type": "application/json", "X-Rhino-Local-Csrf": "csrf-a" },
			body: JSON.stringify({ mode: "prod", instanceId: "instance-a" }),
		});
		expect(assign).toHaveBeenCalledWith("/");
		expect(model.apiPath("/api/profile")).toContain("instance-a");
	});
	it("keeps the old scope on network, stale, service and wrong-selection errors", async () => {
		respond(local);
		const model = await import("../../../src/models/environment");
		await model.initializeEnvironment();
		fetcher.mockRejectedValueOnce(new Error("offline"));
		await expect(model.selectEnvironment("prod", async () => true)).rejects.toThrow("offline");
		respond({}, 409);
		await expect(model.selectEnvironment("prod", async () => true)).rejects.toThrow("其他页面");
		respond({}, 503);
		await expect(model.selectEnvironment("prod", async () => true)).rejects.toThrow("login:prod");
		respond(local);
		await expect(model.selectEnvironment("prod", async () => true)).rejects.toThrow("未确认");
		expect(model.apiPath("/api/profile")).toContain("instance-a");
		expect(assign).not.toHaveBeenCalled();
	});
});
