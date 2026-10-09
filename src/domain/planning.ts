import { exercisesForEquipment, getExercise } from "../data/exercises";
import {
	ALGORITHM_VERSION,
	CATALOG_VERSION,
	type CardioIntensity,
	type CardioSegmentTarget,
	type PlanInput,
	type PlanPreview,
	type PlanRationale,
	type SessionBlockTarget,
	type SessionTarget,
	type StrengthExerciseId,
	type StrengthExerciseTarget,
	type WeeklySlot,
	type WorkingSetTarget,
} from "./contracts";
import { WEEKDAY_LABELS, WEEKDAYS, type Weekday, weekdayIndex } from "./dates";
import { stableUuid } from "./hash";

const PREP_DEFAULT = 8;
const PREP_SHORT = 5;
const RECOVERY_DEFAULT = 5;
const RECOVERY_SHORT = 3;
const CARDIO_OPTIONAL = 12;
const WORK_SET_SECONDS = 30;
const WARMUP_SET_SECONDS = 20;
const WARMUP_REST_SECONDS = 60;
const TRANSITION_SECONDS = 45;
const FULL_BODY_A: StrengthExerciseId[] = [
	"goblet-squat",
	"romanian-deadlift",
	"chest-press",
	"cable-row",
];
const FULL_BODY_B: StrengthExerciseId[] = [
	"goblet-squat",
	"romanian-deadlift",
	"shoulder-press",
	"lat-pulldown",
];

export type PlanPreviewResult = {
	preview: PlanPreview | null;
	limitations: string[];
};

export function previewPlan(input: PlanInput): PlanPreviewResult {
	if (input.cardioOnlyWeekdays.length > input.weeklyFrequency) {
		return {
			preview: null,
			limitations: ["纯有氧天数不能超过每周训练频次。"],
		};
	}
	const limitations: string[] = [];
	const rationale = emptyRationale();
	const available = exercisesForEquipment(input.equipmentIds);
	if (available.length === 0) {
		limitations.push("现有器械不匹配动作库中的力量训练，本次只能安排有氧。");
	}
	const days = pickDays(input);
	if (days.length === 0) {
		return { preview: null, limitations: ["暂时无法安排训练日，请调整频次和日期。"] };
	}
	const reservedCardio = new Set(uniqueWeekdays(input.cardioOnlyWeekdays));
	const strengthCount = plannedStrengthCount(
		days.length,
		input.goalPreference,
		reservedCardio,
		days,
	);
	const strengthDays = placeStrengthDays(days, strengthCount, reservedCardio);
	if (input.weeklyFrequency <= 2) {
		rationale.explanations.push("每周少于三次时，可能无法让所有主要肌群都得到每周两次训练。");
	}
	if (strengthDays.length < 2) {
		rationale.coverageGaps.push("本周力量训练不足两次。");
	}
	if (
		strengthDays.some((day, index) =>
			strengthDays.slice(index + 1).some((other) => circularDistance(day, other) < 2),
		)
	) {
		rationale.compromises.push(
			"所选日期中有相邻的力量训练日，请预留恢复时间，按状态调整日期或强度。",
		);
	}
	if (reservedCardio.size >= days.length) {
		rationale.explanations.push("所有训练日都已预留为纯有氧，本次不安排力量训练。");
	}
	const slots: WeeklySlot[] = [];
	for (const weekday of days) {
		if (reservedCardio.has(weekday) || !strengthDays.includes(weekday)) {
			const kind =
				reservedCardio.has(weekday) || input.goalPreference === "endurance-first"
					? "cardio"
					: "recovery";
			const isRecovery = kind === "recovery" && !reservedCardio.has(weekday) && days.length >= 5;
			slots.push(
				buildCardioSlot({
					input,
					weekday,
					kind: isRecovery ? "recovery" : "cardio",
					limitations,
					rationale,
				}),
			);
			continue;
		}
		const emphasis = strengthDays.indexOf(weekday) % 2 === 0 ? "full-body-a" : "full-body-b";
		slots.push(
			buildStrengthSlot({
				input,
				weekday,
				emphasis,
				availableIds: available.map((row) => row.id),
				limitations,
				rationale,
			}),
		);
	}
	if (slots.some((slot) => slot.kind === "strength") === false && available.length > 0) {
		rationale.coverageGaps.push("预留纯有氧训练日后，剩余日期未安排力量训练。");
	}
	const preview: PlanPreview = {
		algorithmVersion: ALGORITHM_VERSION,
		catalogVersion: CATALOG_VERSION,
		input,
		template: { slots },
		rationale,
		limitations,
	};
	return { preview, limitations };
}

