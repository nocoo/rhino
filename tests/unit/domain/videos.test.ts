import { describe, expect, it } from "vitest";
import { EXERCISE_VIDEO_REFERENCES } from "../../../src/data/exercise-videos";
import { EXERCISES } from "../../../src/data/exercises";

describe("exercise video references", () => {
	it("covers every strength exercise with a valid YouTube reference", () => {
		expect(Object.keys(EXERCISE_VIDEO_REFERENCES).sort()).toEqual(
			EXERCISES.map(({ id }) => id).sort(),
		);

		for (const [exerciseId, reference] of Object.entries(EXERCISE_VIDEO_REFERENCES)) {
			expect(reference.youtubeId).toMatch(/^[\w-]{11}$/);
			expect(reference.title.trim()).not.toBe("");
			expect(reference.publisher.trim()).not.toBe("");
			expect(reference.sourceTitle.trim()).not.toBe("");
			expect(reference.url).toBe(`https://www.youtube.com/watch?v=${reference.youtubeId}`);
			expect(reference.youtubeId).not.toBe("5SLXn9l4WwU");
			if (exerciseId === "bent-over-row") {
				expect(reference.sourceTitle).toContain("Dumbbell Bent Over Row");
				expect(reference.sourceTitle).not.toContain("Supported");
			}
			if (exerciseId === "triceps-kickback") {
				expect(reference.sourceTitle).toContain("Both Arms");
			}
		}
	});
});
