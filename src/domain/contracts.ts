import { z } from "zod";
import {
	daysInclusive,
	isIanaTimeZone,
	isUtcInstant,
	isValidDateOnly,
	isValidMonth,
	WEEKDAYS,
	type Weekday,
} from "./dates";

export const ALGORITHM_VERSION = "1.0.0";
export const CATALOG_VERSION = "1.1.0";
export const MAX_BODY_BYTES = 256 * 1024;
export const MAX_DATE_RANGE_DAYS = 400;
export const PROFILE_ID = 1;
export const MIN_RECOMMENDATION_AGE = 18;
export const MAX_RECOMMENDATION_AGE = 64;

export const API_ROUTES = [
	{ method: "GET", path: "/api/live" },
	{ method: "GET", path: "/api/identity" },
	{ method: "GET", path: "/api/profile" },
	{ method: "PUT", path: "/api/profile" },
	{ method: "GET", path: "/api/measurements" },
	{ method: "PUT", path: "/api/measurements/:id" },
	{ method: "DELETE", path: "/api/measurements/:id" },
	{ method: "GET", path: "/api/plans" },
	{ method: "POST", path: "/api/plans/preview" },
	{ method: "PUT", path: "/api/plans/:requestId" },
	{ method: "GET", path: "/api/sessions" },
	{ method: "GET", path: "/api/sessions/:id" },
	{ method: "PUT", path: "/api/sessions/:id" },
	{ method: "GET", path: "/api/progress" },
] as const;

export type IdentityProfile = { name: string | null; avatar: string | null };

export const ERROR_CODES = [
	"unauthorized",
	"forbidden",
	"owner_not_configured",
	"invalid_request",
	"validation_failed",
	"not_found",
	"conflict",
	"payload_too_large",
	"origin_rejected",
	"auth_configuration_error",
	"internal_error",
] as const;

export const strengthExerciseIdSchema = z.enum([
	"goblet-squat",
	"romanian-deadlift",
	"chest-press",
	"cable-row",
	"lat-pulldown",
	"shoulder-press",
	"dumbbell-curl",
	"triceps-kickback",
	"lateral-raise",
	"bent-over-row",
	"calf-raise",
]);

export const equipmentIdSchema = z.enum([
	"dumbbell",
	"bench",
	"cable-machine",
	"lat-pulldown-machine",
	"chest-press-machine",
]);

export const loadConventionSchema = z.enum(["total-external", "per-hand", "machine-stack"]);
export const reviewStatusSchema = z.enum(["draft", "reviewed"]);
export const experienceSchema = z.enum(["beginner", "returning"]);
export const goalPreferenceSchema = z.enum(["strength-first", "endurance-first"]);
export const guidanceModeSchema = z.enum(["generic-estimates", "disabled", "clinician-range"]);
export const measurementKindSchema = z.enum(["height", "weight"]);
export const sessionStatusSchema = z.enum(["draft", "active", "completed", "abandoned"]);
export const setResultSchema = z.enum(["performed", "skipped", "not-recorded"]);
export const cardioModalitySchema = z.enum(["cycling", "easy-aerobic"]);
export const cardioIntensitySchema = z.enum(["easy", "moderate", "vigorous", "unknown"]);
export const sessionBlockKindSchema = z.enum(["preparation", "strength", "cardio", "recovery"]);
export const weekdaySchema = z.enum(WEEKDAYS);
export const resourceEnvSchema = z.enum(["local", "test", "production"]);

export const dateOnlySchema = z
	.string()
	.refine(isValidDateOnly, { error: "date must be a valid YYYY-MM-DD calendar date" });
export const monthSchema = z
	.string()
	.refine(isValidMonth, { error: "month must be a valid YYYY-MM value" });
export const utcInstantSchema = z
	.string()
	.refine(isUtcInstant, { error: "timestamp must be a UTC instant ending in Z" });
export const uuidSchema = z.uuid();
export const timeZoneSchema = z
	.string()
	.min(1)
	.max(64)
	.refine(isIanaTimeZone, { error: "timezone must be a confirmed IANA identifier" });
