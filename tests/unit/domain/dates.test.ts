import { describe, expect, it } from "vitest";
import {
	ageOnDate,
	compareDateOnly,
	daysInclusive,
	isLeapYear,
	isValidDateOnly,
	localDateInTimeZone,
	mondayOfWeek,
	weekdayOf,
} from "../../../src/domain/dates";

describe("dates", () => {
	it("accepts leap day only in leap years", () => {
		expect(isValidDateOnly("2024-02-29")).toBe(true);
		expect(isValidDateOnly("2025-02-29")).toBe(false);
		expect(isLeapYear(2024)).toBe(true);
		expect(isLeapYear(2025)).toBe(false);
	});

	it("rejects invalid calendar dates", () => {
		expect(isValidDateOnly("2026-13-01")).toBe(false);
		expect(isValidDateOnly("2026-00-10")).toBe(false);
		expect(isValidDateOnly("26-10-09")).toBe(false);
	});

	it("uses March 1 as the non-leap anniversary for February 29 birthdays", () => {
		expect(ageOnDate("2000-02-29", "2021-02-28")).toBe(20);
		expect(ageOnDate("2000-02-29", "2021-03-01")).toBe(21);
		expect(ageOnDate("2000-02-29", "2024-02-29")).toBe(24);
	});

	it("counts full elapsed calendar years on the local date", () => {
		expect(ageOnDate("1986-10-09", "2026-10-08")).toBe(39);
		expect(ageOnDate("1986-10-09", "2026-10-09")).toBe(40);
	});

	it("treats Monday as the start of the week", () => {
		expect(weekdayOf("2026-10-09")).toBe("friday");
		expect(mondayOfWeek("2026-10-09")).toBe("2026-10-05");
		expect(mondayOfWeek("2026-10-05")).toBe("2026-10-05");
	});

	it("keeps stored local dates stable across timezone conversion of instants", () => {
		const instant = new Date("2026-10-09T16:00:00Z");
		expect(localDateInTimeZone(instant, "UTC")).toBe("2026-10-09");
		expect(localDateInTimeZone(instant, "Asia/Shanghai")).toBe("2026-10-10");
		expect(compareDateOnly("2026-10-09", "2026-10-09")).toBe(0);
	});

	it("counts inclusive calendar days", () => {
		expect(daysInclusive("2026-01-01", "2026-01-01")).toBe(1);
		expect(daysInclusive("2026-01-01", "2026-01-31")).toBe(31);
	});
});
