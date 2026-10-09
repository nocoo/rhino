import type {
	SessionActual,
	SessionStatus,
	SessionTarget,
	StrengthExerciseTarget,
	WorkingSetActual,
} from "./contracts";
import { ApiError } from "./contracts";

const TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
	draft: ["draft", "active", "abandoned"],
	active: ["active", "completed", "abandoned"],
	completed: ["completed"],
	abandoned: ["abandoned"],
};

export function canTransition(from: SessionStatus | null, to: SessionStatus): boolean {
	if (from === null) {
		return to === "draft" || to === "active";
	}
	return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: SessionStatus | null, to: SessionStatus): void {
	if (!canTransition(from, to)) {
		throw new ApiError(409, "conflict", `Session cannot move from ${from ?? "new"} to ${to}`);
	}
}

export function emptyActual(target: SessionTarget): SessionActual {
	return {
		exercises: target.blocks.flatMap((block) =>
			block.exercises.map((exercise) => ({
				id: exercise.id,
				sets: exercise.workingSets.map((set) => ({
					id: set.id,
					status: "not-recorded" as const,
					reps: null,
					loadKg: null,
					rir: null,
				})),
			})),
		),
		cardioSegments: target.blocks.flatMap((block) =>
			block.cardio
				? [
						{
							id: block.cardio.id,
							role: block.cardio.role,
							actualMinutes: 0,
							intensity: "unknown" as const,
						},
					]
				: [],
		),
		painFlag: false,
		perceivedEffort: null,
		completedAsPlanned: false,
		notes: "",
	};
}

export function validateSessionActual(
	target: SessionTarget,
	actual: SessionActual | null,
	status: SessionStatus,
): void {
	const targetExercises = target.blocks.flatMap((block) => block.exercises);
	const targetCardio = target.blocks.flatMap((block) => (block.cardio ? [block.cardio] : []));
	if (
		new Set(targetExercises.map((item) => item.id)).size !== targetExercises.length ||
		new Set(targetCardio.map((item) => item.id)).size !== targetCardio.length
	) {
		throw new ApiError(400, "validation_failed", "Target ids must be unique");
	}
	for (const block of target.blocks) {
		const role = block.kind === "cardio" ? "main" : block.kind;
		if (
			block.kind === "strength"
				? block.cardio !== null || block.exercises.length === 0
				: block.exercises.length !== 0 ||
					block.cardio?.role !== role ||
					block.cardio.plannedMinutes !== block.durationMinutes
		) {
			throw new ApiError(
				400,
				"validation_failed",
				"Block content must match its kind and duration",
			);
		}
	}
	for (const exercise of targetExercises) {
		if (
			new Set(exercise.workingSets.map((set) => set.id)).size !== exercise.workingSets.length ||
			exercise.workingSets.some(
				(set, index) => set.repsLow > set.repsHigh || set.setIndex !== index + 1,
			)
		) {
			throw new ApiError(
				400,
				"validation_failed",
				"Target sets require unique ids, consecutive indexes and valid repetition ranges",
			);
		}
	}
	if (status === "completed" && !actual) {
		throw new ApiError(400, "validation_failed", "Completed sessions require an actual log");
	}
	if (!actual) {
		return;
	}
	const exerciseTargets = new Map(
		target.blocks.flatMap((block) => block.exercises).map((exercise) => [exercise.id, exercise]),
	);
	const cardioTargets = new Map(targetCardio.map((segment) => [segment.id, segment]));
	if (
		actual.exercises.length !== exerciseTargets.size ||
		new Set(actual.exercises.map((exercise) => exercise.id)).size !== actual.exercises.length
	) {
		throw new ApiError(400, "validation_failed", "Actual exercises must match the target snapshot");
	}
	for (const exercise of actual.exercises) {
		const targetExercise = exerciseTargets.get(exercise.id);
		if (!targetExercise) {
			throw new ApiError(400, "validation_failed", "Actual log contains an unknown exercise id");
		}
		assertSets(targetExercise, exercise.sets);
	}
	const actualCardioIds = new Set(actual.cardioSegments.map((segment) => segment.id));
	if (actualCardioIds.size !== actual.cardioSegments.length) {
		throw new ApiError(400, "validation_failed", "Cardio segment ids must be unique");
	}
	for (const segment of actual.cardioSegments) {
		if (cardioTargets.get(segment.id)?.role !== segment.role) {
			throw new ApiError(400, "validation_failed", "Actual log contains an unknown cardio segment");
		}
	}
	if (status === "completed" && actual.completedAsPlanned) {
		const allPerformed = actual.exercises.every((exercise) =>
			exercise.sets.every((set) => set.status === "performed"),
		);
		const allCardio =
			actual.cardioSegments.length === cardioTargets.size &&
			actual.cardioSegments.every((segment) => {
				const planned = cardioTargets.get(segment.id);
				return (
					planned?.plannedMinutes === segment.actualMinutes &&
					planned.plannedIntensity === segment.intensity
				);
			});
		if (!allPerformed || !allCardio) {
			throw new ApiError(
				400,
				"validation_failed",
				"completedAsPlanned requires every working set and cardio segment to be performed",
			);
		}
	}
}