export const versionSchema = z.int().positive();
export const expectedVersionSchema = z.int().min(0);
export const finitePositiveSchema = z.number().finite().positive();
export const finiteNonNegativeSchema = z.number().finite().nonnegative();

export const weekdayListSchema = z
	.array(weekdaySchema)
	.max(7)
	.refine((days) => new Set(days).size === days.length, { error: "weekdays must be unique" });

export const clinicianRangeSchema = z.strictObject({
	minBpm: z.int().min(40).max(220),
	maxBpm: z.int().min(40).max(220),
	effectiveDate: dateOnlySchema,
	sourceNote: z.string().trim().max(200),
});

export const profilePreferencesSchema = z.strictObject({
	experience: experienceSchema,
	goalPreference: goalPreferenceSchema,
	weeklyFrequency: z.int().min(1).max(7),
	preferredWeekdays: weekdayListSchema,
	cardioOnlyWeekdays: weekdayListSchema,
	sessionTimeBudgetMinutes: z.int().min(20).max(180),
	equipmentIds: z.array(equipmentIdSchema).max(16),
	weighInCadenceDays: z.int().min(1).max(90).nullable(),
});

export const guidanceSettingsSchema = z
	.strictObject({
		mode: guidanceModeSchema,
		clinicianRange: clinicianRangeSchema.nullable(),
	})
	.refine(
		(value) =>
			value.mode === "clinician-range"
				? value.clinicianRange !== null && value.clinicianRange.minBpm < value.clinicianRange.maxBpm
				: value.clinicianRange === null,
		{ error: "clinician range is required only when guidance mode is clinician-range" },
	);

export const mutationMetaSchema = z.strictObject({
	expectedVersion: expectedVersionSchema,
	mutationId: uuidSchema,
});

export const putProfileRequestSchema = mutationMetaSchema.extend({
	birthday: dateOnlySchema.nullable(),
	timezone: timeZoneSchema,
	preferences: profilePreferencesSchema,
	guidance: guidanceSettingsSchema,
});

export const profileRecordSchema = z.strictObject({
	id: z.literal(PROFILE_ID),
	birthday: dateOnlySchema.nullable(),
	timezone: timeZoneSchema,
	preferences: profilePreferencesSchema,
	guidance: guidanceSettingsSchema,
	version: versionSchema,
	lastMutationId: uuidSchema,
	createdAt: utcInstantSchema,
	updatedAt: utcInstantSchema,
});

export const profileReadinessSchema = z.strictObject({
	hasProfile: z.boolean(),
	hasBirthday: z.boolean(),
	hasHeight: z.boolean(),
	hasWeight: z.boolean(),
	recommendationScope: z.enum(["in-scope", "out-of-scope", "unknown-age"]),
	guidance: z.enum(["available", "disabled", "clinician-override", "unavailable"]),
});

export const defaultProfileValuesSchema = z.strictObject({
	timezone: timeZoneSchema,
	preferences: profilePreferencesSchema,
	guidance: guidanceSettingsSchema,
});

export const warningSchema = z.strictObject({
	code: z.string().min(1).max(64),
	message: z.string().min(1).max(300),
});

export const putMeasurementRequestSchema = mutationMetaSchema.extend({
	kind: measurementKindSchema,
	effectiveDate: dateOnlySchema,
	value: finitePositiveSchema,
});

export const deleteMeasurementRequestSchema = mutationMetaSchema;

export const measurementRecordSchema = z.strictObject({
	id: uuidSchema,
	kind: measurementKindSchema,
	effectiveDate: dateOnlySchema,
	value: finitePositiveSchema,
	version: versionSchema,
	lastMutationId: uuidSchema,
	createdAt: utcInstantSchema,
	updatedAt: utcInstantSchema,
});

