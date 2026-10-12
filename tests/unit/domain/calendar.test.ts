import { describe, expect, it } from "vitest";
import { calendarDays, recordedWork, shiftMonth } from "../../../src/domain/calendar";
import type { PlanRevisionRecord } from "../../../src/domain/contracts";
import { planInput, sessionRecord, sessionTarget, uuid } from "../../helpers/fixtures";

function calendarPlan(revision = 1): PlanRevisionRecord {
	return {
		revision,
		requestId: uuid(),
		reviewMonth: "2026-10",
		acceptedAt: "2026-09-30T17:00:00Z",
		algorithmVersion: "1.0.0",
		catalogVersion: "1.0.0",
		input: planInput(),
		template: {
			slots: [
				{
					weekday: "thursday",
					kind: "strength",
					emphasis: "full-body",
					timeBudgetMinutes: 60,
					target: sessionTarget(),
				},
			],
		},
		rationale: { explanations: [], compromises: [], unfilledRequirements: [], coverageGaps: [] },
	};
}

describe("workout calendar", () => {
	it("builds Monday-first leap and cross-year month grids", () => {
		expect(shiftMonth("2026-12", 1)).toBe("2027-01");
		expect(shiftMonth("2026-01", -1)).toBe("2025-12");
		expect(() => shiftMonth("invalid", 1)).toThrow();
		const days = calendarDays("2024-02", []);
		expect(days).toHaveLength(42);
		expect(days[0].date).toBe("2024-01-29");
		expect(days[41].date).toBe("2024-03-10");
		expect(days.some((day) => day.date === "2024-02-29")).toBe(true);
	});
	it("uses adoption timezone and latest accepted revision, never backfills a new plan", () => {
		const first = calendarPlan();
		const second = { ...calendarPlan(2), acceptedAt: "2026-10-08T00:00:00Z" };
		const days = calendarDays("2026-10", [first, second, second]);
		expect(days.find((day) => day.date === "2026-09-30")?.plan).toBeUndefined();
		expect(days.find((day) => day.date === "2026-10-01")?.plan?.revision).toBe(1);
		expect(days.find((day) => day.date === "2026-10-08")?.plan?.revision).toBe(2);
		expect(days.find((day) => day.date === "2026-10-09")?.slot).toBeUndefined();
		expect(days.find((day) => day.date === "2026-10-15")?.slot?.kind).toBe("strength");
	});
	it("summarizes actual work only", () => {
		const record = sessionRecord();
		expect(recordedWork(record)).toEqual({ sets: 0, minutes: 0 });
		record.actual = {
			exercises: [
				{
					id: uuid(),
					sets: [
						{ id: uuid(), status: "performed", reps: 8, loadKg: 15, rir: null },
						{ id: uuid(), status: "not-recorded", reps: null, loadKg: null, rir: null },
					],
				},
			],
			cardioSegments: [{ id: uuid(), role: "main", actualMinutes: 3.25, intensity: "unknown" }],
			painFlag: false,
			perceivedEffort: null,
			completedAsPlanned: false,
			notes: "",
		};
		expect(recordedWork(record)).toEqual({ sets: 1, minutes: 3.25 });
	});
});
