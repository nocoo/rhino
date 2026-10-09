import { describe, expect, it, vi } from "vitest";
import * as contracts from "../../src/domain/contracts";
import * as dates from "../../src/domain/dates";
import { api, ApiError as ClientError, put } from "../../src/lib/api";

describe("calendar and recorded timezone boundaries", () => {
	it("rejects invalid dates and handles leap-year anniversaries", () => {
		for (const invalid of ["bad", "2026-02-29", "2026-13-01", "2026-00-01", "2026-01-32"])
			expect(dates.isValidDateOnly(invalid)).toBe(false);
		expect(dates.isValidDateOnly("2024-02-29")).toBe(true);
		expect(() => dates.parseDateOnly("bad")).toThrow("invalid_date");
		expect(() => dates.formatDateOnly({ year: 2026, month: 2, day: 30 })).toThrow();
		expect(dates.formatDateOnly(dates.parseDateOnly("2024-02-29"))).toBe("2024-02-29");
		expect(dates.ageOnDate("2000-02-29", "2025-02-28")).toBe(24);
		expect(dates.ageOnDate("2000-02-29", "2025-03-01")).toBe(25);
		expect(dates.ageOnDate("2000-02-29", "2024-02-29")).toBe(24);
		expect(dates.ageOnDate("2000-03-01", "2025-04-01")).toBe(25);
		expect(() => dates.ageOnDate("2030-01-01", "2026-01-01")).toThrow("future_birthday");
		for (const [year, leap] of [
			[2000, true],
			[2024, true],
			[1900, false],
			[2025, false],
		] as const)
			expect(dates.isLeapYear(year)).toBe(leap);
	});
	it("preserves date-only range and week arithmetic", () => {
		expect(dates.compareDateOnly("2026-01-01", "2026-01-01")).toBe(0);
		expect(dates.compareDateOnly("2026-01-01", "2026-01-02")).toBe(-1);
		expect(dates.compareDateOnly("2026-01-02", "2026-01-01")).toBe(1);
		expect(dates.addDays("2024-02-28", 2)).toBe("2024-03-01");
		expect(dates.daysInclusive("2024-02-28", "2024-03-01")).toBe(3);
		expect(dates.monthOf("2026-10-09")).toBe("2026-10");
		expect(dates.weekdayOf("2026-10-11")).toBe("sunday");
		expect(dates.mondayOfWeek("2026-10-11")).toBe("2026-10-05");
		expect(dates.weekdayIndex("monday")).toBe(0);
		for (const invalid of ["bad", "2026-00", "2026-13"])
			expect(dates.isValidMonth(invalid)).toBe(false);
		expect(dates.isValidMonth("2026-12")).toBe(true);
		expect(dates.isUtcInstant("2026-10-09T12:00:00Z")).toBe(true);
		expect(dates.isUtcInstant("2026-10-09T12:00:00+00:00")).toBe(false);
		expect(dates.isUtcInstant("2026-13-09T12:00:00Z")).toBe(false);
		expect(dates.isUtcInstant(dates.utcNow())).toBe(true);
	});
	it("records the timezone, not the machine date", () => {
		const instant = new Date("2026-10-09T01:00:00Z");
		expect(dates.localDateInTimeZone(instant, "America/Los_Angeles")).toBe("2026-10-08");
		expect(dates.localDateInTimeZone(instant, "Asia/Shanghai")).toBe("2026-10-09");
		for (const invalid of ["", "x".repeat(65), "Mars/Olympus"])
			expect(dates.isIanaTimeZone(invalid)).toBe(false);
		expect(dates.isIanaTimeZone("Asia/Shanghai")).toBe(true);
	});
});