export const dateRangeQuerySchema = z
	.strictObject({
		from: dateOnlySchema,
		to: dateOnlySchema,
	})
	.refine((range) => range.from <= range.to, { error: "from must be on or before to" })
	.refine(
		(range) =>
			!isValidDateOnly(range.from) ||
			!isValidDateOnly(range.to) ||
			daysInclusive(range.from, range.to) <= MAX_DATE_RANGE_DAYS,
		{
			error: `date range cannot exceed ${MAX_DATE_RANGE_DAYS} days`,
		},
	);

export const workingSetTargetSchema = z.strictObject({
	id: uuidSchema,
	setIndex: z.int().min(1).max(12),
	repsLow: z.int().min(1).max(30),
	repsHigh: z.int().min(1).max(30),
	rirTarget: z.int().min(0).max(5),
	loadKg: finiteNonNegativeSchema.nullable(),
});

export const strengthExerciseTargetSchema = z.strictObject({
	id: uuidSchema,
	exerciseId: strengthExerciseIdSchema,
	name: z.string().min(1).max(80),
	catalogVersion: z.string().min(1).max(32),
	equipmentId: equipmentIdSchema,
	loadConvention: loadConventionSchema,
	warmUpSetCount: z.int().min(0).max(4),
	workingSets: z.array(workingSetTargetSchema).min(1).max(8),
	restSeconds: z.int().min(30).max(300),
});

export const cardioSegmentTargetSchema = z.strictObject({
	id: uuidSchema,
	role: z.enum(["preparation", "main", "recovery"]),
	modality: cardioModalitySchema,
	plannedMinutes: z.int().min(1).max(180),
	plannedIntensity: cardioIntensitySchema.exclude(["unknown"]),
});

export const sessionBlockTargetSchema = z.strictObject({
	kind: sessionBlockKindSchema,
	durationMinutes: z.int().min(1).max(180),
	exercises: z.array(strengthExerciseTargetSchema).max(8),
	cardio: cardioSegmentTargetSchema.nullable(),
});

export const sessionTargetSchema = z.strictObject({
	catalogVersion: z.string().min(1).max(32),
	algorithmVersion: z.string().min(1).max(32),
	timeBudgetMinutes: z.int().min(20).max(180),
	emphasis: z.enum(["full-body", "full-body-a", "full-body-b", "cardio", "recovery"]),
	blocks: z.array(sessionBlockTargetSchema).min(1).max(6),
});

export const workingSetActualSchema = z.strictObject({
	id: uuidSchema,
	status: setResultSchema,
	reps: z.int().min(0).max(50).nullable(),
	loadKg: finiteNonNegativeSchema.nullable(),
	rir: z.int().min(0).max(10).nullable(),
});

export const strengthExerciseActualSchema = z.strictObject({
	id: uuidSchema,
	sets: z.array(workingSetActualSchema).max(12),
});

export const cardioSegmentActualSchema = z.strictObject({
	id: uuidSchema,
	role: z.enum(["preparation", "main", "recovery"]),
	actualMinutes: finiteNonNegativeSchema.max(180),
	intensity: cardioIntensitySchema,
});

export const sessionActualSchema = z.strictObject({
	exercises: z.array(strengthExerciseActualSchema).max(8),
	cardioSegments: z.array(cardioSegmentActualSchema).max(6),
	painFlag: z.boolean(),
	perceivedEffort: z.int().min(0).max(10).nullable(),
	completedAsPlanned: z.boolean(),
	notes: z.string().max(2000),
});

export const sessionRecordSchema = z.strictObject({
	id: uuidSchema,
	sourcePlanRevision: z.int().positive().nullable(),
	localDate: dateOnlySchema,
	timezone: timeZoneSchema,
	status: sessionStatusSchema,
	target: sessionTargetSchema,
	actual: sessionActualSchema.nullable(),
	version: versionSchema,
	lastMutationId: uuidSchema,
	createdAt: utcInstantSchema,
	updatedAt: utcInstantSchema,
});

export const putSessionRequestSchema = mutationMetaSchema.extend({
	sourcePlanRevision: z.int().positive().nullable(),
	localDate: dateOnlySchema,
	timezone: timeZoneSchema,
	status: sessionStatusSchema,
	target: sessionTargetSchema,
	actual: sessionActualSchema.nullable(),
});

