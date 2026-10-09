import {
	ApiError,
	type DeleteMeasurementRequest,
	dateRangeQuerySchema,
	deleteMeasurementRequestSchema,
	type PutMeasurementRequest,
	parseWithSchema,
	putMeasurementRequestSchema,
	uuidSchema,
	type Warning,
} from "../../src/domain/contracts";
import { utcNow } from "../../src/domain/dates";
import { contentHash } from "../../src/domain/hash";
import { affectedBmiDates, isFutureLocalDate, measurementWarnings } from "../../src/domain/metrics";
import * as db from "../db";
import type { WorkerEnv } from "../env";
import { jsonOk, queryValue, readJsonBody } from "../http";
import { asCurrent, assertConcurrentRetry, decideOrThrow } from "../versioned";

export async function getMeasurements(url: URL, env: WorkerEnv): Promise<Response> {
	const range = parseWithSchema(dateRangeQuerySchema, {
		from: queryValue(url, "from"),
		to: queryValue(url, "to"),
	});
	return jsonOk({ measurements: await db.listMeasurements(env.DB, range.from, range.to) });
}

export async function putMeasurement(
	request: Request,
	env: WorkerEnv,
	id: string,
): Promise<Response> {
	parseWithSchema(uuidSchema, id, "Measurement id");
	const payload = parseWithSchema(
		putMeasurementRequestSchema,
		await readJsonBody(request),
	) satisfies PutMeasurementRequest;
	const profile = await db.getProfile(env.DB);
	const zone = profile?.timezone ?? "UTC";
	if (isFutureLocalDate(payload.effectiveDate, zone)) {
		throw new ApiError(400, "validation_failed", "Effective date cannot be in the future");
	}
	let warnings: Warning[];
	try {
		warnings = measurementWarnings(payload.kind, payload.value);
	} catch {
		throw new ApiError(
			400,
			"validation_failed",
			"Measurement must be a finite positive value in range",
		);
	}
	const hash = await contentHash({
		kind: payload.kind,
		effectiveDate: payload.effectiveDate,
		value: payload.value,
	});
	const duplicate = await db.getMeasurementByKindDate(env.DB, payload.kind, payload.effectiveDate);
	if (duplicate && duplicate.id !== id) {
		throw new ApiError(409, "conflict", "A measurement of this kind already exists on that date", {
			currentVersion: duplicate.version,
		});
	}
	const current = asCurrent(await db.getMeasurementVersioned(env.DB, id));
	const decision = decideOrThrow({
		current,
		expectedVersion: payload.expectedVersion,
		mutationId: payload.mutationId,
		contentHash: hash,
	});
	const now = utcNow();
	if (decision.action === "idempotent") {
		const measurement = await db.getMeasurement(env.DB, id);
		if (!measurement) {
			throw new ApiError(500, "internal_error", "Internal error");
		}
		return jsonOk({ measurement, warnings });
	}
	if (decision.action === "insert") {
		const inserted = await db.insertMeasurement(
			env.DB,
			{
				id,
				kind: payload.kind,
				effectiveDate: payload.effectiveDate,
				value: payload.value,
				version: 1,
				lastMutationId: payload.mutationId,
				createdAt: now,
				updatedAt: now,
			},
			hash,
		);
		if (!inserted)
			assertConcurrentRetry(await db.getMeasurementVersioned(env.DB, id), payload.mutationId, hash);
		const measurement = await db.getMeasurement(env.DB, id);
		if (!measurement) {
			throw new ApiError(500, "internal_error", "Internal error");
		}
		return jsonOk({ measurement, warnings });
	}
	const existing = await db.getMeasurement(env.DB, id);
	if (!existing) {
		throw new ApiError(404, "not_found", "Measurement not found");
	}
	const updated = await db.updateMeasurement(
		env.DB,
		{
			...existing,
			kind: payload.kind,
			effectiveDate: payload.effectiveDate,
			value: payload.value,
			version: decision.nextVersion,
			lastMutationId: payload.mutationId,
			updatedAt: now,
		},
		payload.expectedVersion,
		hash,
	);
	if (!updated) {
		assertConcurrentRetry(await db.getMeasurementVersioned(env.DB, id), payload.mutationId, hash);
	}
	const measurement = await db.getMeasurement(env.DB, id);
	if (!measurement) {
		throw new ApiError(500, "internal_error", "Internal error");
	}
	return jsonOk({ measurement, warnings });
}

export async function deleteMeasurement(
	request: Request,
	env: WorkerEnv,
	id: string,
): Promise<Response> {
	parseWithSchema(uuidSchema, id, "Measurement id");
	const payload = parseWithSchema(
		deleteMeasurementRequestSchema,
		await readJsonBody(request),
	) satisfies DeleteMeasurementRequest;
	const existing = await db.getMeasurement(env.DB, id);
	if (!existing) {
		throw new ApiError(404, "not_found", "Measurement not found");
	}
	if (payload.expectedVersion !== existing.version) {
		throw new ApiError(409, "conflict", "Stored version does not match expectedVersion", {
			currentVersion: existing.version,
		});
	}
	const remaining = (await db.listAllMeasurements(env.DB)).filter((row) => row.id !== id);
	const dates = affectedBmiDates(existing, remaining);
	const deleted = await db.deleteMeasurement(env.DB, id, payload.expectedVersion);
	if (!deleted) {
		throw new ApiError(409, "conflict", "Stored version does not match expectedVersion", {
			currentVersion: existing.version,
		});
	}
	return jsonOk({ deleted: existing, affectedBmiDates: dates });
}
