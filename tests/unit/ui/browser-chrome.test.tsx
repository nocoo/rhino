// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useBrowserChrome, useWorkoutChrome } from "../../../src/hooks/use-browser-chrome";

afterEach(() => {
	cleanup();
	document.head.innerHTML = "";
	vi.unstubAllGlobals();
});
it("syncs resolved chrome on theme, workout and viewport changes and cleans up", async () => {
	document.head.innerHTML = '<meta name="theme-color" content="#eeeff2">';
	const remove = vi.fn();
	let change!: () => void;
	vi.stubGlobal("matchMedia", () => ({
		addEventListener: (_: string, callback: () => void) => {
			change = callback;
		},
		removeEventListener: remove,
	}));
	let color = "rgb(20, 30, 40)";
	vi.stubGlobal("getComputedStyle", () => ({ backgroundColor: color }));
	const hook = renderHook(
		({ tone }) => {
			useBrowserChrome();
			useWorkoutChrome(tone);
		},
		{ initialProps: { tone: "strength" as string | null } },
	);
	const meta = document.querySelector("meta");
	expect(meta?.content).toBe(color);
	expect(document.documentElement.dataset.workoutTone).toBe("strength");
	color = "rgb(25, 94, 69)";
	hook.rerender({ tone: "rest" });
	await waitFor(() => expect(meta?.content).toBe(color));
	color = "rgb(238, 239, 242)";
	act(() => change());
	expect(meta?.content).toBe(color);
	hook.rerender({ tone: null });
	expect(document.documentElement.dataset.workoutTone).toBeUndefined();
	hook.unmount();
	expect(meta?.content).toBe("#eeeff2");
	expect(remove).toHaveBeenCalledWith("change", change);
});
it("does not require optional metadata", () => {
	const hook = renderHook(useBrowserChrome);
	hook.unmount();
});