function emptyRationale(): PlanRationale {
	return { explanations: [], compromises: [], unfilledRequirements: [], coverageGaps: [] };
}

function uniqueWeekdays(days: readonly Weekday[]): Weekday[] {
	const present = new Set(days);
	return WEEKDAYS.filter((day) => present.has(day));
}

function pickDays(input: PlanInput): Weekday[] {
	const preferred = uniqueWeekdays(input.preferredWeekdays);
	const cardioOnly = uniqueWeekdays(input.cardioOnlyWeekdays);
	const pool = preferred.length > 0 ? preferred : [...WEEKDAYS];
	const selected: Weekday[] = [];
	for (const day of cardioOnly) {
		if (!selected.includes(day)) {
			selected.push(day);
		}
	}
	for (const day of pool) {
		if (selected.length >= input.weeklyFrequency) {
			break;
		}
		if (!selected.includes(day)) {
			selected.push(day);
		}
	}
	for (const day of WEEKDAYS) {
		if (selected.length >= input.weeklyFrequency) {
			break;
		}
		if (!selected.includes(day)) {
			selected.push(day);
		}
	}
	return WEEKDAYS.filter((day) => selected.includes(day));
}

function plannedStrengthCount(
	slotCount: number,
	goal: PlanInput["goalPreference"],
	reservedCardio: Set<Weekday>,
	days: readonly Weekday[],
): number {
	const open = days.filter((day) => !reservedCardio.has(day)).length;
	let desired = 2;
	if (slotCount === 1) {
		desired = goal === "strength-first" ? 1 : 0;
	} else if (slotCount === 2) {
		desired = 2;
	} else if (slotCount === 3) {
		desired = goal === "strength-first" ? 3 : 2;
	} else if (slotCount === 4) {
		desired = 2;
	} else {
		desired = goal === "strength-first" ? 3 : 2;
	}
	return Math.min(desired, open);
}

function placeStrengthDays(
	days: readonly Weekday[],
	count: number,
	reserved: Set<Weekday>,
): Weekday[] {
	const candidates = days.filter((day) => !reserved.has(day));
	const chosen: Weekday[] = [];
	for (const day of candidates) {
		if (chosen.length >= count) {
			break;
		}
		if (chosen.some((existing) => circularDistance(existing, day) < 2)) {
			continue;
		}
		chosen.push(day);
	}
	for (const day of candidates) {
		if (chosen.length >= count) {
			break;
		}
		if (!chosen.includes(day)) {
			chosen.push(day);
		}
	}
	return chosen;
}

function circularDistance(left: Weekday, right: Weekday): number {
	const diff = Math.abs(weekdayIndex(left) - weekdayIndex(right));
	return Math.min(diff, 7 - diff);
}

