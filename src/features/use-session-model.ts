import { useEffect, useState } from "react";
import { getExercise } from "../data/exercises";
import type {
	CardioIntensity,
	SessionRecord,
	SessionTarget,
	StrengthExerciseId,
	WorkingSetActual,
} from "../domain/contracts";
import { estimateStrengthMinutes } from "../domain/planning";
import { emptyActual } from "../domain/session";
import { actualFromTarget } from "./use-rhino-model";

export function useSessionModel(session: SessionRecord) {
	const [target, setTarget] = useState<SessionTarget>(() => structuredClone(session.target));
	const [actual, setActual] = useState(() =>
		structuredClone(session.actual ?? emptyActual(session.target)),
	);
	const [dirty, setDirty] = useState(false);
	const [restUntil, setRestUntil] = useState<number | null>(null);
	const [restSeconds, setRestSeconds] = useState(0);
	useEffect(() => {
		const warn = (event: BeforeUnloadEvent) => {
			if (dirty) event.preventDefault();
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);
	useEffect(() => {
		if (restUntil === null) return;
		const tick = () => setRestSeconds(Math.max(0, Math.ceil((restUntil - Date.now()) / 1000)));
		tick();
		const interval = window.setInterval(tick, 500);
		return () => window.clearInterval(interval);
	}, [restUntil]);
	function changeTarget(next: SessionTarget) {
		for (const block of next.blocks) {
			if (block.kind === "strength")
				block.durationMinutes = estimateStrengthMinutes(block.exercises);
		}
		const duration = next.blocks.reduce((sum, block) => sum + block.durationMinutes, 0);
		if (duration > 180) return;
		next.timeBudgetMinutes = Math.max(20, duration);
		setTarget(next);
		setActual(emptyActual(next));
		setDirty(true);
	}
	function updateExercise(index: number, id: StrengthExerciseId) {
		const next = structuredClone(target);
		const exercises = next.blocks.flatMap((block) => block.exercises);
		const exercise = getExercise(id);
		Object.assign(exercises[index], {
			exerciseId: id,
			name: exercise.name,
			equipmentId: exercise.equipmentId,
			loadConvention: exercise.loadConvention,
			restSeconds: exercise.restSecondsDefault,
		});
		changeTarget(next);
	}
	function setCount(index: number, count: number) {
		if (!Number.isInteger(count) || count < 1 || count > 8) return;
		const next = structuredClone(target);
		const exercise = next.blocks.flatMap((block) => block.exercises)[index];
		exercise.workingSets = Array.from(
			{ length: count },
			(_, i) =>
				exercise.workingSets[i] ?? {
					...exercise.workingSets[0],
					id: crypto.randomUUID(),
					setIndex: i + 1,
				},
		);
		changeTarget(next);
	}
	function setReps(index: number, reps: number) {
		if (!Number.isInteger(reps) || reps < 1 || reps > 30) return;
		const next = structuredClone(target);
		for (const set of next.blocks.flatMap((block) => block.exercises)[index].workingSets) {
			set.repsLow = reps;
			set.repsHigh = reps;
		}
		changeTarget(next);
	}
	function updateSet(exerciseId: string, setId: string, patch: Partial<WorkingSetActual>) {
		setActual((previous) => ({
			...previous,
			completedAsPlanned: false,
			exercises: previous.exercises.map((exercise) =>
				exercise.id !== exerciseId
					? exercise
					: {
							...exercise,
							sets: exercise.sets.map((set) => (set.id !== setId ? set : { ...set, ...patch })),
						},
			),
		}));
		setDirty(true);
	}
	function updateCardio(id: string, minutes: number) {
		setActual((previous) => ({
			...previous,
			completedAsPlanned: false,
			cardioSegments: previous.cardioSegments.map((segment) =>
				segment.id === id ? { ...segment, actualMinutes: minutes } : segment,
			),
		}));
		setDirty(true);
	}
	function setCardioIntensity(id: string, intensity: CardioIntensity) {
		setActual((previous) => ({
			...previous,
			completedAsPlanned: false,
			cardioSegments: previous.cardioSegments.map((segment) =>
				segment.id === id ? { ...segment, intensity } : segment,
			),
		}));
		setDirty(true);
	}
	function setCardioTarget(id: string, minutes: number) {
		if (!Number.isInteger(minutes) || minutes < 1 || minutes > 150) return;
		const next = structuredClone(target);
		const block = next.blocks.find((item) => item.cardio?.id === id);
		if (!block?.cardio) return;
		const total =
			next.blocks.reduce((sum, item) => sum + item.durationMinutes, 0) -
			block.durationMinutes +
			minutes;
		if (total > 180) return;
		block.cardio.plannedMinutes = minutes;
		block.durationMinutes = minutes;
		next.timeBudgetMinutes = Math.max(20, total);
		changeTarget(next);
	}
	function performedAsPlanned() {
		setActual(actualFromTarget(target));
		setDirty(true);
	}
	return {
		target,
		actual,
		dirty,
		restSeconds,
		updateExercise,
		setCount,
		setReps,
		updateSet,
		updateCardio,
		setCardioIntensity,
		setCardioTarget,
		performedAsPlanned,
		setDirty,
		startRest: (seconds: number) => setRestUntil(Date.now() + seconds * 1000),
		setActual: (next: typeof actual) => {
			setActual(next);
			setDirty(true);
		},
	};
}
