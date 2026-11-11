import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

export function useIsMobile() {
	const [mobile, setMobile] = useState(() =>
		typeof window !== "undefined" ? window.matchMedia(MOBILE_QUERY).matches : false,
	);

	useEffect(() => {
		const query = window.matchMedia(MOBILE_QUERY);
		const change = () => setMobile(query.matches);
		query.addEventListener("change", change);
		return () => query.removeEventListener("change", change);
	}, []);

	return mobile;
}
