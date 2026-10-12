import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type SessionActual,
	type SessionTarget,
	sessionActualSchema,
} from "../../../src/domain/contracts";
import { emptyActual, validateSessionActual } from "../../../src/domain/session";
import {
	clockLabel,
	elapsedSeconds,
	finishStep,
	finishWorkout,
	initialLoad,
	startStep,
	stepDone,
	workoutSteps,
} from "../../../src/domain/workout";
import { sessionTarget, uuid } from "../../helpers/fixtures";

afterEach(() => vi.useRealTimers());

const start = "2026-10-09T01:00:00.000Z";
const middle = "2026-10-09T01:01:00.000Z";
const end = "2026-10-09T01:02:00.000Z";
const required = <T>(value: T | null | undefined): T => {
	if (value == null) throw new Error("Missing fixture value");
	return value;
};
const input = {
	reps: 10,
	loadKg: 17.125,
	minutes: null,
	intensity: "moderate" as const,
};

function orderedTarget(): SessionTarget {
	const target = sessionTarget();
	const first = target.blocks[0]?.exercises[0];
	const cardioBlock = target.blocks[1];
	const firstSet = first?.workingSets[0];
	if (!first || !firstSet || !cardioBlock?.cardio) throw new Error("Missing fixture blocks");
	first.workingSets.push({ ...firstSet, id: uuid(), setIndex: 2 });
	const second = {
		...structuredClone(first),
		id: uuid(),
		workingSets: [
			{
				...firstSet,
				id: uuid(),
				setIndex: 1,
			},
		],
	};
	const firstBlock = required(target.blocks[0]);
	const laterBlock = { ...structuredClone(firstBlock), exercises: [second] };
	return { ...target, blocks: [firstBlock, cardioBlock, laterBlock] };
}

function timingActual(target: SessionTarget): SessionActual {
	const actual = emptyActual(target);
	const first = workoutSteps(target)[0];
	if (!first) throw new Error("Missing workout step");
	actual.timing = {
		startedAt: start,
		endedAt: null,
		steps: [{ id: first.id, startedAt: start, endedAt: null }],
	};
	return actual;
}

describe("workout step progression", () => {
	it("keeps block, exercise, set, and cardio order", () => {
		const target = orderedTarget();
		const steps = workoutSteps(target);
		expect(steps.map((step) => step.id)).toEqual([
			required(required(required(target.blocks[0]).exercises[0]).workingSets[0]).id,
			required(required(required(target.blocks[0]).exercises[0]).workingSets[1]).id,
			required(required(target.blocks[1]).cardio).id,
			required(required(required(target.blocks[2]).exercises[0]).workingSets[0]).id,
		]);
		expect(steps.map((step) => step.kind)).toEqual(["strength", "strength", "cardio", "strength"]);
	});

	it("does not infer performed work and marks only recorded work done", () => {
		const target = sessionTarget();
		const actual = emptyActual(target);
		const [strength, cardio] = workoutSteps(target);
		if (!strength || !cardio) throw new Error("Missing fixture steps");
		expect(stepDone(strength, actual)).toBe(false);
		expect(stepDone(cardio, actual)).toBe(false);
		const started = startStep(actual, cardio.id, start);
		expect(stepDone(cardio, started)).toBe(false);
		const finished = finishStep(started, cardio, end, input, true);
		expect(stepDone(cardio, finished)).toBe(true);
		expect(finished.exercises[0]?.sets[0]).toMatchObject({ status: "not-recorded", reps: null });
		expect(finished.cardioSegments[0]).toMatchObject({ actualMinutes: 0, intensity: "unknown" });
	});
});

