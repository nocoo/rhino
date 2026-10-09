import { expect, it } from "vitest";
import {
	assertTransition,
	type ComparableSession,
	canTransition,
	emptyActual,
	suggestProgression,
	validateSessionActual,
} from "../../src/domain/session";
import { actualFromTarget } from "../../src/features/use-rhino-model";
import { sessionTarget, uuid } from "./fixtures";

it("enforces workout transitions and actual identity", () => {
	const target = sessionTarget();
	expect(canTransition(null, "draft")).toBe(true);
	expect(canTransition(null, "active")).toBe(true);
	expect(canTransition(null, "completed")).toBe(false);
	expect(() => assertTransition(null, "completed")).toThrow("new");
	expect(() => assertTransition("completed", "active")).toThrow("completed");
	assertTransition("draft", "active");
	validateSessionActual(target, null, "draft");
	expect(() => validateSessionActual(target, null, "completed")).toThrow("actual log");
	const blank = emptyActual(target);
	expect(blank.exercises[0]?.sets[0]?.status).toBe("not-recorded");
	expect(blank.cardioSegments[0]?.intensity).toBe("unknown");
	validateSessionActual(target, blank, "active");
	const good = actualFromTarget(target);
	validateSessionActual(target, good, "completed");
	const cases: [string, (value: typeof good) => void][] = [
		[
			"match the target",
			(value) => {
				value.exercises = [];
			},
		],
		[
			"unknown exercise",
			(value) => {
				value.exercises[0].id = uuid();
			},
		],
		[
			"Actual sets",
			(value) => {
				value.exercises[0].sets = [];
			},
		],
		[
			"unknown set",
			(value) => {
				value.exercises[0].sets[0].id = uuid();
			},
		],
		[
			"recorded repetitions",
			(value) => {
				value.exercises[0].sets[0].reps = null;
			},
		],
		[
			"Skipped sets",
			(value) => {
				value.exercises[0].sets[0].status = "skipped";
			},
		],
		[
			"unique",
			(value) => {
				value.cardioSegments.push({ ...value.cardioSegments[0] });
			},
		],
		[
			"unknown cardio",
			(value) => {
				value.cardioSegments[0].id = uuid();
			},
		],
		[
			"every working set",
			(value) => {
				value.exercises[0].sets[0].status = "not-recorded";
				value.exercises[0].sets[0].reps = null;
			},
		],
	];
	for (const [message, mutate] of cases) {
		const actual = structuredClone(good);
		mutate(actual);
		expect(() => validateSessionActual(target, actual, "completed")).toThrow(message);
	}
	const skipped = structuredClone(good);
	skipped.completedAsPlanned = false;
	skipped.exercises[0].sets[0].status = "skipped";
	skipped.exercises[0].sets[0].reps = null;
	validateSessionActual(target, skipped, "completed");
	expect(emptyActual({ ...target, blocks: [] }).cardioSegments).toEqual([]);
});
it("blocks progression without comparable complete history and recorded effort", () => {
	const base: ComparableSession = {
		exerciseId: "squat",
		variationKey: "goblet",
		painFlag: false,
		workingSets: [{ status: "performed", reps: 12, rir: 2, repsHigh: 12 }],
	};
	const args = {
		exerciseId: "squat",
		variationKey: "goblet",
		currentLoadKg: 20,
		incrementKg: 2,
		history: [base, base],
	};
	expect(suggestProgression(args)).toMatchObject({ kind: "increase-load", nextLoadKg: 22 });
	expect(suggestProgression({ ...args, currentLoadKg: 0 })).toMatchObject({
		kind: "increase-load",
		nextLoadKg: 2,
	});
	expect(
		suggestProgression({ ...args, history: [{ ...base, variationKey: "barbell" }] }).reason,
	).toBe("changed-variation");
	for (const load of [20, null])
		expect(
			suggestProgression({ ...args, currentLoadKg: load, history: [{ ...base, painFlag: true }] }),
		).toMatchObject({ kind: "reduce", nextLoadKg: load === null ? null : 18 });
	expect(
		suggestProgression({ ...args, history: [{ ...base, exerciseId: "row" }, base] }).reason,
	).toBe("insufficient-history");
	for (const [patch, reason] of [
		[{ status: "skipped" }, "partial-sets"],
		[{ rir: null }, "missing-effort"],
		[{ reps: null }, "rep-range-open"],
	] as const)
		expect(
			suggestProgression({
				...args,
				history: [base, { ...base, workingSets: [{ ...base.workingSets[0], ...patch }] }],
			}).reason,
		).toBe(reason);
	expect(suggestProgression({ ...args, currentLoadKg: null }).reason).toBe("missing-load");
	expect(suggestProgression({ ...args, incrementKg: 10 }).reason).toBe("increment-too-large");
});
