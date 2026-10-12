// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { confirmNavigation, useHistory } from "../../../src/hooks/use-history";

beforeEach(() => window.history.replaceState(null, "", "/"));
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});
it("defaults to calendar and manages same-origin push, replace, back and forward", async () => {
	const hook = renderHook(() => useHistory(() => true));
	expect(hook.result.current.href).toBe("/calendar");
	act(() => {
		expect(hook.result.current.navigate("https://elsewhere.test")).toBe(false);
	});
	act(() => {
		expect(hook.result.current.navigate("/calendar")).toBe(true);
	});
	act(() => hook.result.current.navigate("/plans"));
	act(() => hook.result.current.navigate("/calendar?date=2026-10-12#day", true));
	expect(window.history.state.rhinoIndex).toBe(1);
	act(() => window.history.back());
	await waitFor(() => expect(hook.result.current.href).toBe("/calendar"));
	act(() => window.history.forward());
	await waitFor(() => expect(hook.result.current.href).toContain("2026-10-12"));
});
it("restores cancelled pop navigation and refuses pushes while restoring", async () => {
	let allowed = true;
	const hook = renderHook(() => useHistory(() => allowed));
	act(() => hook.result.current.navigate("/profile"));
	allowed = false;
	act(() => {
		expect(hook.result.current.navigate("/plans")).toBe(false);
	});
	const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
	act(() => {
		window.history.replaceState(null, "", "/calendar");
		window.dispatchEvent(new PopStateEvent("popstate"));
	});
	expect(go).toHaveBeenCalledWith(1);
	act(() => {
		expect(hook.result.current.navigate("/today")).toBe(false);
	});
	act(() => {
		window.history.replaceState({ rhinoIndex: 1 }, "", "/profile");
		window.dispatchEvent(new PopStateEvent("popstate"));
	});
	expect(hook.result.current.href).toBe("/profile");
	allowed = true;
	act(() => hook.result.current.navigate("/today"));
	expect(hook.result.current.href).toBe("/today");
});
it("preserves an existing history entry and confirms dirty navigation only once", () => {
	window.history.replaceState({ rhinoIndex: 5 }, "", "/progress");
	const hook = renderHook(() => useHistory(() => true));
	act(() => hook.result.current.navigate("/plans"));
	expect(window.history.state.rhinoIndex).toBe(6);
	expect(confirmNavigation(true)).toBe(false);
	expect(confirmNavigation(false)).toBe(true);
	const dirty = (event: Event) => event.preventDefault();
	window.addEventListener("beforeunload", dirty);
	const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
	expect(confirmNavigation(false)).toBe(false);
	confirm.mockReturnValue(true);
	expect(confirmNavigation(false)).toBe(true);
	window.removeEventListener("beforeunload", dirty);
});
