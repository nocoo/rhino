import { expect, it } from "vitest";
import type { MeasurementRecord, ProfileRecord } from "../../src/domain/contracts";
import * as hash from "../../src/domain/hash";
import * as metrics from "../../src/domain/metrics";
import * as saves from "../../src/domain/saves";
import { actualFromTarget } from "../../src/features/use-rhino-model";
import { profileValues, sessionRecord, uuid } from "./fixtures";

const measurement = (
	kind: "height" | "weight",
	effectiveDate: string,
	value: number,
): MeasurementRecord => ({
	id: uuid(),
	kind,
	effectiveDate,
	value,
	version: 1,
	lastMutationId: uuid(),
	createdAt: "2026-10-09T01:00:00Z",
	updatedAt: "2026-10-09T01:00:00Z",
});
it("stores unrounded BMI and selects height effective at the weight date", () => {
	const old = measurement("height", "2025-01-01", 175),
		next = measurement("height", "2026-01-01", 180),
		future = measurement("height", "2027-01-01", 185),
		weight = measurement("weight", "2026-10-09", 72.123);
	expect(metrics.heightForWeightDate(weight.effectiveDate, [old, next, future, weight])?.id).toBe(
		next.id,
	);
	expect(metrics.bmiForWeight(weight, [old, next, future])?.bmi).toBe(72.123 / 1.8 ** 2);
	expect(metrics.bmiForWeight(weight, [future])).toBeNull();
	expect(metrics.displayBmi(22.26)).toBe("22.3");
	for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
		expect(() => metrics.computeBmi(value, 180)).toThrow();
		expect(() => metrics.computeBmi(72, value)).toThrow();
		expect(() => metrics.displayBmi(value)).toThrow();
		expect(() => metrics.assertFinitePositive(value)).toThrow();
	}
	metrics.assertFinitePositive(1);
	expect(metrics.affectedBmiDates(next, [old, future, weight])).toEqual([weight.effectiveDate]);
	expect(metrics.affectedBmiDates(weight, [old, next])).toEqual([]);
	expect(metrics.affectedBmiDates(future, [old, next, weight])).toEqual([]);
});
it("enforces plausibility and distinguishes warnings from hard validation", () => {
	for (const kind of ["height", "weight"] as const) {
		for (const value of [Number.NaN, 0, -1, 1, 1000])
			expect(() => metrics.measurementWarnings(kind, value)).toThrow();
		expect(metrics.measurementWarnings(kind, 30)[0]?.code).toBe("plausibility");
		expect(metrics.measurementWarnings(kind, kind === "height" ? 220 : 210)).toHaveLength(1);
		expect(metrics.measurementWarnings(kind, kind === "height" ? 180 : 70)).toEqual([]);
	}
	expect(metrics.isFutureLocalDate("2026-10-10", "UTC", new Date("2026-10-09T00:00:00Z"))).toBe(
		true,
	);
});
it("suppresses generic estimates outside scope or on opt-out", () => {
	expect(metrics.recommendationScope(null, "2026-10-09")).toBe("unknown-age");
	for (const birth of ["2015-01-01", "1940-01-01"])
		expect(metrics.recommendationScope(birth, "2026-10-09")).toBe("out-of-scope");
	const args = { birthday: "1990-01-01", onDate: "2026-10-09", mode: "generic-estimates" as const };
	expect(metrics.heartRateGuidance(args).status).toBe("available");
	expect(metrics.heartRateGuidance({ ...args, mode: "disabled" })).toEqual({
		status: "suppressed",
		reason: "disabled",
	});
	expect(metrics.heartRateGuidance({ ...args, mode: "clinician-range" }).status).toBe(
		"clinician-override",
	);
	expect(metrics.heartRateGuidance({ ...args, birthday: null })).toEqual({
		status: "suppressed",
		reason: "missing-birthday",
	});
	expect(metrics.heartRateGuidance({ ...args, birthday: "2015-01-01" })).toEqual({
		status: "suppressed",
		reason: "out-of-scope",
	});
	expect(metrics.estimatedHeartRate(35).estimatedHrMax).toBe(183.5);
	for (const age of [-1, 0.5]) expect(() => metrics.estimatedHeartRate(age)).toThrow();
	const profile: ProfileRecord = {
		...profileValues(),
		id: 1,
		version: 1,
		lastMutationId: uuid(),
		createdAt: "2026-10-09T01:00:00Z",
		updatedAt: "2026-10-09T01:00:00Z",
	};
	expect(metrics.profileReadiness(null, [], args.onDate).hasProfile).toBe(false);
	const rows = [measurement("height", "2026-10-08", 180), measurement("weight", "2026-10-09", 70)];
	expect(metrics.profileReadiness(profile, rows, args.onDate)).toMatchObject({
		guidance: "available",
		hasHeight: true,
		hasWeight: true,
	});
	for (const [mode, guidance] of [
		["disabled", "disabled"],
		["clinician-range", "clinician-override"],
	] as const)
		expect(
			metrics.profileReadiness(
				{ ...profile, guidance: { ...profile.guidance, mode } },
				[],
				args.onDate,
			).guidance,
		).toBe(guidance);
	expect(metrics.profileReadiness({ ...profile, birthday: null }, [], args.onDate).guidance).toBe(
		"unavailable",
	);
});
it("derives actual totals without inventing missing results", () => {
	const draft = sessionRecord(),
		completed = { ...sessionRecord(), status: "completed" as const },
		active = { ...sessionRecord(), status: "active" as const },
		cardio = { ...sessionRecord(), localDate: "2026-10-16", status: "completed" as const },
		outside = { ...sessionRecord(), localDate: "2025-01-01" };
	completed.actual = actualFromTarget(completed.target);
	active.actual = actualFromTarget(active.target);
	cardio.target.blocks = cardio.target.blocks.filter((block) => block.kind === "cardio");
	cardio.actual = actualFromTarget(cardio.target);
	if (active.actual.cardioSegments[0]) active.actual.cardioSegments[0].intensity = "vigorous";
	expect(metrics.sessionActualCardioMinutes(draft)).toBeNull();
	expect(metrics.sessionActualCardioMinutes(completed)).toBe(30);
	expect(metrics.sessionActualCardioMinutes(cardio)).toBe(30);
	const segments = (["moderate", "vigorous", "easy", "unknown"] as const).map((intensity) => ({
		id: uuid(),
		role: "main" as const,
		actualMinutes: 10,
		intensity,
	}));
	expect(metrics.moderateEquivalentMinutes(segments)).toBe(30);
	const oldHeight = measurement("height", "2026-01-01", 180),
		missingWeight = measurement("weight", "2025-01-01", 70),
		weight = measurement("weight", "2026-10-09", 72);
	const progress = metrics.deriveProgress({
		from: "2026-10-01",
		to: "2026-10-31",
		measurements: [weight, oldHeight, missingWeight],
		sessions: [draft, completed, active, cardio, outside],
	});
	expect(progress.sessions).toHaveLength(4);
	expect(progress.measurements[0]?.bmi).toBeCloseTo(22.22222);
	expect(progress.measurements).toHaveLength(1);
	expect(progress.weeklyTotals[0]).toMatchObject({
		completedSessions: 1,
		strengthSessions: 1,
		moderateEquivalentMinutes: 90,
		actualModerateMinutes: 30,
		actualVigorousMinutes: 30,
	});
	const abandoned = { ...draft, status: "abandoned" as const };
	expect(
		metrics.deriveProgress({
			from: "2026-10-01",
			to: "2026-10-31",
			measurements: [],
			sessions: [abandoned],
		}).weeklyTotals[0]?.completedSessions,
	).toBe(0);
});
it("decides immutable mutation identity and version races", () => {
	const args = { current: null, expectedVersion: 0, mutationId: "a", contentHash: "h" };
	expect(saves.decideVersionedWrite(args)).toEqual({ action: "insert" });
	expect(saves.decideVersionedWrite({ ...args, expectedVersion: 1 }).action).toBe("conflict");
	const current = { version: 2, lastMutationId: "a", lastMutationHash: "h" };
	expect(saves.decideVersionedWrite({ ...args, current })).toEqual({ action: "idempotent" });
	expect(saves.decideVersionedWrite({ ...args, current, contentHash: "different" })).toMatchObject({
		action: "conflict",
		reason: "mutation_reuse",
	});
	expect(saves.decideVersionedWrite({ ...args, current, mutationId: "b" })).toMatchObject({
		action: "conflict",
		reason: "stale_version",
	});
	expect(
		saves.decideVersionedWrite({ ...args, current, mutationId: "b", expectedVersion: 2 }),
	).toEqual({ action: "update", nextVersion: 3 });
	const plan = {
		currentRevision: 1,
		expectedRevision: 1,
		existingRequest: null,
		requestId: "r",
		contentHash: "h",
	};
	expect(saves.decidePlanAccept(plan).action).toBe("insert");
	expect(saves.decidePlanAccept({ ...plan, expectedRevision: 0 })).toMatchObject({
		reason: "stale_revision",
	});
	expect(
		saves.decidePlanAccept({ ...plan, existingRequest: { requestId: "r", contentHash: "h" } })
			.action,
	).toBe("idempotent");
	expect(
		saves.decidePlanAccept({
			...plan,
			existingRequest: { requestId: "r", contentHash: "different" },
		}),
	).toMatchObject({ reason: "request_reuse" });
});
it("hashes canonical payloads and generates deterministic target IDs", async () => {
	expect(hash.canonicalize({ z: [null, { b: 2, a: 1 }], a: true })).toBe(
		'{"a":true,"z":[null,{"a":1,"b":2}]}',
	);
	expect(await hash.contentHash({ b: 2, a: 1 })).toBe(await hash.contentHash({ a: 1, b: 2 }));
	expect(await hash.sha256Hex("abc")).toBe(
		"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
	);
	expect(hash.stableUuid("seed")).toBe(hash.stableUuid("seed"));
	expect(hash.stableUuid("other")).not.toBe(hash.stableUuid("seed"));
});
