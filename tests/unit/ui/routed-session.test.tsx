// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useRoutedSession } from "../../../src/hooks/use-routed-session";
import { api } from "../../../src/lib/api";
import { sessionRecord } from "../../helpers/fixtures";

vi.mock("../../../src/lib/api", () => ({ api: vi.fn() }));
afterEach(() => {
	cleanup();
	vi.resetAllMocks();
});
it("clears non-session pages, keeps active records and loads direct links", async () => {
	const record = sessionRecord();
	const setActive = vi.fn();
	vi.mocked(api).mockResolvedValue({ session: record });
	const hook = renderHook(({ id, active }) => useRoutedSession(id, active, setActive), {
		initialProps: { id: undefined as string | undefined, active: null as typeof record | null },
	});
	expect(setActive).toHaveBeenCalledWith(null);
	hook.rerender({ id: record.id, active: record });
	expect(api).not.toHaveBeenCalled();
	hook.rerender({ id: record.id, active: null });
	await waitFor(() => expect(setActive).toHaveBeenCalledWith(record));
});
it("supports retry and discards results/errors after navigation", async () => {
	const record = sessionRecord();
	const setActive = vi.fn();
	vi.mocked(api).mockRejectedValueOnce(new Error("missing"));
	const hook = renderHook(() => useRoutedSession(record.id, null, setActive));
	await waitFor(() => expect(hook.result.current.error).toBe("missing"));
	vi.mocked(api).mockRejectedValueOnce("offline");
	act(() => hook.result.current.retry());
	await waitFor(() => expect(hook.result.current.error).toContain("加载失败"));
	let resolve!: (value: unknown) => void;
	vi.mocked(api).mockImplementationOnce(
		() =>
			new Promise((yes) => {
				resolve = yes;
			}),
	);
	act(() => hook.result.current.retry());
	hook.unmount();
	await act(async () => resolve({ session: record }));
	expect(setActive).not.toHaveBeenCalled();
	let reject!: (value: unknown) => void;
	vi.mocked(api).mockImplementationOnce(
		() =>
			new Promise((_, no) => {
				reject = no;
			}),
	);
	const next = renderHook(() => useRoutedSession(record.id, null, setActive));
	next.unmount();
	await act(async () => reject(new Error("stale")));
});