describe("strict request contracts", () => {
	it("rejects duplicate weekdays, reversed dates and excessive ranges", () => {
		expect(contracts.weekdayListSchema.safeParse(["monday", "monday"]).success).toBe(false);
		expect(contracts.weekdayListSchema.safeParse(["monday"]).success).toBe(true);
		expect(
			contracts.dateRangeQuerySchema.safeParse({ from: "2026-01-01", to: "2026-01-02" }).success,
		).toBe(true);
		for (const range of [
			{ from: "2026-01-02", to: "2026-01-01" },
			{ from: "2020-01-01", to: "2026-01-01" },
		])
			expect(contracts.dateRangeQuerySchema.safeParse(range).success).toBe(false);
	});
	it("requires a clinician range only with explicit clinician guidance", () => {
		const range = {
			minBpm: 100,
			maxBpm: 140,
			effectiveDate: "2026-10-09",
			sourceNote: "Synthetic clinician",
		};
		for (const value of [
			{ mode: "clinician-range", clinicianRange: range },
			contracts.defaultGuidance,
			{ mode: "disabled", clinicianRange: null },
		])
			expect(contracts.guidanceSettingsSchema.safeParse(value).success).toBe(true);
		for (const value of [
			{ mode: "clinician-range", clinicianRange: null },
			{ mode: "clinician-range", clinicianRange: { ...range, minBpm: 150 } },
			{ mode: "disabled", clinicianRange: range },
		])
			expect(contracts.guidanceSettingsSchema.safeParse(value).success).toBe(false);
	});
	it("formats validation failures and conflict information without payloads", () => {
		expect(contracts.parseWithSchema(contracts.dateOnlySchema, "2026-10-09")).toBe("2026-10-09");
		expect(() => contracts.parseWithSchema(contracts.dateOnlySchema, "bad")).toThrow("value:");
		expect(() =>
			contracts.parseWithSchema(
				contracts.dateRangeQuerySchema,
				{ from: "bad", to: "bad" },
				"Range",
			),
		).toThrow("Range: from:");
		expect(contracts.ok(1)).toEqual({ data: 1 });
		expect(contracts.errorBody(new contracts.ApiError(400, "invalid_request", "Bad"))).toEqual({
			error: { code: "invalid_request", message: "Bad" },
		});
		expect(
			contracts.errorBody(
				new contracts.ApiError(409, "conflict", "Stale", { currentVersion: 2, currentRevision: 3 }),
			),
		).toEqual({
			error: { code: "conflict", message: "Stale", currentVersion: 2, currentRevision: 3 },
		});
		expect(contracts.apiDataSchema(contracts.dateOnlySchema).parse({ data: "2026-10-09" })).toEqual(
			{ data: "2026-10-09" },
		);
	});
});

describe("client API failure handling", () => {
	it("uses same-origin JSON and retains requested method and headers", async () => {
		const fetcher = vi.fn().mockImplementation(
			async () =>
				new Response(JSON.stringify({ data: { saved: true } }), {
					headers: { "content-type": "application/json" },
				}),
		);
		vi.stubGlobal("fetch", fetcher);
		try {
			expect(await put("/profile", { expectedVersion: 0 })).toEqual({ saved: true });
			expect(fetcher).toHaveBeenCalledWith(
				"/api/profile",
				expect.objectContaining({ method: "PUT", body: '{"expectedVersion":0}' }),
			);
			await api("/live", { headers: { "X-Request": "test" } });
			expect(fetcher.mock.calls[1]?.[1].headers).toEqual({
				"Content-Type": "application/json",
				"X-Request": "test",
			});
		} finally {
			vi.unstubAllGlobals();
		}
	});
	it("distinguishes Access redirects, stale saves and server failures", async () => {
		for (const [response, code] of [
			[
				new Response("Login", { status: 200, headers: { "content-type": "text/html" } }),
				"AUTH_REQUIRED",
			],
			[new Response("Login", { status: 401 }), "AUTH_REQUIRED"],
			[
				new Response(JSON.stringify({ error: { code: "conflict", message: "stale" } }), {
					status: 409,
					headers: { "content-type": "application/json" },
				}),
				"conflict",
			],
			[
				new Response(JSON.stringify({ error: { code: "invalid_request", message: "bad input" } }), {
					status: 400,
					headers: { "content-type": "application/json" },
				}),
				"invalid_request",
			],
			[
				new Response("{}", { status: 500, headers: { "content-type": "application/json" } }),
				"REQUEST_FAILED",
			],
		] as const) {
			vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
			try {
				await expect(api("/profile")).rejects.toMatchObject({ code });
			} finally {
				vi.unstubAllGlobals();
			}
		}
		expect(new ClientError(409, "conflict", "stale").status).toBe(409);
	});
});
