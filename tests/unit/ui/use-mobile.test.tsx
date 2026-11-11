// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useIsMobile } from "../../../src/hooks/use-mobile";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

it("tracks the mobile breakpoint and unsubscribes on unmount", () => {
	let matches = false;
	let change!: () => void;
	const remove = vi.fn();
	vi.stubGlobal("matchMedia", () => ({
		get matches() {
			return matches;
		},
		addEventListener: (_: string, callback: () => void) => {
			change = callback;
		},
		removeEventListener: remove,
	}));
	const hook = renderHook(useIsMobile);
	expect(hook.result.current).toBe(false);
	matches = true;
	act(() => change());
	expect(hook.result.current).toBe(true);
	hook.unmount();
	expect(remove).toHaveBeenCalledWith("change", change);
});
