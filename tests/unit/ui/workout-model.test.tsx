// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyActual } from "../../../src/domain/session";
import { workoutSteps } from "../../../src/domain/workout";
import type { RhinoModel } from "../../../src/features/use-rhino-model";
import { useWorkoutModel } from "../../../src/features/use-workout-model";
import { sessionRecord, uuid } from "../../helpers/fixtures";

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

const required = <T,>(value: T | null | undefined): T => {
	if (value == null) throw new Error("Missing fixture value");
	return value;
};
const saveModel = () => {
	const saveSession = vi.fn<RhinoModel["saveSession"]>();
	return { model: { busy: false, saveSession } as unknown as RhinoModel, saveSession };
};
const savedRecord = (
	session: ReturnType<typeof sessionRecord>,
	status: ReturnType<typeof sessionRecord>["status"],
	target: ReturnType<typeof sessionRecord>["target"],
	actual: ReturnType<typeof emptyActual> | null,
) => ({ ...session, status, target, actual, version: session.version + 1 });
const deferred = <T,>() => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((yes) => {
		resolve = yes;
	});
	return { promise, resolve };
};

describe("workout model progression", () => {
	it("opens edit intent at the overview even for timed active workouts", () => {
		const session = sessionRecord();
		session.status = "active";
		session.actual = {
			...emptyActual(session.target),
			timing: { startedAt: session.createdAt, endedAt: null, steps: [] },
		};
		const { model } = saveModel();
		const hook = renderHook(() => useWorkoutModel(session, model, true));
		expect(hook.result.current.overview).toBe(true);
	});
	it("begins with timers but no inferred work, records input, then closes the workout", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-09T01:00:00.000Z"));
		let session = sessionRecord();
		const { model, saveSession } = saveModel();
		saveSession.mockImplementation(async (source, status, target, actual) =>
			savedRecord(source, status, target, actual),
		);
		const hook = renderHook(() => useWorkoutModel(session, model));
		await act(async () => hook.result.current.begin());
		const begun = saveSession.mock.calls[0];
		expect(begun?.[1]).toBe("active");
		expect(begun?.[3]?.timing).toEqual({
			startedAt: "2026-10-09T01:00:00.000Z",
			endedAt: null,
			steps: [
				{
					id: required(required(required(session.target.blocks[0]).exercises[0]).workingSets[0]).id,
					startedAt: "2026-10-09T01:00:00.000Z",
					endedAt: null,
				},
			],
		});
		expect(begun?.[3]?.exercises[0]?.sets[0]).toMatchObject({
			status: "not-recorded",
			reps: null,
			loadKg: null,
		});
		const begunCall = required(begun);
		session = savedRecord(session, "active", required(begunCall[2]), required(begunCall[3]));
		hook.rerender();
		act(() => hook.result.current.setReps(11));
		act(() => hook.result.current.setLoadKg(12.345));
		vi.setSystemTime(new Date("2026-10-09T01:00:42.000Z"));
		await act(async () => hook.result.current.record());
		const recorded = saveSession.mock.calls[1]?.[3];
		expect(recorded?.timing?.steps[0]?.endedAt).toBe("2026-10-09T01:00:42.000Z");
		expect(recorded?.exercises[0]?.sets[0]).toMatchObject({
			status: "performed",
			reps: 11,
			loadKg: 12.345,
		});
		session = savedRecord(session, "active", session.target, recorded ?? null);
		hook.rerender();
		vi.setSystemTime(new Date("2026-10-09T01:01:00.000Z"));
		act(() => hook.result.current.setReps(8));
		expect(hook.result.current.dirty).toBe(true);
		await act(async () => hook.result.current.finish());
		expect(hook.result.current.dirty).toBe(false);
		expect(saveSession).toHaveBeenLastCalledWith(
			session,
			"completed",
			session.target,
			expect.objectContaining({
				timing: expect.objectContaining({ endedAt: "2026-10-09T01:01:00.000Z" }),
			}),
		);
		hook.unmount();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("retains batched step input and resets it when advancing to the next step", async () => {
		let session = sessionRecord();
		session.status = "active";
		const exercise = required(required(session.target.blocks[0]).exercises[0]);
		exercise.workingSets.push({
			...required(exercise.workingSets[0]),
			id: uuid(),
			setIndex: 2,
		});
		const { model, saveSession } = saveModel();
		saveSession.mockImplementation(async (source, status, target, actual) =>
			savedRecord(source, status, target, actual),
		);
		const hook = renderHook(() => useWorkoutModel(session, model));
		act(() => {
			hook.result.current.setReps(7);
			hook.result.current.setLoadKg(23.625);
			hook.result.current.setMinutes(16);
			hook.result.current.setIntensity("vigorous");
		});
		expect(hook.result.current).toMatchObject({
			reps: 7,
			loadKg: 23.625,
			minutes: 16,
			intensity: "vigorous",
			dirty: true,
		});
		await act(async () => hook.result.current.record());
		const payload = required(saveSession.mock.calls[0]?.[3]);
		expect(payload.exercises[0]?.sets[0]).toMatchObject({
			status: "performed",
			reps: 7,
			loadKg: 23.625,
		});
		session = savedRecord(session, "active", session.target, payload);
		hook.rerender();
		const nextStep = required(workoutSteps(session.target)[1]);
		expect(hook.result.current.step?.id).toBe(nextStep.id);
		expect(hook.result.current).toMatchObject({
			reps: nextStep.kind === "strength" ? nextStep.set.repsHigh : 0,
			loadKg: 23.625,
			minutes: null,
			intensity: "unknown",
			dirty: false,
		});
	});

	it("resumes persisted elapsed timers after reload and derives rest from the last strength step", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-09T01:02:00.000Z"));
		let session = sessionRecord();
		const firstExercise = required(required(session.target.blocks[0]).exercises[0]);
		const firstSet = required(firstExercise.workingSets[0]);
		firstExercise.workingSets.push({
			...firstSet,
			id: uuid(),
			setIndex: 2,
		});
		const [first, second] = workoutSteps(session.target);
		if (!first || !second) throw new Error("Missing fixture steps");
		const actual = emptyActual(session.target);
		actual.timing = {
			startedAt: "2026-10-09T01:00:00.000Z",
			endedAt: null,
			steps: [
				{
					id: first.id,
					startedAt: "2026-10-09T01:00:00.000Z",
					endedAt: "2026-10-09T01:00:30.000Z",
				},
				{ id: second.id, startedAt: "2026-10-09T01:00:30.000Z", endedAt: null },
			],
		};
		const firstActual = required(actual.exercises[0]);
		firstActual.sets[0] = {
			...required(firstActual.sets[0]),
			status: "performed",
			reps: 10,
			loadKg: 13.75,
		};
		session.status = "active";
		session.actual = actual;
		const { model } = saveModel();
		const hook = renderHook(() => useWorkoutModel(session, model));
		expect(hook.result.current.step?.id).toBe(second.id);
		expect(hook.result.current.loadKg).toBe(13.75);
		expect(hook.result.current.totalSeconds).toBe(120);
		expect(hook.result.current.stepSeconds).toBe(90);
		expect(hook.result.current.restSeconds).toBe(0);
		act(() => vi.advanceTimersByTime(1000));
		expect(hook.result.current.totalSeconds).toBe(121);
		const ended = {
			...actual,
			timing: {
				...required(actual.timing),
				steps: [
					{
						id: first.id,
						startedAt: "2026-10-09T01:00:00.000Z",
						endedAt: "2026-10-09T01:01:30.000Z",
					},
				],
			},
		};
		session = { ...session, actual: ended };
		hook.rerender();
		expect(hook.result.current.restSeconds).toBe(59);
		act(() => window.dispatchEvent(new Event("focus")));
		expect(hook.result.current.restSeconds).toBe(59);
		hook.unmount();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("retains edited input and the exact timestamp payload across failed identical retries", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-09T01:00:00.000Z"));
		const session = sessionRecord();
		session.status = "active";
		const { model, saveSession } = saveModel();
		saveSession.mockResolvedValue(null);
		const hook = renderHook(() => useWorkoutModel(session, model));
		act(() => hook.result.current.setReps(9));
		act(() => hook.result.current.setLoadKg(null));
		await act(async () => hook.result.current.record());
		const firstPayload = saveSession.mock.calls[0]?.[3];
		expect(firstPayload?.timing?.startedAt).toBe("2026-10-09T01:00:00.000Z");
		expect(firstPayload?.timing?.steps[0]?.endedAt).toBe("2026-10-09T01:00:00.000Z");
		expect(firstPayload?.exercises[0]?.sets[0]).toMatchObject({
			status: "performed",
			reps: 9,
			loadKg: null,
		});
		expect(hook.result.current.step?.id).toBe(
			required(required(required(session.target.blocks[0]).exercises[0]).workingSets[0]).id,
		);
		expect(hook.result.current.reps).toBe(9);
		expect(hook.result.current.loadKg).toBeNull();
		vi.setSystemTime(new Date("2026-10-09T01:00:30.000Z"));
		await act(async () => hook.result.current.record());
		expect(saveSession).toHaveBeenCalledTimes(2);
		expect(saveSession.mock.calls[1]?.[3]).toEqual(firstPayload);
		expect(saveSession.mock.calls[1]?.[3]?.timing?.steps[0]?.endedAt).toBe(
			"2026-10-09T01:00:00.000Z",
		);
		const dirtyEvent = new Event("beforeunload", { cancelable: true });
		window.dispatchEvent(dirtyEvent);
		expect(dirtyEvent.defaultPrevented).toBe(true);
		saveSession.mockImplementation(async (source, status, target, actual) =>
			savedRecord(source, status, target, actual),
		);
		await act(async () => hook.result.current.record());
		expect(saveSession.mock.calls[2]?.[3]).toEqual(firstPayload);
		expect(hook.result.current.dirty).toBe(false);
		const cleanEvent = new Event("beforeunload", { cancelable: true });
		window.dispatchEvent(cleanEvent);
		expect(cleanEvent.defaultPrevented).toBe(false);
	});

	it("blocks overlapping submits and honors the model busy guard", async () => {
		const session = sessionRecord();
		session.status = "active";
		const { model, saveSession } = saveModel();
		const pending = deferred<ReturnType<typeof sessionRecord> | null>();
		saveSession.mockReturnValue(pending.promise);
		const hook = renderHook(() => useWorkoutModel(session, model));
		let submitting: Promise<void> | undefined;
		act(() => {
			submitting = hook.result.current.record();
			void hook.result.current.record();
		});
		expect(saveSession).toHaveBeenCalledTimes(1);
		await act(async () => {
			pending.resolve(null);
			await required(submitting);
		});
		model.busy = true;
		await act(async () => hook.result.current.startCurrent());
		expect(saveSession).toHaveBeenCalledTimes(1);
	});

	it("supports skipped steps, manual timer start, and all cardio inputs", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-09T01:00:00.000Z"));
		const session = sessionRecord();
		const { model, saveSession } = saveModel();
		saveSession.mockImplementation(async (source, status, target, actual) =>
			savedRecord(source, status, target, actual),
		);
		const hook = renderHook(() => useWorkoutModel(session, model));
		act(() => hook.result.current.setReps(9));
		saveSession.mockResolvedValue(null);
		await act(async () => hook.result.current.startCurrent());
		expect(hook.result.current.reps).toBe(9);
		expect(hook.result.current.dirty).toBe(true);
		const warning = new Event("beforeunload", { cancelable: true });
		window.dispatchEvent(warning);
		expect(warning.defaultPrevented).toBe(true);
		saveSession.mockImplementation(async (source, status, target, actual) =>
			savedRecord(source, status, target, actual),
		);
		await act(async () => hook.result.current.startCurrent());
		expect(hook.result.current.dirty).toBe(true);
		expect(saveSession.mock.calls[0]?.[3]?.timing?.steps[0]?.startedAt).toBe(
			"2026-10-09T01:00:00.000Z",
		);
		await act(async () => hook.result.current.record(true));
		expect(saveSession.mock.calls[2]?.[3]?.exercises[0]?.sets[0]).toMatchObject({
			status: "skipped",
			reps: null,
			loadKg: null,
		});
		expect(hook.result.current.dirty).toBe(false);

		const cardio = sessionRecord();
		cardio.target = { ...cardio.target, blocks: [required(cardio.target.blocks[1])] };
		cardio.status = "active";
		const cardioModel = saveModel();
		cardioModel.saveSession.mockResolvedValue(null);
		const cardioHook = renderHook(() => useWorkoutModel(cardio, cardioModel.model));
		act(() => cardioHook.result.current.setMinutes(15));
		act(() => cardioHook.result.current.setIntensity("vigorous"));
		await act(async () => cardioHook.result.current.record());
		expect(cardioModel.saveSession.mock.calls[0]?.[3]?.cardioSegments[0]).toMatchObject({
			actualMinutes: 15,
			intensity: "vigorous",
		});
	});

	it("closes a recorded running step when saving edits", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-09T01:01:00.000Z"));
		const session = sessionRecord();
		session.status = "active";
		const step = required(workoutSteps(session.target)[0]);
		const actual = emptyActual(session.target);
		actual.timing = {
			startedAt: "2026-10-09T01:00:00.000Z",
			endedAt: null,
			steps: [{ id: step.id, startedAt: "2026-10-09T01:00:00.000Z", endedAt: null }],
		};
		const firstActual = required(actual.exercises[0]);
		firstActual.sets[0] = {
			...required(firstActual.sets[0]),
			status: "performed",
			reps: 10,
		};
		session.actual = actual;
		const { model, saveSession } = saveModel();
		saveSession.mockResolvedValue(null);
		const hook = renderHook(() => useWorkoutModel(session, model));
		await act(async () => hook.result.current.saveEdits());
		expect(saveSession.mock.calls[0]?.[3]?.timing?.steps[0]?.endedAt).toBe(
			"2026-10-09T01:01:00.000Z",
		);
	});

	it("supports null-load recording, edit persistence, and no-step sessions", async () => {
		const session = sessionRecord();
		session.status = "active";
		const { model, saveSession } = saveModel();
		saveSession.mockResolvedValue(null);
		const hook = renderHook(() => useWorkoutModel(session, model));
		act(() => hook.result.current.setLoadKg(null));
		await act(async () => hook.result.current.saveEdits());
		expect(saveSession).toHaveBeenCalledWith(session, "active", session.target, expect.any(Object));
		expect(saveSession.mock.calls[0]?.[3]?.exercises[0]?.sets[0]?.loadKg).toBeNull();
		await act(async () => hook.result.current.saveDraft());
		expect(saveSession).toHaveBeenLastCalledWith(session, "draft", session.target, null);
		const empty = sessionRecord();
		empty.target.blocks = [];
		const noStep = renderHook(() => useWorkoutModel(empty, model));
		expect(noStep.result.current.step).toBeUndefined();
		await act(async () => noStep.result.current.record());
		const callCount = saveSession.mock.calls.length;
		await act(async () => noStep.result.current.startCurrent());
		expect(saveSession).toHaveBeenCalledTimes(callCount);
		await act(async () => noStep.result.current.begin());
		expect(saveSession.mock.calls[callCount]?.[3]?.timing?.steps).toEqual([]);
	});
});