function assertSets(target: StrengthExerciseTarget, sets: WorkingSetActual[]): void {
	if (
		sets.length !== target.workingSets.length ||
		new Set(sets.map((set) => set.id)).size !== sets.length
	) {
		throw new ApiError(400, "validation_failed", "Actual sets must match the target snapshot");
	}
	const targetIds = new Set(target.workingSets.map((set) => set.id));
	for (const set of sets) {
		if (!targetIds.has(set.id)) {
			throw new ApiError(400, "validation_failed", "Actual log contains an unknown set id");
		}
		if (set.status === "performed") {
			if (set.reps === null) {
				throw new ApiError(400, "validation_failed", "Performed sets require recorded repetitions");
			}
		}
		if (set.status === "skipped" && set.reps !== null) {
			throw new ApiError(400, "validation_failed", "Skipped sets cannot record repetitions");
		}
	}
}

export type ProgressionSuggestion = {
	kind: "increase-load" | "hold" | "reduce" | "blocked";
	reason: string;
	nextLoadKg: number | null;
	nextRepsLow: number | null;
};

export type ComparableSet = {
	status: "performed" | "skipped" | "not-recorded";
	reps: number | null;
	rir: number | null;
	repsHigh: number;
};

export type ComparableSession = {
	exerciseId: string;
	variationKey: string;
	painFlag: boolean;
	workingSets: ComparableSet[];
};

export function suggestProgression(args: {
	exerciseId: string;
	variationKey: string;
	currentLoadKg: number | null;
	incrementKg: number;
	history: readonly ComparableSession[];
}): ProgressionSuggestion {
	const comparable = args.history.filter((session) => session.exerciseId === args.exerciseId);
	if (comparable.some((session) => session.variationKey !== args.variationKey)) {
		return { kind: "blocked", reason: "changed-variation", nextLoadKg: null, nextRepsLow: null };
	}
	if (comparable.some((session) => session.painFlag)) {
		return {
			kind: "reduce",
			reason: "pain-flag",
			nextLoadKg:
				args.currentLoadKg === null ? null : Math.max(0, args.currentLoadKg - args.incrementKg),
			nextRepsLow: 8,
		};
	}
	if (comparable.length < 2) {
		return {
			kind: "hold",
			reason: "insufficient-history",
			nextLoadKg: args.currentLoadKg,
			nextRepsLow: null,
		};
	}
	const lastTwo = comparable.slice(-2);
	for (const session of lastTwo) {
		if (session.workingSets.some((set) => set.status !== "performed")) {
			return { kind: "blocked", reason: "partial-sets", nextLoadKg: null, nextRepsLow: null };
		}
		if (session.workingSets.some((set) => set.rir === null)) {
			return { kind: "blocked", reason: "missing-effort", nextLoadKg: null, nextRepsLow: null };
		}
	}
	const reachedTop = lastTwo.every((session) =>
		session.workingSets.every((set) => (set.reps ?? 0) >= set.repsHigh),
	);
	if (!reachedTop) {
		return {
			kind: "hold",
			reason: "rep-range-open",
			nextLoadKg: args.currentLoadKg,
			nextRepsLow: null,
		};
	}
	if (args.currentLoadKg === null) {
		return { kind: "blocked", reason: "missing-load", nextLoadKg: null, nextRepsLow: null };
	}
	if (args.currentLoadKg > 0 && args.incrementKg / args.currentLoadKg > 0.15) {
		return {
			kind: "hold",
			reason: "increment-too-large",
			nextLoadKg: args.currentLoadKg,
			nextRepsLow: null,
		};
	}
	return {
		kind: "increase-load",
		reason: "two-sessions-at-top",
		nextLoadKg: args.currentLoadKg + args.incrementKg,
		nextRepsLow: 8,
	};
}
