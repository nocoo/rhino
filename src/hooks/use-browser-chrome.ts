import { useEffect } from "react";

export function useBrowserChrome() {
	useEffect(() => {
		const root = document.documentElement;
		const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
		if (!meta) return;
		const original = meta.content;
		const update = () => {
			meta.content = getComputedStyle(root).backgroundColor;
		};
		const observer = new MutationObserver(update);
		observer.observe(root, { attributes: true, attributeFilter: ["class", "data-workout-tone"] });
		const mobile = window.matchMedia("(max-width: 767px)");
		mobile.addEventListener("change", update);
		update();
		return () => {
			observer.disconnect();
			mobile.removeEventListener("change", update);
			meta.content = original;
		};
	}, []);
}

export function useWorkoutChrome(tone: string | null) {
	useEffect(() => {
		const root = document.documentElement;
		if (tone) root.dataset.workoutTone = tone;
		else delete root.dataset.workoutTone;
		return () => {
			delete root.dataset.workoutTone;
		};
	}, [tone]);
}
