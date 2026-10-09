import { describe, expect, it } from "vitest";
import { EXERCISES, exercisesForEquipment } from "../../../src/data/exercises";
import {
	ALGORITHM_VERSION,
	CATALOG_VERSION,
	type StrengthExerciseId,
	strengthExerciseIdSchema,
	workingSetActualSchema,
} from "../../../src/domain/contracts";
import { previewPlan } from "../../../src/domain/planning";

const addedIds = [
	"dumbbell-curl",
	"triceps-kickback",
	"lateral-raise",
	"bent-over-row",
	"calf-raise",
] as const;

const highlightRegions: Record<(typeof EXERCISES)[number]["id"], number[]> = {
	"goblet-squat": [1, 3],
	"romanian-deadlift": [2, 3],
	"chest-press": [7, 10],
	"cable-row": [8, 6],
	"lat-pulldown": [8, 6],
	"shoulder-press": [5, 10],
	"dumbbell-curl": [6],
	"triceps-kickback": [10],
	"lateral-raise": [5],
	"bent-over-row": [8, 6],
	"calf-raise": [4],
};

describe("exercise catalog", () => {
	it("keeps the catalog and contract IDs in exact parity", () => {
		const catalogIds = EXERCISES.map((exercise) => exercise.id).sort();
		expect(catalogIds).toEqual([...strengthExerciseIdSchema.options].sort());
		expect(new Set(catalogIds).size).toBe(catalogIds.length);
		expect(CATALOG_VERSION).toBe("1.2.0");
		expect(ALGORITHM_VERSION).toBe("1.0.0");
	});

	it("requires complete preview assets, cues, and exact highlight regions", () => {
		for (const exercise of EXERCISES) {
			expect(exercise.highlightRegions).toEqual(highlightRegions[exercise.id]);
			expect(exercise.highlightRegions.every((region) => region >= 1 && region <= 10)).toBe(true);
			expect(exercise.asset).toMatchObject({
				catalogVersion: CATALOG_VERSION,
				modelPath: "/models/rhino-anatomy.glb",
				posterPath: `/models/exercises/${exercise.id}.png`,
				animationName: exercise.id,
				reviewStatus: "draft",
				instructionReady: false,
			});
			expect(exercise.accessibleAlternative.posterPath).toBe(exercise.asset.posterPath);
			for (const cue of Object.values(exercise.cues)) {
				expect(cue.trim().length).toBeGreaterThan(0);
			}
		}
	});

	it("adds bilateral per-hand dumbbell previews without enabling instruction claims", () => {
		const additions = addedIds.map((id) => EXERCISES.find((exercise) => exercise.id === id));
		for (const exercise of additions) {
			expect(exercise).toBeDefined();
			expect(exercise).toMatchObject({
				equipmentId: "dumbbell",
				loadConvention: "per-hand",
				unilateral: false,
				asset: { reviewStatus: "draft", instructionReady: false },
			});
			expect(exercise?.muscles.length).toBeGreaterThan(0);
		}
		const dumbbellEligible = exercisesForEquipment(["dumbbell"]).map(({ id }) => id);
		expect(dumbbellEligible).toEqual(
			EXERCISES.filter(({ equipmentId }) => equipmentId === "dumbbell").map(({ id }) => id),
		);
		expect(addedIds.every((id) => dumbbellEligible.includes(id))).toBe(true);
		expect(exercisesForEquipment([])).toEqual([]);
	});

	it("distinguishes push and pull and records new movement patterns", () => {
		const pattern = (id: StrengthExerciseId) =>
			EXERCISES.find((exercise) => exercise.id === id)?.movementPattern;
		expect(EXERCISES.find(({ id }) => id === "chest-press")?.movementPattern).toBe(
			"horizontal-push",
		);
		expect(pattern("bent-over-row")).toBe("horizontal-pull");
		expect(pattern("bent-over-row")).not.toBe(pattern("chest-press"));
		expect(pattern("dumbbell-curl")).toBe("elbow-flexion");
		expect(pattern("triceps-kickback")).toBe("elbow-extension");
		expect(pattern("lateral-raise")).toBe("shoulder-abduction");
		expect(pattern("calf-raise")).toBe("plantar-flexion");
	});

	it("keeps the foundational automatic plan templates unchanged", () => {
		const result = previewPlan({
			timezone: "UTC",
			reviewMonth: "2026-10",
			weeklyFrequency: 2,
			preferredWeekdays: ["monday", "thursday"],
			cardioOnlyWeekdays: [],
			sessionTimeBudgetMinutes: 90,
			goalPreference: "strength-first",
			experience: "beginner",
			equipmentIds: [
				"dumbbell",
				"bench",
				"cable-machine",
				"lat-pulldown-machine",
				"chest-press-machine",
			],
		});
		expect(
			result.preview?.template.slots.map((slot) =>
				slot.target.blocks.flatMap((block) => block.exercises.map(({ exerciseId }) => exerciseId)),
			),
		).toEqual([
			["goblet-squat", "romanian-deadlift", "chest-press", "cable-row"],
			["goblet-squat", "romanian-deadlift", "shoulder-press", "lat-pulldown"],
		]);
	});

	it("accepts per-hand recorded loads without rounding", () => {
		const actual = workingSetActualSchema.parse({
			id: "11111111-1111-4111-8111-111111111111",
			status: "performed",
			reps: 10,
			loadKg: 7.25,
			rir: 2,
		});
		expect(actual.loadKg).toBe(7.25);
	});
});
