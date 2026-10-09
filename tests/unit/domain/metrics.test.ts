import { describe, expect, it } from "vitest";
import type { MeasurementRecord, SessionRecord } from "../../../src/domain/contracts";
import {
	assertFinitePositive,
	bmiForWeight,
	computeBmi,
	deriveProgress,
	displayBmi,
	estimatedHeartRate,
	heartRateGuidance,
	measurementWarnings,
	moderateEquivalentMinutes,
	profileReadiness,
	recommendationScope,
} from "../../../src/domain/metrics";

const height = (id: string, date: string, value: number): MeasurementRecord => ({
	id,
	kind: "height",
	effectiveDate: date,
	value,
	version: 1,
	lastMutationId: id,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
});

const weight = (id: string, date: string, value: number): MeasurementRecord => ({
	id,
	kind: "weight",
	effectiveDate: date,
	value,
	version: 1,
	lastMutationId: id,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("metrics", () => {
	it("matches the age-40 heart-rate example without mixing HRR", () => {
		const estimate = estimatedHeartRate(40);
		expect(estimate.estimatedHrMax).toBe(180);
		expect(estimate.moderateBpm[0]).toBeCloseTo(90);
		expect(estimate.moderateBpm[1]).toBeCloseTo(126);
		expect(estimate.vigorousBpm[0]).toBeCloseTo(126);
		expect(estimate.vigorousBpm[1]).toBeCloseTo(153);
		expect(estimate.displayedModerateBpm).toEqual([90, 126]);
		expect(estimate.displayedVigorousBpm).toEqual([126, 153]);
		expect(estimate.method).toBe("tanaka-208-0.7-age");
	});

	it("suppresses numeric zones without a birthday, when disabled, or out of scope", () => {
		expect(
			heartRateGuidance({ birthday: null, onDate: "2026-10-09", mode: "generic-estimates" }).status,
		).toBe("suppressed");
		expect(
			heartRateGuidance({ birthday: "1986-10-09", onDate: "2026-10-09", mode: "disabled" }).status,
		).toBe("suppressed");
		expect(
			heartRateGuidance({ birthday: "2015-01-01", onDate: "2026-10-09", mode: "generic-estimates" })
				.status,
		).toBe("suppressed");
		expect(
			heartRateGuidance({ birthday: "1986-10-09", onDate: "2026-10-09", mode: "clinician-range" })
				.status,
		).toBe("clinician-override");
	});

	it("computes BMI from unrounded values and displays one decimal", () => {
		const bmi = computeBmi(80, 180);
		expect(bmi).toBeCloseTo(24.691358, 6);
		expect(displayBmi(bmi)).toBe("24.7");
	});

	it("rejects zero NaN and infinite measurements", () => {
		expect(() => computeBmi(0, 180)).toThrow();
		expect(() => computeBmi(80, Number.NaN)).toThrow();
		expect(() => computeBmi(80, Number.POSITIVE_INFINITY)).toThrow();
		expect(() => assertFinitePositive(Number.NEGATIVE_INFINITY)).toThrow();
	});

	it("does not invent historical BMI without a prior height", () => {
		expect(bmiForWeight(weight("w1", "2026-01-01", 80), [])).toBeNull();
		const laterHeight = [height("h1", "2026-02-01", 180)];
		expect(bmiForWeight(weight("w1", "2026-01-01", 80), laterHeight)).toBeNull();
		expect(bmiForWeight(weight("w2", "2026-02-01", 80), laterHeight)?.displayedBmi).toBe("24.7");
	});

	it("recalculates affected BMI when a dated height is corrected", () => {
		const heights = [height("h1", "2026-01-01", 170), height("h2", "2026-03-01", 180)];
		expect(bmiForWeight(weight("w1", "2026-02-01", 80), heights)?.heightCm).toBe(170);
		expect(
			bmiForWeight(weight("w1", "2026-02-01", 80), [heights[1] as MeasurementRecord]),
		).toBeNull();
		expect(bmiForWeight(weight("w2", "2026-03-01", 80), heights)?.displayedBmi).toBe("24.7");
	});

	it("counts moderate-equivalent minutes without double-counting warm-up or unknown intensity", () => {
		expect(
			moderateEquivalentMinutes([
				{ id: "a", role: "preparation", actualMinutes: 8, intensity: "easy" },
				{ id: "b", role: "main", actualMinutes: 20, intensity: "moderate" },
				{ id: "c", role: "recovery", actualMinutes: 5, intensity: "unknown" },
			]),
		).toBe(20);
		expect(
			moderateEquivalentMinutes([
				{ id: "a", role: "preparation", actualMinutes: 8, intensity: "moderate" },
				{ id: "b", role: "main", actualMinutes: 10, intensity: "vigorous" },
			]),
		).toBe(28);
	});

	it("warns on implausible but accepted measurements", () => {
		expect(measurementWarnings("height", 110)[0]?.code).toBe("plausibility");
		expect(measurementWarnings("weight", 80)).toEqual([]);
		expect(() => measurementWarnings("weight", 5)).toThrow();
	});

	it("classifies recommendation scope and profile readiness", () => {
		expect(recommendationScope(null, "2026-10-09")).toBe("unknown-age");
		expect(recommendationScope("2010-01-01", "2026-10-09")).toBe("out-of-scope");
		expect(recommendationScope("1990-01-01", "2026-10-09")).toBe("in-scope");
		expect(profileReadiness(null, [], "2026-10-09").hasProfile).toBe(false);
	});

	it("groups weekly totals on local week boundaries and ignores unknown cardio", () => {
		const session = {
			id: "11111111-1111-4111-8111-111111111111",
			sourcePlanRevision: null,
			localDate: "2026-10-11",
			timezone: "Asia/Shanghai",
			status: "completed",
			target: {
				catalogVersion: "1.0.0",
				algorithmVersion: "1.0.0",
				timeBudgetMinutes: 45,
				emphasis: "cardio",
				blocks: [
					{
						kind: "cardio",
						durationMinutes: 35,
						exercises: [],
						cardio: {
							id: "22222222-2222-4222-8222-222222222222",
							role: "main",
							modality: "cycling",
							plannedMinutes: 35,
							plannedIntensity: "moderate",
						},
					},
				],
			},
			actual: {
				exercises: [],
				cardioSegments: [
					{
						id: "22222222-2222-4222-8222-222222222222",
						role: "main",
						actualMinutes: 30,
						intensity: "unknown",
					},
				],
				painFlag: false,
				perceivedEffort: null,
				completedAsPlanned: false,
				notes: "",
			},
			version: 1,
			lastMutationId: "33333333-3333-4333-8333-333333333333",
			createdAt: "2026-10-11T00:00:00.000Z",
			updatedAt: "2026-10-11T00:00:00.000Z",
		} satisfies SessionRecord;
		const progress = deriveProgress({
			from: "2026-10-05",
			to: "2026-10-18",
			measurements: [height("h", "2026-10-01", 180), weight("w", "2026-10-11", 80)],
			sessions: [session],
		});
		expect(progress.weeklyTotals[0]?.weekStart).toBe("2026-10-05");
		expect(progress.weeklyTotals[0]?.moderateEquivalentMinutes).toBe(0);
		expect(progress.measurements.find((row) => row.kind === "weight")?.displayedBmi).toBe("24.7");
	});
});
