import {
	ApiError,
	dateRangeQuerySchema,
	parseWithSchema,
	putSessionRequestSchema,
	uuidSchema,
} from "../../src/domain/contracts";
import { utcNow } from "../../src/domain/dates";
import { contentHash } from "../../src/domain/hash";
import { isFutureLocalDate } from "../../src/domain/metrics";
import { assertTransition, validateSessionActual } from "../../src/domain/session";
import * as db from "../db";
import type { WorkerEnv } from "../env";
import { jsonOk, queryValue, readJsonBody } from "../http";
import { asCurrent, assertConcurrentRetry, decideOrThrow } from "../versioned";

export async function getSessions(url: URL, env: WorkerEnv): Promise<Response> {
	const range = parseWithSchema(dateRangeQuerySchema, {
		from: queryValue(url, "from"),
		to: queryValue(url, "to"),
	});
	return jsonOk({ sessions: await db.listSessions(env.DB, range.from, range.to) });
}

export async function getSession(env: WorkerEnv, id: string): Promise<Response> {
	parseWithSchema(uuidSchema, id, "Session id");
	const session = await db.getSession(env.DB, id);
	if (!session) {
		throw new ApiError(404, "not_found", "Session not found");
	}
	return jsonOk({ session });
}

export async function putSession(request: Request, env: WorkerEnv, id: string): Promise<Response> {
	parseWithSchema(uuidSchema, id, "Session id");
	const payload = parseWithSchema(putSessionRequestSchema, await readJsonBody(request));
	if (isFutureLocalDate(payload.localDate, payload.timezone)) {
		throw new ApiError(400, "validation_failed", "Workout date cannot be in the future");
	}
	validateSessionActual(payload.target, payload.actual, payload.status);
	const existing = await db.getSession(env.DB, id);
	assertTransition(existing?.status ?? null, payload.status);
	if (existing && existing.status !== "draft") {
		const snapshot = (value: typeof payload | typeof existing) => ({
			target: value.target,
			localDate: value.localDate,
			timezone: value.timezone,
			sourcePlanRevision: value.sourcePlanRevision,
		});
		if ((await contentHash(snapshot(existing))) !== (await contentHash(snapshot(payload)))) {
			throw new ApiError(409, "conflict", "Started session targets and provenance are immutable", {
				currentVersion: existing.version,
			});
		}
	}
	if (payload.sourcePlanRevision !== null) {
		if (!(await db.planRevisionExists(env.DB, payload.sourcePlanRevision))) {
			throw new ApiError(400, "validation_failed", "sourcePlanRevision does not exist");
		}
	}
	const hash = await contentHash({
		sourcePlanRevision: payload.sourcePlanRevision,
		localDate: payload.localDate,
		timezone: payload.timezone,
		status: payload.status,
		target: payload.target,
		actual: payload.actual,
	});
	const current = asCurrent(await db.getSessionVersioned(env.DB, id));
	const decision = decideOrThrow({
		current,
		expectedVersion: payload.expectedVersion,
		mutationId: payload.mutationId,
		contentHash: hash,
	});
	const now = utcNow();
	if (decision.action === "idempotent") {
		const session = await db.getSession(env.DB, id);
		if (!session) {
			throw new ApiError(500, "internal_error", "Internal error");
		}
		return jsonOk({ session, warnings: [] });
	}
	if (decision.action === "insert") {
		const inserted = await db.insertSession(
			env.DB,
			{
				id,
				sourcePlanRevision: payload.sourcePlanRevision,
				localDate: payload.localDate,
				timezone: payload.timezone,
				status: payload.status,
				target: payload.target,
				actual: payload.actual,
				version: 1,
				lastMutationId: payload.mutationId,
				createdAt: now,
				updatedAt: now,
			},
			hash,
		);
		if (!inserted)
			assertConcurrentRetry(await db.getSessionVersioned(env.DB, id), payload.mutationId, hash);
		const session = await db.getSession(env.DB, id);
		if (!session) {
			throw new ApiError(500, "internal_error", "Internal error");
		}
		return jsonOk({ session, warnings: [] });
	}
	if (!existing) {
		throw new ApiError(404, "not_found", "Session not found");
	}
	const updated = await db.updateSession(
		env.DB,
		{
			...existing,
			sourcePlanRevision: payload.sourcePlanRevision,
			localDate: payload.localDate,
			timezone: payload.timezone,
			status: payload.status,
			target: payload.target,
			actual: payload.actual,
			version: decision.nextVersion,
			lastMutationId: payload.mutationId,
			updatedAt: now,
		},
		payload.expectedVersion,
		hash,
	);
	if (!updated) {
		assertConcurrentRetry(await db.getSessionVersioned(env.DB, id), payload.mutationId, hash);
	}
	const session = await db.getSession(env.DB, id);
	if (!session) {
		throw new ApiError(500, "internal_error", "Internal error");
	}
	return jsonOk({ session, warnings: [] });
}
