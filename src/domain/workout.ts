import type {
	CardioSegmentTarget,
	SessionActual,
	SessionTarget,
	StrengthExerciseTarget,
	WorkingSetTarget,
} from "./contracts";

export type WorkoutStep =
	| { kind: "strength"; id: string; exercise: StrengthExerciseTarget; set: WorkingSetTarget }
	| { kind: "cardio"; id: string; cardio: CardioSegmentTarget };

export function workoutSteps(target: SessionTarget): WorkoutStep[] {
	return target.blocks.flatMap((block): WorkoutStep[] =>
		block.cardio
			? [{ kind: "cardio", id: block.cardio.id, cardio: block.cardio }]
			: block.exercises.flatMap((exercise) =>
					exercise.workingSets.map((set) => ({
						kind: "strength" as const,
						id: set.id,
						exercise,
						set,
					})),
				),
	);
}

export function stepDone(step: WorkoutStep, actual: SessionActual): boolean {
	if (step.kind === "strength") {
		const status = actual.exercises
			.find((item) => item.id === step.exercise.id)
			?.sets.find((set) => set.id === step.id)?.status;
		return status === "performed" || status === "skipped";
	}
	return (
		actual.timing?.steps.some((item) => item.id === step.id && item.endedAt !== null) === true ||
		actual.cardioSegments.some((item) => item.id === step.id && item.actualMinutes > 0)
	);
}

export function elapsedSeconds(
	start: string | undefined,
	end: string | null | undefined,
	now: number,
): number {
	return start
		? Math.max(0, Math.floor(((end ? Date.parse(end) : now) - Date.parse(start)) / 1000))
		: 0;
}

export function clockLabel(seconds: number): string {
	const minutes = Math.floor(seconds / 60);
	return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function startStep(actual: SessionActual, id: string, now: string): SessionActual {
	const timing = actual.timing ?? { startedAt: now, endedAt: null, steps: [] };
	if (timing.endedAt || timing.steps.some((step) => step.endedAt === null)) return actual;
	return {
		...actual,
		timing: {
			...timing,
			steps: [
				...timing.steps.filter((step) => step.id !== id),
				{ id, startedAt: now, endedAt: null },
			],
		},
	};
}

export function finishStep(
	actual: SessionActual,
	step: WorkoutStep,
	now: string,
	values: {
		reps: number;
		loadKg: number | null;
		minutes: number | null;
		intensity: CardioSegmentTarget["plannedIntensity"] | "unknown";
	},
	skipped = false,
): SessionActual {
	const next = structuredClone(actual);
	next.completedAsPlanned = false;
	const entry = next.timing?.steps.find((item) => item.id === step.id);
	if (entry) entry.endedAt = now;
	if (step.kind === "strength") {
		const set = next.exercises
			.find((item) => item.id === step.exercise.id)
			?.sets.find((item) => item.id === step.id);
		if (set)
			Object.assign(set, {
				status: skipped ? "skipped" : "performed",
				reps: skipped ? null : values.reps,
				loadKg: skipped ? null : values.loadKg,
			});
	} else {
		const segment = next.cardioSegments.find((item) => item.id === step.id);
		if (segment)
			Object.assign(segment, {
				actualMinutes: skipped
					? 0
					: (values.minutes ?? Math.min(180, elapsedSeconds(entry?.startedAt, now, 0) / 60)),
				intensity: skipped ? "unknown" : values.intensity,
			});
	}
	return next;
}

export function finishWorkout(actual: SessionActual, now: string): SessionActual {
	return {
		...actual,
		...(actual.timing
			? {
					timing: {
						...actual.timing,
						endedAt: now,
						steps: actual.timing.steps.map((step) => ({ ...step, endedAt: step.endedAt ?? now })),
					},
				}
			: {}),
	};
}

export function initialLoad(step: WorkoutStep, actual: SessionActual): number | null {
	if (step.kind !== "strength") return null;
	const previous = actual.exercises
		.find((item) => item.id === step.exercise.id)
		?.sets.filter((set) => set.status === "performed" && set.loadKg !== null)
		.at(-1);
	return previous?.loadKg ?? step.set.loadKg ?? null;
}
