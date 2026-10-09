import {
	type CardioSegmentActual,
	type GetProgressResponse,
	type HeartRateEstimate,
	MAX_RECOMMENDATION_AGE,
	type MeasurementKind,
	type MeasurementRecord,
	MIN_RECOMMENDATION_AGE,
	type ProfileReadiness,
	type ProfileRecord,
	type ProgressMeasurement,
	type SessionRecord,
	type Warning,
	type WeeklyTotal,
} from "./contracts";
import { ageOnDate, compareDateOnly, localDateInTimeZone, mondayOfWeek } from "./dates";

const HEIGHT_ABS_MIN = 20;
const HEIGHT_ABS_MAX = 300;
const HEIGHT_WARN_MIN = 120;
const HEIGHT_WARN_MAX = 210;
const WEIGHT_ABS_MIN = 10;
const WEIGHT_ABS_MAX = 500;
const WEIGHT_WARN_MIN = 40;
const WEIGHT_WARN_MAX = 200;

export function isFutureLocalDate(date: string, timeZone: string, now = new Date()): boolean {
	return compareDateOnly(date, localDateInTimeZone(now, timeZone)) > 0;
}

export function recommendationScope(
	birthday: string | null,
	onDate: string,
): ProfileReadiness["recommendationScope"] {
	if (!birthday) {
		return "unknown-age";
	}
	const age = ageOnDate(birthday, onDate);
	if (age < MIN_RECOMMENDATION_AGE || age > MAX_RECOMMENDATION_AGE) {
		return "out-of-scope";
	}
	return "in-scope";
}

export function computeBmi(weightKg: number, heightCm: number): number {
	if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || weightKg <= 0 || heightCm <= 0) {
		throw new Error("invalid_measurement");
	}
	const heightM = heightCm / 100;
	return weightKg / heightM ** 2;
}

export function displayBmi(bmi: number): string {
	if (!Number.isFinite(bmi) || bmi <= 0) {
		throw new Error("invalid_bmi");
	}
	return (Math.round(bmi * 10) / 10).toFixed(1);
}

export function heightForWeightDate(
	effectiveDate: string,
	heights: readonly MeasurementRecord[],
): MeasurementRecord | null {
	const eligible = heights
		.filter((row) => row.kind === "height" && row.effectiveDate <= effectiveDate)
		.sort((left, right) => compareDateOnly(right.effectiveDate, left.effectiveDate));
	return eligible[0] ?? null;
}

export function bmiForWeight(
	weight: MeasurementRecord,
	heights: readonly MeasurementRecord[],
): { bmi: number; displayedBmi: string; heightCm: number } | null {
	const height = heightForWeightDate(weight.effectiveDate, heights);
	if (!height) {
		return null;
	}
	const bmi = computeBmi(weight.value, height.value);
	return { bmi, displayedBmi: displayBmi(bmi), heightCm: height.value };
}

export function estimatedHeartRate(ageYears: number): HeartRateEstimate {
	if (!Number.isInteger(ageYears) || ageYears < 0) {
		throw new Error("invalid_age");
	}
	const estimatedHrMax = 208 - 0.7 * ageYears;
	const moderateBpm: [number, number] = [estimatedHrMax * 0.5, estimatedHrMax * 0.7];
	const vigorousBpm: [number, number] = [estimatedHrMax * 0.7, estimatedHrMax * 0.85];
	return {
		ageYears,
		estimatedHrMax,
		moderateBpm,
		vigorousBpm,
		displayedModerateBpm: [Math.round(moderateBpm[0]), Math.round(moderateBpm[1])],
		displayedVigorousBpm: [Math.round(vigorousBpm[0]), Math.round(vigorousBpm[1])],
		method: "tanaka-208-0.7-age",
		scopeNote:
			"Age-based percent estimated HRmax is an educational estimate, not a laboratory zone, lactate threshold, or personal prescription.",
	};
}

export type HeartRateResult =
	| { status: "available"; estimate: HeartRateEstimate }
	| { status: "clinician-override"; estimate: null }
	| { status: "suppressed"; reason: "missing-birthday" | "disabled" | "out-of-scope" };

export function heartRateGuidance(args: {
	birthday: string | null;
	onDate: string;
	mode: "generic-estimates" | "disabled" | "clinician-range";
}): HeartRateResult {
	if (args.mode === "disabled") {
		return { status: "suppressed", reason: "disabled" };
	}
	if (args.mode === "clinician-range") {
		return { status: "clinician-override", estimate: null };
	}
	if (!args.birthday) {
		return { status: "suppressed", reason: "missing-birthday" };
	}
	if (recommendationScope(args.birthday, args.onDate) !== "in-scope") {
		return { status: "suppressed", reason: "out-of-scope" };
	}
	return {
		status: "available",
		estimate: estimatedHeartRate(ageOnDate(args.birthday, args.onDate)),
	};
}

export function moderateEquivalentMinutes(segments: readonly CardioSegmentActual[]): number {
	let total = 0;
	for (const segment of segments) {
		if (segment.intensity === "moderate") {
			total += segment.actualMinutes;
		} else if (segment.intensity === "vigorous") {
			total += 2 * segment.actualMinutes;
		}
	}
	return total;
}

