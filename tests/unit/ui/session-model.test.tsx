// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CATALOG_VERSION } from "../../../src/domain/contracts";
import { useSessionModel } from "../../../src/features/use-session-model";
import { actualFromTarget, sessionRecord, uuid } from "../../helpers/fixtures";

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});
it("selects an exact plan snapshot without normalizing its time budget and locks started targets", () => {
	const session = sessionRecord();
	const { result, rerender } = renderHook(({ record }) => useSessionModel(record), {
		initialProps: { record: session },
	});
	const alternative = sessionRecord().target;
	alternative.timeBudgetMinutes = 90;
	act(() => result.current.selectTarget(alternative));
	expect(result.current.target).toEqual(alternative);
	alternative.timeBudgetMinutes = 100;
	expect(result.current.target.timeBudgetMinutes).toBe(90);
	const started = { ...session, status: "active" as const };
	rerender({ record: started });
	act(() => result.current.selectTarget(alternative));
	act(() => result.current.setReps(0, 20));
	expect(result.current.target).toEqual(started.target);
	expect(result.current.dirty).toBe(false);
});
it("keeps target edits isolated from the original plan and resets actuals", () => {
	const session = sessionRecord();
	const original = structuredClone(session);
	const { result } = renderHook(() => useSessionModel(session));
	for (const invalid of [0, 9, 1.5]) act(() => result.current.setCount(0, invalid));
	for (const invalid of [0, 31, 1.5]) act(() => result.current.setReps(0, invalid));
	expect(result.current.dirty).toBe(false);
	act(() => result.current.setCount(0, 3));
	const sets = result.current.target.blocks[0]?.exercises[0]?.workingSets;
	expect(sets).toHaveLength(3);
	expect(new Set(sets?.map((set) => set.id)).size).toBe(3);
	act(() => result.current.setReps(0, 15));
	expect(
		result.current.target.blocks[0]?.exercises[0]?.workingSets.every(
			(set) => set.repsLow === 15 && set.repsHigh === 15,
		),
	).toBe(true);
	act(() => result.current.updateExercise(0, "dumbbell-curl"));
	expect(result.current.target.blocks[0]?.exercises[0]).toMatchObject({
		exerciseId: "dumbbell-curl",
		catalogVersion: CATALOG_VERSION,
		equipmentId: "dumbbell",
		loadConvention: "per-hand",
	});
	expect(result.current.target.catalogVersion).toBe(session.target.catalogVersion);
	expect(result.current.target.blocks[0].exercises[0].workingSets.map((set) => set.loadKg)).toEqual(
		[null, null, null],
	);
	expect(session).toEqual(original);
	expect(result.current.dirty).toBe(true);
	act(() => result.current.setCount(0, 1));
	expect(result.current.target.blocks[0]?.exercises[0]?.workingSets).toHaveLength(1);
});
it("updates selected actuals without rewriting other sets or segments", () => {
	const session = sessionRecord();
	const exercise = session.target.blocks[0]?.exercises[0];
	if (!exercise) throw new Error("Missing fixture exercise");
	exercise.workingSets.push({ ...exercise.workingSets[0], id: uuid(), setIndex: 2 });
	session.target.blocks[0]?.exercises.push({ ...structuredClone(exercise), id: uuid() });
	const cardio = session.target.blocks[1]?.cardio;
	if (!cardio) throw new Error("Missing fixture cardio");
	session.target.blocks.push({
		...structuredClone(session.target.blocks[1]),
		cardio: { ...cardio, id: uuid() },
	});
	session.actual = actualFromTarget(session.target);
	const { result } = renderHook(() => useSessionModel(session));
	act(() =>
		result.current.updateSet(exercise.id, exercise.workingSets[0].id, {
			reps: 5,
			status: "performed",
		}),
	);
	expect(result.current.actual.exercises[0]?.sets[0]?.reps).toBe(5);
	expect(result.current.actual.exercises[0]?.sets[1]?.reps).toBe(12);
	expect(result.current.actual.exercises[1]?.sets[0]?.reps).toBe(12);
	expect(result.current.actual.completedAsPlanned).toBe(false);
	act(() => result.current.updateCardio(cardio.id, 12));
	expect(result.current.actual.cardioSegments[0]?.actualMinutes).toBe(12);
	expect(result.current.actual.cardioSegments[1]?.actualMinutes).toBe(30);
	act(() => result.current.setActual({ ...result.current.actual, painFlag: true }));
	expect(result.current.actual.painFlag).toBe(true);
});
it("warns only on dirty unload and cleans its listener", () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-10-09T01:00:00Z"));
	const session = sessionRecord();
	const { result, unmount } = renderHook(() => useSessionModel(session));
	const clean = new Event("beforeunload", { cancelable: true });
	window.dispatchEvent(clean);
	expect(clean.defaultPrevented).toBe(false);
	act(() => result.current.setReps(0, 10));
	const dirty = new Event("beforeunload", { cancelable: true });
	window.dispatchEvent(dirty);
	expect(dirty.defaultPrevented).toBe(true);
	unmount();
	expect(vi.getTimerCount()).toBe(0);
	const after = new Event("beforeunload", { cancelable: true });
	window.dispatchEvent(after);
	expect(after.defaultPrevented).toBe(false);
});