describe("workout timing and actuals", () => {
	it("calculates elapsed time against the running clock or stored end and clamps negatives", () => {
		expect(elapsedSeconds(undefined, null, Date.parse(end))).toBe(0);
		expect(elapsedSeconds(start, null, Date.parse(middle) + 1900)).toBe(61);
		expect(elapsedSeconds(start, end, Date.parse(middle))).toBe(120);
		expect(elapsedSeconds(end, null, Date.parse(start))).toBe(0);
		expect(clockLabel(0)).toBe("00:00");
		expect(clockLabel(3661)).toBe("61:01");
	});

	it("starts only one step at a time and replaces a previous completed step", () => {
		const target = sessionTarget();
		const [first, next] = workoutSteps(target);
		if (!first || !next) throw new Error("Missing fixture steps");
		const fresh = emptyActual(target);
		const started = startStep(fresh, first.id, start);
		expect(started.timing).toEqual({
			startedAt: start,
			endedAt: null,
			steps: [{ id: first.id, startedAt: start, endedAt: null }],
		});
		expect(startStep(started, next.id, middle)).toBe(started);
		const startedTiming = required(started.timing);
		const completed = {
			...started,
			timing: { ...startedTiming, steps: [{ id: first.id, startedAt: start, endedAt: middle }] },
		};
		const restarted = startStep(completed, first.id, end);
		expect(restarted.timing?.steps).toEqual([{ id: first.id, startedAt: end, endedAt: null }]);
		const endedWorkout = {
			...completed,
			timing: { ...required(completed.timing), endedAt: middle },
		};
		expect(startStep(endedWorkout, next.id, end)).toBe(endedWorkout);
	});

	it("records strength reps and nullable, precise loads without changing other sets", () => {
		const target = sessionTarget();
		const step = workoutSteps(target)[0];
		if (step?.kind !== "strength") throw new Error("Missing strength step");
		const actual = startStep(emptyActual(target), step.id, start);
		const recorded = finishStep(actual, step, middle, input);
		expect(recorded.exercises[0]?.sets[0]).toMatchObject({
			status: "performed",
			reps: 10,
			loadKg: 17.125,
		});
		expect(recorded.exercises[0]?.sets[0]?.loadKg).toBe(17.125);
		expect(recorded.timing?.steps[0]?.endedAt).toBe(middle);
		const nullLoad = finishStep(actual, step, middle, { ...input, loadKg: null });
		expect(nullLoad.exercises[0]?.sets[0]?.loadKg).toBeNull();
		const skipped = finishStep(actual, step, middle, input, true);
		expect(skipped.exercises[0]?.sets[0]).toMatchObject({
			status: "skipped",
			reps: null,
			loadKg: null,
		});
		expect(actual.exercises[0]?.sets[0]).toMatchObject({
			status: "not-recorded",
			reps: null,
			loadKg: null,
		});
	});

	it("records cardio input or derives elapsed minutes and supports skipping", () => {
		const target = sessionTarget();
		const step = workoutSteps(target)[1];
		if (step?.kind !== "cardio") throw new Error("Missing cardio step");
		const actual = startStep(emptyActual(target), step.id, start);
		const derived = finishStep(actual, step, end, { ...input, minutes: null });
		expect(derived.cardioSegments[0]?.actualMinutes).toBe(2);
		expect(derived.cardioSegments[0]?.intensity).toBe("moderate");
		const entered = finishStep(actual, step, middle, { ...input, minutes: 12.5 });
		expect(entered.cardioSegments[0]?.actualMinutes).toBe(12.5);
		const skipped = finishStep(actual, step, middle, input, true);
		expect(skipped.cardioSegments[0]).toMatchObject({ actualMinutes: 0, intensity: "unknown" });
		const capped = finishStep(emptyActual(target), step, end, { ...input, minutes: null });
		expect(capped.cardioSegments[0]?.actualMinutes).toBe(0);
	});

	it("finishes a workout and closes any open step without changing work actuals", () => {
		const target = sessionTarget();
		const actual = timingActual(target);
		const completed = finishWorkout(actual, end);
		expect(completed.timing).toMatchObject({ endedAt: end, steps: [{ endedAt: end }] });
		expect(completed.exercises[0]?.sets[0]?.status).toBe("not-recorded");
		const actualTiming = required(actual.timing);
		const actualStep = required(actualTiming.steps[0]);
		const alreadyEnded = {
			...actual,
			timing: { ...actualTiming, steps: [{ ...actualStep, endedAt: middle }] },
		};
		expect(finishWorkout(alreadyEnded, end).timing?.steps[0]?.endedAt).toBe(middle);
		expect(finishWorkout(emptyActual(target), end).timing).toBeUndefined();
	});

	it("derives the last performed load, then falls back to the planned nullable load", () => {
		const target = sessionTarget();
		const step = workoutSteps(target)[0];
		if (step?.kind !== "strength") throw new Error("Missing strength step");
		const actual = emptyActual(target);
		expect(initialLoad(step, actual)).toBe(10);
		const exerciseActual = required(actual.exercises[0]);
		const firstActualSet = required(exerciseActual.sets[0]);
		exerciseActual.sets[0] = { ...firstActualSet, status: "performed", loadKg: 0 };
		expect(initialLoad(step, actual)).toBe(0);
		exerciseActual.sets[0] = { ...required(exerciseActual.sets[0]), loadKg: 17.125 };
		expect(initialLoad(step, actual)).toBe(17.125);
		required(exerciseActual.sets[0]).status = "not-recorded";
		expect(initialLoad({ ...step, set: { ...step.set, loadKg: null } }, actual)).toBeNull();
		const cardio = workoutSteps(target)[1];
		if (!cardio) throw new Error("Missing cardio step");
		expect(initialLoad(cardio, actual)).toBeNull();
	});
});