export const planInputSchema = z.strictObject({
	timezone: timeZoneSchema,
	reviewMonth: monthSchema,
	weeklyFrequency: z.int().min(1).max(7),
	preferredWeekdays: weekdayListSchema,
	cardioOnlyWeekdays: weekdayListSchema,
	sessionTimeBudgetMinutes: z.int().min(20).max(180),
	goalPreference: goalPreferenceSchema,
	experience: experienceSchema,
	equipmentIds: z.array(equipmentIdSchema).max(16),
});

export const weeklySlotSchema = z.strictObject({
	weekday: weekdaySchema,
	kind: z.enum(["strength", "cardio", "recovery"]),
	emphasis: z.enum(["full-body", "full-body-a", "full-body-b", "cardio", "recovery"]),
	timeBudgetMinutes: z.int().min(20).max(180),
	target: sessionTargetSchema,
});

export const planRationaleSchema = z.strictObject({
	explanations: z.array(z.string().min(1).max(400)).max(20),
	compromises: z.array(z.string().min(1).max(400)).max(20),
	unfilledRequirements: z.array(z.string().min(1).max(400)).max(20),
	coverageGaps: z.array(z.string().min(1).max(400)).max(20),
});

export const weeklyTemplateSchema = z.strictObject({
	slots: z.array(weeklySlotSchema).min(1).max(7),
});

export const planPreviewSchema = z.strictObject({
	algorithmVersion: z.literal(ALGORITHM_VERSION),
	catalogVersion: z.literal(CATALOG_VERSION),
	input: planInputSchema,
	template: weeklyTemplateSchema,
	rationale: planRationaleSchema,
	limitations: z.array(z.string().min(1).max(400)).max(20),
});

export const putPlanRequestSchema = z.strictObject({
	expectedRevision: expectedVersionSchema,
	input: planInputSchema,
});

export const planRevisionRecordSchema = z.strictObject({
	revision: versionSchema,
	requestId: uuidSchema,
	reviewMonth: monthSchema,
	acceptedAt: utcInstantSchema,
	algorithmVersion: z.string().min(1).max(32),
	catalogVersion: z.string().min(1).max(32),
	input: planInputSchema,
	template: weeklyTemplateSchema,
	rationale: planRationaleSchema,
});

export const heartRateEstimateSchema = z.strictObject({
	ageYears: z.int().min(0).max(120),
	estimatedHrMax: z.number().finite().positive(),
	moderateBpm: z.tuple([z.number().finite().positive(), z.number().finite().positive()]),
	vigorousBpm: z.tuple([z.number().finite().positive(), z.number().finite().positive()]),
	displayedModerateBpm: z.tuple([z.int().positive(), z.int().positive()]),
	displayedVigorousBpm: z.tuple([z.int().positive(), z.int().positive()]),
	method: z.literal("tanaka-208-0.7-age"),
	scopeNote: z.string().min(1).max(400),
});

export const bmiPointSchema = z.strictObject({
	effectiveDate: dateOnlySchema,
	weightKg: finitePositiveSchema,
	heightCm: finitePositiveSchema,
	bmi: finitePositiveSchema,
	displayedBmi: z.string().regex(/^\d+\.\d$/),
});

export const weeklyTotalSchema = z.strictObject({
	weekStart: dateOnlySchema,
	moderateEquivalentMinutes: finiteNonNegativeSchema,
	actualModerateMinutes: finiteNonNegativeSchema,
	actualVigorousMinutes: finiteNonNegativeSchema,
	strengthSessions: z.int().min(0),
	completedSessions: z.int().min(0),
});

export const progressMeasurementSchema = z.strictObject({
	id: uuidSchema,
	kind: measurementKindSchema,
	effectiveDate: dateOnlySchema,
	value: finitePositiveSchema,
	bmi: finitePositiveSchema.nullable(),
	displayedBmi: z
		.string()
		.regex(/^\d+\.\d$/)
		.nullable(),
});

