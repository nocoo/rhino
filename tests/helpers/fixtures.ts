import {
	defaultGuidance,
	defaultPreferences,
	type PlanInput,
	type SessionRecord,
	type SessionTarget,
} from "../../src/domain/contracts";

export const uuid = () => crypto.randomUUID();
export const profileValues = () => ({
	birthday: "1990-02-28",
	timezone: "Asia/Shanghai",
	preferences: structuredClone(defaultPreferences),
	guidance: structuredClone(defaultGuidance),
});
export const planInput = (): PlanInput => ({
	timezone: "Asia/Shanghai",
	reviewMonth: "2026-10",
	weeklyFrequency: 3,
	preferredWeekdays: ["monday", "wednesday", "friday"],
	cardioOnlyWeekdays: [],
	sessionTimeBudgetMinutes: 60,
	goalPreference: "strength-first",
	experience: "beginner",
	equipmentIds: [...defaultPreferences.equipmentIds],
});
export const sessionTarget = (): SessionTarget => ({
	catalogVersion: "1.0.0",
	algorithmVersion: "1.0.0",
	timeBudgetMinutes: 60,
	emphasis: "full-body",
	blocks: [
		{
			kind: "strength",
			durationMinutes: 30,
			cardio: null,
			exercises: [
				{
					id: uuid(),
					exerciseId: "goblet-squat",
					name: "Goblet squat",
					catalogVersion: "1.0.0",
					equipmentId: "dumbbell",
					loadConvention: "total-external",
					warmUpSetCount: 1,
					restSeconds: 90,
					workingSets: [
						{ id: uuid(), setIndex: 1, repsLow: 8, repsHigh: 12, rirTarget: 2, loadKg: 10 },
					],
				},
			],
		},
		{
			kind: "cardio",
			durationMinutes: 30,
			exercises: [],
			cardio: {
				id: uuid(),
				role: "main",
				modality: "cycling",
				plannedMinutes: 30,
				plannedIntensity: "moderate",
			},
		},
	],
});
export const sessionRecord = (): SessionRecord => ({
	id: uuid(),
	sourcePlanRevision: null,
	localDate: "2026-10-09",
	timezone: "Asia/Shanghai",
	status: "draft",
	target: sessionTarget(),
	actual: null,
	version: 1,
	lastMutationId: uuid(),
	createdAt: "2026-10-09T01:00:00Z",
	updatedAt: "2026-10-09T01:00:00Z",
});