function buildStrengthSlot(args: {
	input: PlanInput;
	weekday: Weekday;
	emphasis: "full-body-a" | "full-body-b";
	availableIds: StrengthExerciseId[];
	limitations: string[];
	rationale: PlanRationale;
}): WeeklySlot {
	const wanted = args.emphasis === "full-body-a" ? FULL_BODY_A : FULL_BODY_B;
	const selected = wanted.filter((id) => args.availableIds.includes(id));
	for (const id of wanted) {
		if (!args.availableIds.includes(id)) {
			const exercise = getExercise(id);
			args.rationale.unfilledRequirements.push(`${exercise.name}所需器械不可用，暂未纳入计划。`);
		}
	}
	if (selected.length === 0) {
		args.limitations.push(`${WEEKDAY_LABELS[args.weekday]}无法安排匹配器械的力量动作。`);
		return buildCardioSlot({
			input: args.input,
			weekday: args.weekday,
			kind: "cardio",
			limitations: args.limitations,
			rationale: args.rationale,
		});
	}
	const budget = args.input.sessionTimeBudgetMinutes;
	const short = budget < 45;
	const prep = short ? PREP_SHORT : PREP_DEFAULT;
	const recovery = short ? RECOVERY_SHORT : RECOVERY_DEFAULT;
	let includeCardio = !short;
	let exerciseIds = selected.slice(0, 4);
	let target = composeStrengthTarget({
		input: args.input,
		weekday: args.weekday,
		emphasis: args.emphasis,
		exerciseIds,
		prep,
		recovery,
		includeCardio,
	});
	while (sessionMinutes(target) > budget && exerciseIds.length > 1) {
		if (includeCardio) {
			includeCardio = false;
			args.rationale.compromises.push("为在预计时间内完成力量训练，已移除可选有氧部分。");
		} else {
			exerciseIds = exerciseIds.slice(0, -1);
			args.rationale.compromises.push("为控制单次训练时长，已减少一个力量动作。");
		}
		target = composeStrengthTarget({
			input: args.input,
			weekday: args.weekday,
			emphasis: args.emphasis,
			exerciseIds,
			prep,
			recovery,
			includeCardio,
		});
	}
	if (sessionMinutes(target) > budget) {
		args.limitations.push(`${WEEKDAY_LABELS[args.weekday]}的力量训练仍超出时间预算，请调整。`);
	}
	return {
		weekday: args.weekday,
		kind: "strength",
		emphasis: args.emphasis,
		timeBudgetMinutes: budget,
		target,
	};
}

function buildCardioSlot(args: {
	input: PlanInput;
	weekday: Weekday;
	kind: "cardio" | "recovery";
	limitations: string[];
	rationale: PlanRationale;
}): WeeklySlot {
	const budget = args.input.sessionTimeBudgetMinutes;
	const prep = Math.min(PREP_SHORT, Math.max(3, Math.floor(budget * 0.12)));
	const recovery = Math.min(RECOVERY_DEFAULT, Math.max(3, Math.floor(budget * 0.12)));
	const main = Math.max(1, budget - prep - recovery);
	const intensity: Exclude<CardioIntensity, "unknown"> =
		args.kind === "recovery" ? "easy" : "moderate";
	const seed = `${args.weekday}:${args.kind}:${canonicalizeSeed(args.input)}`;
	const target: SessionTarget = {
		catalogVersion: CATALOG_VERSION,
		algorithmVersion: ALGORITHM_VERSION,
		timeBudgetMinutes: budget,
		emphasis: args.kind,
		blocks: [
			block("preparation", prep, [], cardioSegment(`${seed}:prep`, "preparation", prep, "easy")),
			block("cardio", main, [], cardioSegment(`${seed}:main`, "main", main, intensity)),
			block(
				"recovery",
				recovery,
				[],
				cardioSegment(`${seed}:recovery`, "recovery", recovery, "easy"),
			),
		],
	};
	if (args.kind === "recovery") {
		args.rationale.explanations.push(`${WEEKDAY_LABELS[args.weekday]}安排轻松有氧，以恢复为主。`);
	}
	return {
		weekday: args.weekday,
		kind: args.kind,
		emphasis: args.kind,
		timeBudgetMinutes: budget,
		target,
	};
}