export const progressSessionSchema = z.strictObject({
	id: uuidSchema,
	localDate: dateOnlySchema,
	status: sessionStatusSchema,
	actualCardioMinutes: finiteNonNegativeSchema.nullable(),
	moderateEquivalentMinutes: finiteNonNegativeSchema,
});

export const liveResponseSchema = z.strictObject({
	ok: z.literal(true),
	version: z.string().min(1),
	revision: z.string().min(1),
	environment: resourceEnvSchema,
});

export const apiErrorBodySchema = z.strictObject({
	error: z.strictObject({
		code: z.enum(ERROR_CODES),
		message: z.string().min(1).max(400),
		currentVersion: z.int().min(0).optional(),
		currentRevision: z.int().min(0).optional(),
	}),
});

export const apiDataSchema = <T extends z.ZodType>(data: T) => z.strictObject({ data });

export const defaultPreferences: ProfilePreferences = {
	experience: "beginner",
	goalPreference: "strength-first",
	weeklyFrequency: 3,
	preferredWeekdays: ["monday", "wednesday", "friday"],
	cardioOnlyWeekdays: [],
	sessionTimeBudgetMinutes: 60,
	equipmentIds: [
		"dumbbell",
		"bench",
		"cable-machine",
		"lat-pulldown-machine",
		"chest-press-machine",
	],
	weighInCadenceDays: 7,
};

export const defaultGuidance: GuidanceSettings = {
	mode: "generic-estimates",
	clinicianRange: null,
};

export type StrengthExerciseId = z.infer<typeof strengthExerciseIdSchema>;
export type EquipmentId = z.infer<typeof equipmentIdSchema>;
export type LoadConvention = z.infer<typeof loadConventionSchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type GoalPreference = z.infer<typeof goalPreferenceSchema>;
export type GuidanceMode = z.infer<typeof guidanceModeSchema>;
export type MeasurementKind = z.infer<typeof measurementKindSchema>;
export type SessionStatus = z.infer<typeof sessionStatusSchema>;
export type SetResult = z.infer<typeof setResultSchema>;
export type CardioModality = z.infer<typeof cardioModalitySchema>;
export type CardioIntensity = z.infer<typeof cardioIntensitySchema>;
export type SessionBlockKind = z.infer<typeof sessionBlockKindSchema>;
export type ResourceEnv = z.infer<typeof resourceEnvSchema>;
export type ErrorCode = (typeof ERROR_CODES)[number];
export type ProfilePreferences = z.infer<typeof profilePreferencesSchema>;
export type GuidanceSettings = z.infer<typeof guidanceSettingsSchema>;
export type ClinicianRange = z.infer<typeof clinicianRangeSchema>;
export type PutProfileRequest = z.infer<typeof putProfileRequestSchema>;
export type ProfileRecord = z.infer<typeof profileRecordSchema>;
export type ProfileReadiness = z.infer<typeof profileReadinessSchema>;
export type DefaultProfileValues = z.infer<typeof defaultProfileValuesSchema>;
export type Warning = z.infer<typeof warningSchema>;
export type PutMeasurementRequest = z.infer<typeof putMeasurementRequestSchema>;
export type DeleteMeasurementRequest = z.infer<typeof deleteMeasurementRequestSchema>;
export type MeasurementRecord = z.infer<typeof measurementRecordSchema>;
export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;
export type WorkingSetTarget = z.infer<typeof workingSetTargetSchema>;
export type StrengthExerciseTarget = z.infer<typeof strengthExerciseTargetSchema>;
export type CardioSegmentTarget = z.infer<typeof cardioSegmentTargetSchema>;
export type SessionBlockTarget = z.infer<typeof sessionBlockTargetSchema>;
export type SessionTarget = z.infer<typeof sessionTargetSchema>;
export type WorkingSetActual = z.infer<typeof workingSetActualSchema>;
export type StrengthExerciseActual = z.infer<typeof strengthExerciseActualSchema>;
export type CardioSegmentActual = z.infer<typeof cardioSegmentActualSchema>;
export type SessionActual = z.infer<typeof sessionActualSchema>;
export type SessionRecord = z.infer<typeof sessionRecordSchema>;
export type PutSessionRequest = z.infer<typeof putSessionRequestSchema>;
export type PlanInput = z.infer<typeof planInputSchema>;
export type WeeklySlot = z.infer<typeof weeklySlotSchema>;
export type PlanRationale = z.infer<typeof planRationaleSchema>;
export type WeeklyTemplate = z.infer<typeof weeklyTemplateSchema>;
export type PlanPreview = z.infer<typeof planPreviewSchema>;
export type PutPlanRequest = z.infer<typeof putPlanRequestSchema>;
export type PlanRevisionRecord = z.infer<typeof planRevisionRecordSchema>;
export type HeartRateEstimate = z.infer<typeof heartRateEstimateSchema>;
export type BmiPoint = z.infer<typeof bmiPointSchema>;
export type WeeklyTotal = z.infer<typeof weeklyTotalSchema>;
export type ProgressMeasurement = z.infer<typeof progressMeasurementSchema>;
export type ProgressSession = z.infer<typeof progressSessionSchema>;
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
export type ApiData<T> = { data: T };
export type { Weekday };

