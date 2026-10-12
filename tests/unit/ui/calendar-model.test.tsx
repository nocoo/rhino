// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useCalendarModel } from "../../../src/features/use-calendar-model";
import type { RhinoModel } from "../../../src/features/use-rhino-model";
import { api } from "../../../src/lib/api";
import { sessionRecord } from "../../helpers/fixtures";

vi.mock("../../../src/lib/api", () => ({ api: vi.fn() }));
afterEach(() => {
	cleanup();
	vi.resetAllMocks();
});
const model = {
	today: "2026-10-12",
	plans: { current: null, history: [] },
} as unknown as RhinoModel;
function setup() {
	return renderHook(() => {
		const [selected, select] = useState(model.today);
		return useCalendarModel(model, selected, select);
	});
}
it("navigates arbitrary months, validates bounds and selects today", async () => {
	vi.mocked(api).mockResolvedValue({ sessions: [sessionRecord()] });
	const hook = setup();
	await waitFor(() => expect(hook.result.current.loading).toBe(false));
	expect(api).toHaveBeenCalledWith("/sessions?from=2026-09-28&to=2026-11-08", expect.anything());
	expect(hook.result.current.sessions).toHaveLength(1);
	act(() => hook.result.current.move(-1));
	await waitFor(() => expect(hook.result.current.loading).toBe(false));
	expect(hook.result.current.selected).toBe("2026-09-01");
	for (const month of ["", "0999-12", "9999-01", "2026-13"])
		act(() => hook.result.current.selectMonth(month));
	expect(hook.result.current.month).toBe("2026-09");
	act(() => hook.result.current.select("2026-09-15"));
	expect(hook.result.current.selected).toBe("2026-09-15");
	act(() => hook.result.current.today());
	await waitFor(() => expect(hook.result.current.loading).toBe(false));
	expect(hook.result.current.selected).toBe(model.today);
});
it("discards stale requests, reports failures and retries without false empty success", async () => {
	let resolve!: (data: unknown) => void;
	vi.mocked(api).mockImplementationOnce(
		() =>
			new Promise((yes) => {
				resolve = yes;
			}),
	);
	const hook = setup();
	vi.mocked(api).mockRejectedValueOnce(new Error("offline"));
	act(() => hook.result.current.move(-1));
	await waitFor(() => expect(hook.result.current.error).toBe("offline"));
	await act(async () => resolve({ sessions: [sessionRecord()] }));
	expect(hook.result.current.sessions).toEqual([]);
	vi.mocked(api).mockRejectedValueOnce("unknown");
	act(() => hook.result.current.retry());
	await waitFor(() => expect(hook.result.current.error).toContain("日历记录加载失败"));
	vi.mocked(api).mockResolvedValueOnce({ sessions: [] });
	act(() => hook.result.current.retry());
	await waitFor(() => expect(hook.result.current.loading).toBe(false));
	expect(hook.result.current.error).toBe("");
});
it("ignores aborted errors on unmount", async () => {
	let reject!: (error: unknown) => void;
	vi.mocked(api).mockImplementationOnce(
		() =>
			new Promise((_, no) => {
				reject = no;
			}),
	);
	const hook = setup();
	hook.unmount();
	await act(async () => reject(new Error("aborted")));
});
