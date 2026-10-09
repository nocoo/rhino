import {
	ALGORITHM_VERSION,
	ApiError,
	CATALOG_VERSION,
	defaultGuidance,
	defaultPreferences,
	type GetProfileResponse,
	PROFILE_ID,
	type PutProfileRequest,
	type PutProfileResponse,
	parseWithSchema,
	putProfileRequestSchema,
} from "../../src/domain/contracts";
import { localDateInTimeZone, utcNow } from "../../src/domain/dates";
import { contentHash } from "../../src/domain/hash";
import { isFutureLocalDate, profileReadiness } from "../../src/domain/metrics";
import * as db from "../db";
import type { WorkerEnv } from "../env";
import { jsonOk, readJsonBody } from "../http";
import { asCurrent, assertConcurrentRetry, decideOrThrow } from "../versioned";

export async function getProfile(env: WorkerEnv): Promise<Response> {
	const profile = await db.getProfile(env.DB);
	const measurements = await db.listAllMeasurements(env.DB);
	const onDate = localDateInTimeZone(new Date(), profile?.timezone ?? "UTC");
	const body: GetProfileResponse = {
		profile,
		defaults: {
			timezone: "UTC",
			preferences: defaultPreferences,
			guidance: defaultGuidance,
		},
		readiness: profileReadiness(profile, measurements, onDate),
		algorithmVersion: ALGORITHM_VERSION,
		catalogVersion: CATALOG_VERSION,
		warnings: [],
	};
	return jsonOk(body);
}

export async function putProfile(request: Request, env: WorkerEnv): Promise<Response> {
	const payload = parseWithSchema(
		putProfileRequestSchema,
		await readJsonBody(request),
	) satisfies PutProfileRequest;
	if (payload.birthday && isFutureLocalDate(payload.birthday, payload.timezone)) {
		throw new ApiError(400, "validation_failed", "Birthday cannot be in the future");
	}
	const hash = await contentHash({
		birthday: payload.birthday,
		timezone: payload.timezone,
		preferences: payload.preferences,
		guidance: payload.guidance,
	});
	const current = asCurrent(await db.getProfileVersioned(env.DB));
	const decision = decideOrThrow({
		current,
		expectedVersion: payload.expectedVersion,
		mutationId: payload.mutationId,
		contentHash: hash,
	});
	const now = utcNow();
	if (decision.action === "idempotent") {
		return profileResponse(env);
	}
	if (decision.action === "insert") {
		const inserted = await db.insertProfile(
			env.DB,
			{
				id: PROFILE_ID,
				birthday: payload.birthday,
				timezone: payload.timezone,
				preferences: payload.preferences,
				guidance: payload.guidance,
				version: 1,
				lastMutationId: payload.mutationId,
				createdAt: now,
				updatedAt: now,
			},
			hash,
		);
		if (!inserted)
			assertConcurrentRetry(await db.getProfileVersioned(env.DB), payload.mutationId, hash);
		return profileResponse(env);
	}
	const existing = await db.getProfile(env.DB);
	if (!existing) {
		throw new ApiError(409, "conflict", "Stored version does not match expectedVersion", {
			currentVersion: 0,
		});
	}
	const updated = await db.updateProfile(
		env.DB,
		{
			...existing,
			birthday: payload.birthday,
			timezone: payload.timezone,
			preferences: payload.preferences,
			guidance: payload.guidance,
			version: decision.nextVersion,
			lastMutationId: payload.mutationId,
			updatedAt: now,
		},
		payload.expectedVersion,
		hash,
	);
	if (!updated) {
		assertConcurrentRetry(await db.getProfileVersioned(env.DB), payload.mutationId, hash);
	}
	return profileResponse(env);
}

async function profileResponse(env: WorkerEnv): Promise<Response> {
	const profile = await db.getProfile(env.DB);
	if (!profile) {
		throw new ApiError(500, "internal_error", "Internal error");
	}
	const measurements = await db.listAllMeasurements(env.DB);
	const onDate = localDateInTimeZone(new Date(), profile.timezone);
	const body: PutProfileResponse = {
		profile,
		readiness: profileReadiness(profile, measurements, onDate),
		warnings: [],
	};
	return jsonOk(body);
}
