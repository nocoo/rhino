import { expect, it, vi } from "vitest";
import { version } from "../../../package.json";
import type { WorkerEnv } from "../../../worker/env";
import { handleApi } from "../../../worker/index";

it("returns anonymous minimal health without private rows or error details", async () => {
	const all = vi.fn().mockResolvedValue({ results: [{ private: "never expose" }] });
	const env = {
		DEPLOY_REVISION: "test",
		DB: { prepare: vi.fn(() => ({ all })) },
	} as unknown as WorkerEnv;
	const request = new Request("http://127.0.0.1/api/live");
	const healthy = await handleApi(request, env);
	expect(healthy.status).toBe(200);
	expect(healthy.headers.get("cache-control")).toBe("no-store");
	expect(await healthy.json()).toEqual({
		status: "ok",
		name: "rhino",
		version,
		revision: "test",
	});
	all.mockRejectedValue(new Error("private database detail"));
	const failed = await handleApi(request, env);
	expect(failed.status).toBe(503);
	expect(failed.headers.get("cache-control")).toBe("no-store");
	expect(await failed.json()).toEqual({ status: "error", name: "rhino", version });
});