export type GetProfileResponse = {
	profile: ProfileRecord | null;
	defaults: DefaultProfileValues;
	readiness: ProfileReadiness;
	algorithmVersion: typeof ALGORITHM_VERSION;
	catalogVersion: typeof CATALOG_VERSION;
	warnings: Warning[];
};

export type PutProfileResponse = {
	profile: ProfileRecord;
	readiness: ProfileReadiness;
	warnings: Warning[];
};

export type GetMeasurementsResponse = {
	measurements: MeasurementRecord[];
};

export type PutMeasurementResponse = {
	measurement: MeasurementRecord;
	warnings: Warning[];
};

export type DeleteMeasurementResponse = {
	deleted: MeasurementRecord;
	affectedBmiDates: string[];
};

export type GetPlansResponse = {
	current: PlanRevisionRecord | null;
	history: PlanRevisionRecord[];
};

export type PlanPreviewResponse = {
	preview: PlanPreview | null;
	limitations: string[];
};

export type PutPlanResponse = {
	revision: PlanRevisionRecord;
};

export type GetSessionsResponse = {
	sessions: SessionRecord[];
};

export type PutSessionResponse = {
	session: SessionRecord;
	warnings: Warning[];
};

export type GetProgressResponse = {
	from: string;
	to: string;
	measurements: ProgressMeasurement[];
	sessions: ProgressSession[];
	weeklyTotals: WeeklyTotal[];
};

export type LiveResponse = z.infer<typeof liveResponseSchema>;

export function parseWithSchema<T>(
	schema: z.ZodType<T>,
	value: unknown,
	message = "Invalid request",
): T {
	const result = schema.safeParse(value);
	if (!result.success) {
		const detail = result.error.issues
			.map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`)
			.join("; ");
		throw new ApiError(400, "validation_failed", `${message}: ${detail}`);
	}
	return result.data;
}

export class ApiError extends Error {
	readonly status: number;
	readonly code: ErrorCode;
	readonly currentVersion?: number;
	readonly currentRevision?: number;

	constructor(
		status: number,
		code: ErrorCode,
		message: string,
		options?: { currentVersion?: number; currentRevision?: number },
	) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.code = code;
		this.currentVersion = options?.currentVersion;
		this.currentRevision = options?.currentRevision;
	}
}

export function ok<T>(data: T): ApiData<T> {
	return { data };
}

export function errorBody(error: ApiError): ApiErrorBody {
	return {
		error: {
			code: error.code,
			message: error.message,
			...(error.currentVersion !== undefined ? { currentVersion: error.currentVersion } : {}),
			...(error.currentRevision !== undefined ? { currentRevision: error.currentRevision } : {}),
		},
	};
}
