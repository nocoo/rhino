// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useEnvironment } from "../../../src/features/use-environment";
import * as environment from "../../../src/models/environment";

vi.mock("../../../src/models/environment", () => ({
	getEnvironment: vi.fn(() => null),
	selectEnvironment: vi.fn(),
}));
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

it("exposes environment and pending state, reports failures, and allows recovery", async () => {
	const confirm = vi.fn();
	const hook = renderHook(() => useEnvironment(confirm));
	expect(hook.result.current.environment).toBeNull();
	expect(hook.result.current.busy).toBe(false);
	for (const reason of [new Error("connection lost"), "unknown"]) {
		vi.mocked(environment.selectEnvironment).mockRejectedValueOnce(reason);
		await act(() => hook.result.current.select("prod"));
		expect(hook.result.current.error).toBe(
			reason instanceof Error ? reason.message : "环境切换失败，请重试。",
		);
		expect(hook.result.current.busy).toBe(false);
	}
	let complete!: (value: boolean) => void;
	vi.mocked(environment.selectEnvironment).mockReturnValueOnce(
		new Promise((yes) => {
			complete = yes;
		}),
	);
	let selection!: Promise<void>;
	act(() => {
		selection = hook.result.current.select("e2e");
	});
	expect(hook.result.current.busy).toBe(true);
	expect(hook.result.current.error).toBeNull();
	await act(async () => {
		complete(true);
		await selection;
	});
	expect(hook.result.current.busy).toBe(false);
	expect(environment.selectEnvironment).toHaveBeenLastCalledWith("e2e", confirm);
});
