import { EXERCISES } from "../data/exercises";
import { type StrengthExerciseId, uuidSchema } from "./contracts";
import { isValidDateOnly } from "./dates";

export const pageLabels = {
	calendar: "训练日历",
	today: "今日训练",
	plans: "训练计划",
	library: "动作实验室",
	progress: "我的进展",
	profile: "个人档案",
};
export type Page = keyof typeof pageLabels;
export type Route = {
	page: Page;
	kind: "page" | "session" | "missing";
	date?: string;
	exercise?: StrengthExerciseId;
	sessionId?: string;
	parent: string;
};

export function parseRoute(href: string, allowSession = true): Route {
	const base: Route = { page: "calendar", kind: "missing", parent: "/calendar" };
	if (!URL.canParse(href, "https://rhino.invalid")) return base;
	const url = new URL(href, "https://rhino.invalid");
	const parts = url.pathname.split("/").filter(Boolean);
	const page = (parts[0] || "calendar") as Page;
	if (url.origin !== "https://rhino.invalid") return base;
	if (
		allowSession &&
		parts[0] === "sessions" &&
		parts.length === 2 &&
		uuidSchema.safeParse(parts[1]).success
	) {
		const from = url.searchParams.get("from");
		const candidate =
			from?.startsWith("/") && URL.canParse(from, url.origin) ? new URL(from, url.origin) : null;
		const parentPath =
			candidate?.origin === url.origin && !candidate.pathname.startsWith("//")
				? candidate.pathname + candidate.search + candidate.hash
				: null;
		const parent = parentPath ? parseRoute(parentPath, false) : null;
		return {
			page: parent?.kind === "page" ? parent.page : "calendar",
			kind: "session",
			sessionId: parts[1],
			parent: parent?.kind === "page" && parentPath ? parentPath : "/calendar",
		};
	}
	if (!Object.hasOwn(pageLabels, page)) return base;
	if (page === "library" && parts.length === 2) {
		const exercise = EXERCISES.find((item) => item.id === parts[1]);
		return exercise ? { page, kind: "page", exercise: exercise.id, parent: "/library" } : base;
	}
	if (parts.length > 1) return base;
	const date = url.searchParams.get("date") || undefined;
	if (
		page === "calendar" &&
		date &&
		(!isValidDateOnly(date) || date < "1000-01-01" || date > "9998-12-31")
	)
		return base;
	return { page, kind: "page", date: page === "calendar" ? date : undefined, parent: "/calendar" };
}

export function calendarPath(date: string) {
	return `/calendar?date=${encodeURIComponent(date)}`;
}

export function sessionPath(id: string, from: string) {
	return `/sessions/${id}?from=${encodeURIComponent(from)}`;
}
