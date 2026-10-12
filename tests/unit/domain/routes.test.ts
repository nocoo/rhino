import { expect, it } from "vitest";
import { calendarPath, pageLabels, parseRoute, sessionPath } from "../../../src/domain/routes";
import { uuid } from "../../helpers/fixtures";

it("resolves pages, calendar dates and exercise deep links", () => {
	expect(parseRoute("/")).toMatchObject({ page: "calendar", kind: "page" });
	for (const page of Object.keys(pageLabels))
		expect(parseRoute(`/${page}`)).toMatchObject({ page, kind: "page" });
	expect(parseRoute(calendarPath("2026-10-12"))).toMatchObject({ date: "2026-10-12" });
	expect(parseRoute("/calendar?date=").date).toBeUndefined();
	expect(parseRoute("/library/goblet-squat")).toMatchObject({ exercise: "goblet-squat" });
	for (const path of [
		"/unknown",
		"/\\[",
		"/plans/unknown",
		"/library/unknown",
		"/sessions/invalid",
		"/calendar?date=2026-02-31",
		"/calendar?date=0999-12-31",
		"/calendar?date=9999-01-01",
	])
		expect(parseRoute(path).kind).toBe("missing");
});
it("preserves valid session ancestors without allowing nested or external parents", () => {
	const id = uuid();
	expect(parseRoute(sessionPath(id, "/calendar?date=2026-09-01"))).toMatchObject({
		sessionId: id,
		parent: "/calendar?date=2026-09-01",
		kind: "session",
	});
	expect(parseRoute(sessionPath(id, "/progress"))).toMatchObject({
		page: "progress",
		parent: "/progress",
	});
	for (const from of [
		"https://evil.test",
		"//evil.test",
		"/\\evil.test/calendar",
		"/\\[",
		"/x/..//evil.test/calendar",
		"/x/..//rhino.invalid/progress",
		"/x/..//[",
		"/unknown",
		`/sessions/${uuid()}`,
		`/x/../sessions/${uuid()}`,
		"",
	])
		expect(parseRoute(sessionPath(id, from)).parent).toBe("/calendar");
	expect(parseRoute(`/sessions/${id}`).parent).toBe("/calendar");
	for (const mode of ["view", "edit", "workout"] as const) {
		expect(parseRoute(sessionPath(id, "/calendar", mode)).sessionMode).toBe(mode);
	}
	expect(parseRoute(`/sessions/${id}?mode=unknown`).sessionMode).toBe("workout");
	expect(parseRoute(sessionPath(id, "/today/../progress#main-content")).parent).toBe(
		"/progress#main-content",
	);
});