export function measurementWarnings(kind: MeasurementKind, value: number): Warning[] {
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error("invalid_measurement");
	}
	const bounds =
		kind === "height"
			? {
					absMin: HEIGHT_ABS_MIN,
					absMax: HEIGHT_ABS_MAX,
					warnMin: HEIGHT_WARN_MIN,
					warnMax: HEIGHT_WARN_MAX,
					unit: "cm",
				}
			: {
					absMin: WEIGHT_ABS_MIN,
					absMax: WEIGHT_ABS_MAX,
					warnMin: WEIGHT_WARN_MIN,
					warnMax: WEIGHT_WARN_MAX,
					unit: "kg",
				};
	if (value < bounds.absMin || value > bounds.absMax) {
		throw new Error("implausible_measurement");
	}
	if (value < bounds.warnMin || value > bounds.warnMax) {
		return [
			{
				code: "plausibility",
				message: `Recorded ${kind} ${value} ${bounds.unit} is stored unrounded; confirm it is correct.`,
			},
		];
	}
	return [];
}

export function assertFinitePositive(value: number): void {
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error("invalid_measurement");
	}
}

export function profileReadiness(
	profile: ProfileRecord | null,
	measurements: readonly MeasurementRecord[],
	onDate: string,
): ProfileReadiness {
	const hasHeight = measurements.some((row) => row.kind === "height");
	const hasWeight = measurements.some((row) => row.kind === "weight");
	if (!profile) {
		return {
			hasProfile: false,
			hasBirthday: false,
			hasHeight,
			hasWeight,
			recommendationScope: "unknown-age",
			guidance: "unavailable",
		};
	}
	const scope = recommendationScope(profile.birthday, onDate);
	let guidance: ProfileReadiness["guidance"] = "unavailable";
	if (profile.guidance.mode === "disabled") {
		guidance = "disabled";
	} else if (profile.guidance.mode === "clinician-range") {
		guidance = "clinician-override";
	} else if (profile.birthday && scope === "in-scope") {
		guidance = "available";
	}
	return {
		hasProfile: true,
		hasBirthday: profile.birthday !== null,
		hasHeight,
		hasWeight,
		recommendationScope: scope,
		guidance,
	};
}

export function sessionActualCardioMinutes(session: SessionRecord): number | null {
	if (!session.actual) {
		return null;
	}
	return session.actual.cardioSegments.reduce((sum, segment) => sum + segment.actualMinutes, 0);
}

export function deriveProgress(args: {
	from: string;
	to: string;
	measurements: readonly MeasurementRecord[];
	sessions: readonly SessionRecord[];
}): GetProgressResponse {
	const heights = args.measurements.filter((row) => row.kind === "height");
	const measurements: ProgressMeasurement[] = args.measurements
		.filter((row) => row.effectiveDate >= args.from && row.effectiveDate <= args.to)
		.sort((left, right) => compareDateOnly(left.effectiveDate, right.effectiveDate))
		.map((row) => {
			if (row.kind !== "weight") {
				return {
					id: row.id,
					kind: row.kind,
					effectiveDate: row.effectiveDate,
					value: row.value,
					bmi: null,
					displayedBmi: null,
				};
			}
			const derived = bmiForWeight(row, heights);
			return {
				id: row.id,
				kind: row.kind,
				effectiveDate: row.effectiveDate,
				value: row.value,
				bmi: derived?.bmi ?? null,
				displayedBmi: derived?.displayedBmi ?? null,
			};
		});
	const inRange = args.sessions.filter(
		(session) => session.localDate >= args.from && session.localDate <= args.to,
	);
	const progressSessions = inRange.map((session) => ({
		id: session.id,
		localDate: session.localDate,
		status: session.status,
		actualCardioMinutes: sessionActualCardioMinutes(session),
		moderateEquivalentMinutes: session.actual
			? moderateEquivalentMinutes(session.actual.cardioSegments)
			: 0,
	}));
	const weeks = new Map<string, WeeklyTotal>();
	for (const session of inRange) {
		if (session.status === "draft") {
			continue;
		}
		const weekStart = mondayOfWeek(session.localDate);
		const current = weeks.get(weekStart) ?? {
			weekStart,
			moderateEquivalentMinutes: 0,
			actualModerateMinutes: 0,
			actualVigorousMinutes: 0,
			strengthSessions: 0,
			completedSessions: 0,
		};
		if (session.actual) {
			for (const segment of session.actual.cardioSegments) {
				if (segment.intensity === "moderate") {
					current.actualModerateMinutes += segment.actualMinutes;
				}
				if (segment.intensity === "vigorous") {
					current.actualVigorousMinutes += segment.actualMinutes;
				}
			}
		}
		const hasStrength = session.actual?.exercises.some((exercise) =>
			exercise.sets.some((set) => set.status === "performed"),
		);
		if (session.status === "completed" && hasStrength) {
			current.strengthSessions += 1;
		}
		if (session.status === "completed") {
			current.completedSessions += 1;
		}
		weeks.set(weekStart, current);
	}
	for (const total of weeks.values()) {
		total.moderateEquivalentMinutes = total.actualModerateMinutes + 2 * total.actualVigorousMinutes;
	}
	return {
		from: args.from,
		to: args.to,
		measurements,
		sessions: progressSessions,
		weeklyTotals: [...weeks.values()].sort((left, right) =>
			compareDateOnly(left.weekStart, right.weekStart),
		),
	};
}

export function affectedBmiDates(
	deleted: MeasurementRecord,
	remaining: readonly MeasurementRecord[],
): string[] {
	if (deleted.kind !== "height") {
		return [];
	}
	const heights = remaining.filter((row) => row.kind === "height");
	const weights = remaining.filter((row) => row.kind === "weight");
	const dates: string[] = [];
	for (const weight of weights) {
		const before = heightForWeightDate(weight.effectiveDate, [...heights, deleted]);
		const after = heightForWeightDate(weight.effectiveDate, heights);
		if (before?.id === deleted.id && before?.id !== after?.id) {
			dates.push(weight.effectiveDate);
		}
	}
	return dates.sort();
}