function composeStrengthTarget(args: {
	input: PlanInput;
	weekday: Weekday;
	emphasis: "full-body-a" | "full-body-b";
	exerciseIds: StrengthExerciseId[];
	prep: number;
	recovery: number;
	includeCardio: boolean;
}): SessionTarget {
	const seed = `${args.weekday}:${args.emphasis}:${canonicalizeSeed(args.input)}`;
	const exercises = args.exerciseIds.map((id, index) =>
		strengthTarget(id, `${seed}:${id}:${index}`),
	);
	const strengthMinutes = Math.max(1, estimateStrengthMinutes(exercises));
	const cardioMinutes = args.includeCardio ? CARDIO_OPTIONAL : 0;
	const blocks: SessionBlockTarget[] = [
		block(
			"preparation",
			args.prep,
			[],
			cardioSegment(`${seed}:prep`, "preparation", args.prep, "easy"),
		),
		block("strength", strengthMinutes, exercises, null),
	];
	if (args.includeCardio) {
		blocks.push(
			block(
				"cardio",
				cardioMinutes,
				[],
				cardioSegment(`${seed}:cardio`, "main", cardioMinutes, "moderate"),
			),
		);
	}
	blocks.push(
		block(
			"recovery",
			args.recovery,
			[],
			cardioSegment(`${seed}:recovery`, "recovery", args.recovery, "easy"),
		),
	);
	if (args.input.goalPreference === "endurance-first") {
		const strength = blocks[1];
		const cardio = blocks[2]?.kind === "cardio" ? blocks[2] : null;
		if (strength && cardio) {
			blocks[1] = cardio;
			blocks[2] = strength;
		}
	}
	return {
		catalogVersion: CATALOG_VERSION,
		algorithmVersion: ALGORITHM_VERSION,
		timeBudgetMinutes: args.input.sessionTimeBudgetMinutes,
		emphasis: args.emphasis,
		blocks,
	};
}

function strengthTarget(id: StrengthExerciseId, seed: string): StrengthExerciseTarget {
	const exercise = getExercise(id);
	const workingSets: WorkingSetTarget[] = [1, 2].map((setIndex) => ({
		id: stableUuid(`${seed}:set:${setIndex}`),
		setIndex,
		repsLow: 8,
		repsHigh: 12,
		rirTarget: 2,
		loadKg: null,
	}));
	return {
		id: stableUuid(`${seed}:exercise`),
		exerciseId: id,
		name: exercise.name,
		catalogVersion: CATALOG_VERSION,
		equipmentId: exercise.equipmentId,
		loadConvention: exercise.loadConvention,
		warmUpSetCount: 1,
		workingSets,
		restSeconds: exercise.restSecondsDefault,
	};
}

function cardioSegment(
	seed: string,
	role: CardioSegmentTarget["role"],
	minutes: number,
	intensity: Exclude<CardioIntensity, "unknown">,
): CardioSegmentTarget {
	return {
		id: stableUuid(seed),
		role,
		modality: "cycling",
		plannedMinutes: minutes,
		plannedIntensity: intensity,
	};
}

function block(
	kind: SessionBlockTarget["kind"],
	durationMinutes: number,
	exercises: StrengthExerciseTarget[],
	cardio: CardioSegmentTarget | null,
): SessionBlockTarget {
	return { kind, durationMinutes, exercises, cardio };
}

export function estimateStrengthMinutes(exercises: readonly StrengthExerciseTarget[]): number {
	let seconds = 0;
	exercises.forEach((exercise, index) => {
		if (index > 0) {
			seconds += TRANSITION_SECONDS;
		}
		seconds += exercise.warmUpSetCount * (WARMUP_SET_SECONDS + WARMUP_REST_SECONDS);
		seconds += exercise.workingSets.length * (WORK_SET_SECONDS + exercise.restSeconds);
	});
	return Math.max(1, Math.ceil(seconds / 60));
}

function sessionMinutes(target: SessionTarget): number {
	return target.blocks.reduce((sum, block) => sum + block.durationMinutes, 0);
}

function canonicalizeSeed(input: PlanInput): string {
	return [
		input.reviewMonth,
		input.weeklyFrequency,
		input.preferredWeekdays.join(","),
		input.cardioOnlyWeekdays.join(","),
		input.sessionTimeBudgetMinutes,
		input.goalPreference,
		input.experience,
		input.equipmentIds.join(","),
		input.timezone,
	].join("|");
}

export function isReviewDue(localDate: string, latestReviewMonth: string | null): boolean {
	const currentMonth = localDate.slice(0, 7);
	if (!latestReviewMonth) {
		return true;
	}
	return currentMonth > latestReviewMonth;
}
