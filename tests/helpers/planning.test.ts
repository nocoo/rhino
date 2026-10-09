import { expect, it } from "vitest";
import { planPreviewSchema } from "../../src/domain/contracts";
import { estimateStrengthMinutes, isReviewDue, previewPlan } from "../../src/domain/planning";
import { planInput, sessionTarget } from "./fixtures";

it("produces deterministic bounded weekly schedules for equipment, preference and frequency", () => {
	for (const weeklyFrequency of [1, 2, 3, 4, 5, 6, 7])
		for (const goalPreference of ["strength-first", "endurance-first"] as const) {
			const input = { ...planInput(), weeklyFrequency, goalPreference };
			const result = previewPlan(input);
			expect(result.preview).not.toBeNull();
			expect(result.preview?.template.slots).toHaveLength(weeklyFrequency);
			expect(result.preview).toEqual(previewPlan(input).preview);
			if (result.preview) expect(planPreviewSchema.safeParse(result.preview).success).toBe(true);
		}
	for (const equipmentIds of [[], ["dumbbell"], ["bench"], ["cable-machine"]] as const) {
		const result = previewPlan({ ...planInput(), equipmentIds: [...equipmentIds] });
		expect(result.preview).not.toBeNull();
		if (!equipmentIds.length) expect(result.limitations.length).toBeGreaterThan(0);
		else expect(result.preview?.rationale.unfilledRequirements.length).toBeGreaterThan(0);
	}
});
it("honors reserved cardio, explains compromises, and fits short budgets", () => {
	const over = previewPlan({
		...planInput(),
		weeklyFrequency: 1,
		cardioOnlyWeekdays: ["monday", "tuesday"],
	});
	expect(over.preview).toBeNull();
	expect(over.limitations.length).toBeGreaterThan(0);
	const reserved = previewPlan({
		...planInput(),
		cardioOnlyWeekdays: ["monday", "wednesday", "friday"],
	});
	expect(reserved.preview?.template.slots.every((slot) => slot.kind === "cardio")).toBe(true);
	expect(reserved.preview?.rationale.coverageGaps.length).toBeGreaterThan(0);
	for (const budget of [20, 30, 45, 50, 60]) {
		const result = previewPlan({
			...planInput(),
			sessionTimeBudgetMinutes: budget,
			preferredWeekdays: [],
		});
		expect(result.preview?.template.slots).toHaveLength(3);
		for (const slot of result.preview?.template.slots ?? [])
			expect(
				slot.target.blocks.reduce((total, block) => total + block.durationMinutes, 0),
			).toBeLessThanOrEqual(budget);
	}
	expect(
		previewPlan({ ...planInput(), weeklyFrequency: 0, preferredWeekdays: [] }).preview,
	).toBeNull();
	expect(estimateStrengthMinutes([])).toBe(1);
	expect(estimateStrengthMinutes(sessionTarget().blocks[0]?.exercises ?? [])).toBeGreaterThan(0);
	expect(isReviewDue("2026-10-09", null)).toBe(true);
	expect(isReviewDue("2026-10-09", "2026-09")).toBe(true);
	expect(isReviewDue("2026-10-09", "2026-10")).toBe(false);
});
