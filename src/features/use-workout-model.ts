import { useEffect, useRef, useState } from "react";
import type { CardioIntensity, SessionActual, SessionRecord } from "../domain/contracts";
import { emptyActual } from "../domain/session";
import {
	elapsedSeconds,
	finishStep,
	finishWorkout,
	initialLoad,
	startStep,
	stepDone,
	workoutSteps,
} from "../domain/workout";
import type { RhinoModel } from "./use-rhino-model";
import { useSessionModel } from "./use-session-model";

type StepInput = {
	id: string | undefined;
	reps: number;
	loadKg: number | null;
	minutes: number | null;
	intensity: CardioIntensity;
};

export function useWorkoutModel(session: SessionRecord, model: RhinoModel, editing = false) {
	const editor = useSessionModel(session);
	const steps = workoutSteps(editor.target);
	const savedActual = session.actual ?? emptyActual(session.target);
	const runningStep = savedActual.timing?.steps.find((item) => item.endedAt === null);
	const step =
		steps.find((item) => item.id === runningStep?.id) ??
		steps.find((item) => !stepDone(item, savedActual));
	const entry = savedActual.timing?.steps.find(
		(item) => item.id === step?.id && item.endedAt === null,
	);
	const [now, setNow] = useState(Date.now);
	const [overview, setOverview] = useState(
		editing || (session.status === "active" && !session.actual?.timing),
	);
	const [input, setInput] = useState<StepInput | null>(null);
	const values: StepInput =
		input && input.id === step?.id
			? input
			: {
					id: step?.id,
					reps: step?.kind === "strength" ? step.set.repsHigh : 0,
					loadKg: step ? initialLoad(step, editor.actual) : null,
					minutes: null,
					intensity: "unknown",
				};
	const { reps, loadKg, minutes, intensity } = values;
	const saving = useRef(false);
	const pending = useRef<{ key: string; actual: SessionActual | null } | null>(null);
	const inputDirty = input !== null && input.id === step?.id;
	useEffect(() => {
		const warn = (event: BeforeUnloadEvent) => {
			if (inputDirty) event.preventDefault();
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [inputDirty]);
	useEffect(() => {
		if (session.status !== "active") return;
		const tick = () => setNow(Date.now());
		const timer = window.setInterval(tick, 250);
		window.addEventListener("focus", tick);
		return () => {
			window.clearInterval(timer);
			window.removeEventListener("focus", tick);
		};
	}, [session.status]);
	const totalSeconds = elapsedSeconds(
		editor.actual.timing?.startedAt,
		editor.actual.timing?.endedAt,
		now,
	);
	const stepSeconds = elapsedSeconds(entry?.startedAt, entry?.endedAt, now);
	const last = editor.actual.timing?.steps.at(-1);
	const previous = steps.find((item) => item.id === last?.id);
	const restSeconds =
		!entry && last?.endedAt && previous?.kind === "strength" && step
			? Math.max(0, previous.exercise.restSeconds - elapsedSeconds(last.endedAt, null, now))
			: 0;
	async function persist(
		action: string,
		makeActual: () => SessionActual | null,
		status: SessionRecord["status"] = "active",
	) {
		if (saving.current || model.busy) return false;
		saving.current = true;
		try {
			const key = JSON.stringify([
				session.version,
				action,
				status,
				editor.target,
				editor.actual,
				values,
			]);
			if (pending.current?.key !== key) pending.current = { key, actual: makeActual() };
			const saved = await model.saveSession(session, status, editor.target, pending.current.actual);
			if (saved) {
				pending.current = null;
				if (action === "record" || action === "skip" || action === "finish") setInput(null);
			}
			return !!saved;
		} finally {
			saving.current = false;
		}
	}
	async function begin() {
		await persist("begin", () => {
			const now = new Date().toISOString();
			const actual = emptyActual(editor.target);
			actual.timing = { startedAt: now, endedAt: null, steps: [] };
			return steps[0] ? startStep(actual, steps[0].id, now) : actual;
		});
	}
	async function startCurrent() {
		if (step)
			await persist("start", () => startStep(editor.actual, step.id, new Date().toISOString()));
	}
	async function record(skipped = false) {
		if (!step) return;
		await persist(skipped ? "skip" : "record", () => {
			const now = new Date().toISOString();
			const actual = entry ? editor.actual : startStep(editor.actual, step.id, now);
			return finishStep(actual, step, now, { reps, loadKg, minutes, intensity }, skipped);
		});
	}
	function adjust(patch: Partial<StepInput>) {
		setInput((previous) => ({
			...(previous && previous.id === values.id ? previous : values),
			...patch,
		}));
	}
	return {
		dirty: editor.dirty || inputDirty,
		editor,
		steps,
		step,
		entry,
		now,
		totalSeconds,
		stepSeconds,
		restSeconds,
		overview,
		setOverview,
		reps,
		loadKg,
		minutes,
		intensity,
		setReps: (value: number) => adjust({ reps: value }),
		setLoadKg: (value: number | null) => adjust({ loadKg: value }),
		setMinutes: (value: number) => adjust({ minutes: value }),
		setIntensity: (value: CardioIntensity) => adjust({ intensity: value }),
		begin,
		startCurrent,
		record,
		saveEdits: () =>
			persist(
				"edit",
				() => {
					const actual = structuredClone(editor.actual);
					const running = actual.timing?.steps.find((item) => item.endedAt === null);
					if (running && step && stepDone(step, actual)) running.endedAt = new Date().toISOString();
					return actual;
				},
				session.status,
			),
		saveDraft: () => persist("draft", () => null, "draft"),
		finish: () =>
			persist("finish", () => finishWorkout(editor.actual, new Date().toISOString()), "completed"),
	};
}
export type WorkoutModel = ReturnType<typeof useWorkoutModel>;