describe("workout timing validation", () => {
	it("accepts an active timer and rejects duplicate, unknown, or malformed step IDs", () => {
		const target = sessionTarget();
		const actual = timingActual(target);
		expect(() => validateSessionActual(target, actual, "active")).not.toThrow();
		const id = required(required(actual.timing).steps[0]).id;
		for (const invalidId of [uuid(), "not-a-uuid"]) {
			const invalid = structuredClone(actual);
			required(required(invalid.timing).steps[0]).id = invalidId;
			if (invalidId === "not-a-uuid") {
				expect(sessionActualSchema.safeParse(invalid).success).toBe(false);
			} else {
				expect(() => validateSessionActual(target, invalid, "active")).toThrow(
					/Invalid workout step timing/,
				);
			}
		}
		const duplicate = structuredClone(actual);
		required(duplicate.timing).steps.push({ id, startedAt: middle, endedAt: null });
		expect(() => validateSessionActual(target, duplicate, "active")).toThrow(
			/Invalid workout step timing/,
		);
		expect(
			sessionActualSchema.safeParse({
				...actual,
				timing: { ...actual.timing, startedAt: "not-a-utc-instant" },
			}).success,
		).toBe(false);
		expect(
			sessionActualSchema.safeParse({
				...actual,
				timing: {
					...actual.timing,
					steps: Array.from({ length: 81 }, () => required(actual.timing).steps[0]),
				},
			}).success,
		).toBe(false);
	});

	it("rejects steps outside chronological, non-overlapping workout timing", () => {
		const target = orderedTarget();
		const [first, second] = workoutSteps(target);
		if (!first || !second) throw new Error("Missing fixture steps");
		const base = emptyActual(target);
		const timing = (
			steps: NonNullable<SessionActual["timing"]>["steps"],
			endedAt: string | null = null,
		): SessionActual => ({
			...base,
			timing: { startedAt: start, endedAt, steps },
		});
		const invalid = [
			timing([{ id: first.id, startedAt: start, endedAt: "2026-10-09T00:59:59.000Z" }]),
			timing([
				{ id: first.id, startedAt: start, endedAt: end },
				{ id: second.id, startedAt: middle, endedAt: null },
			]),
			timing([
				{ id: first.id, startedAt: start, endedAt: null },
				{ id: second.id, startedAt: middle, endedAt: null },
			]),
			timing([{ id: first.id, startedAt: start, endedAt: null }], middle),
			timing([{ id: first.id, startedAt: start, endedAt: end }], middle),
		];
		for (const actual of invalid) {
			expect(() => validateSessionActual(target, actual, "active")).toThrow(
				/Invalid workout step timing/,
			);
		}
	});

	it("requires timer end state to match the session status", () => {
		const target = sessionTarget();
		const active = timingActual(target);
		const closed = structuredClone(active);
		required(closed.timing).endedAt = middle;
		required(required(closed.timing).steps[0]).endedAt = middle;
		for (const [actual, status] of [
			[active, "draft"],
			[closed, "active"],
			[active, "completed"],
			[active, "abandoned"],
		] as const) {
			expect(() => validateSessionActual(target, actual, status)).toThrow(
				/Workout timing must match session status/,
			);
		}
		const reversed = structuredClone(closed);
		required(reversed.timing).endedAt = "2026-10-09T00:59:59.000Z";
		required(reversed.timing).steps = [];
		expect(() => validateSessionActual(target, reversed, "completed")).toThrow(
			/Workout timing must match session status/,
		);
		expect(() => validateSessionActual(target, closed, "completed")).not.toThrow();
	});
});
