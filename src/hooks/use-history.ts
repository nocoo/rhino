import { useCallback, useEffect, useRef, useState } from "react";

const currentHref = () => window.location.pathname + window.location.search + window.location.hash;

export function useHistory(canLeave: () => boolean) {
	const [href, setHref] = useState(currentHref);
	const index = useRef(0);
	const restoring = useRef(false);
	const guard = useRef(canLeave);
	guard.current = canLeave;
	useEffect(() => {
		index.current = window.history.state?.rhinoIndex ?? 0;
		window.history.replaceState({ ...window.history.state, rhinoIndex: index.current }, "");
		if (window.location.pathname === "/") {
			window.history.replaceState(window.history.state, "", `/calendar${window.location.search}`);
			setHref(currentHref());
		}
		const pop = () => {
			if (restoring.current) {
				restoring.current = false;
				return;
			}
			const next = window.history.state?.rhinoIndex ?? 0;
			if (!guard.current()) {
				restoring.current = true;
				window.history.go(index.current - next);
				return;
			}
			index.current = next;
			setHref(currentHref());
		};
		window.addEventListener("popstate", pop);
		return () => window.removeEventListener("popstate", pop);
	}, []);
	const navigate = useCallback((to: string, replace = false) => {
		const url = new URL(to, window.location.href);
		if (url.origin !== window.location.origin) return false;
		const next = url.pathname + url.search + url.hash;
		if (next === currentHref()) return true;
		if (restoring.current || !guard.current()) return false;
		if (!replace) index.current++;
		window.history[replace ? "replaceState" : "pushState"]({ rhinoIndex: index.current }, "", next);
		setHref(next);
		return true;
	}, []);
	return { href, navigate };
}

export function confirmNavigation(busy: boolean) {
	if (busy) return false;
	return (
		window.dispatchEvent(new Event("beforeunload", { cancelable: true })) ||
		window.confirm("有尚未保存的修改，确定离开并放弃这些修改？")
	);
}
