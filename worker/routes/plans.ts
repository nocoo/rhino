import {
	ApiError,
	parseWithSchema,
	planInputSchema,
	putPlanRequestSchema,
	uuidSchema,
} from "../../src/domain/contracts";
import { utcNow } from "../../src/domain/dates";
import { contentHash } from "../../src/domain/hash";
import { previewPlan } from "../../src/domain/planning";
import { decidePlanAccept } from "../../src/domain/saves";
import * as db from "../db";
import type { WorkerEnv } from "../env";
import { jsonOk, readJsonBody } from "../http";

export async function getPlans(env: WorkerEnv): Promise<Response> {
	const history = await db.listPlanRevisions(env.DB);
	return jsonOk({ current: history[0] ?? null, history });
}

export async function previewPlans(request: Request): Promise<Response> {
	const input = parseWithSchema(planInputSchema, await readJsonBody(request));
	const result = previewPlan(input);
	return jsonOk({ preview: result.preview, limitations: result.limitations });
}

export async function putPlan(
	request: Request,
	env: WorkerEnv,
	requestId: string,
): Promise<Response> {
	parseWithSchema(uuidSchema, requestId, "Plan request id");
	const payload = parseWithSchema(putPlanRequestSchema, await readJsonBody(request));
	const computed = previewPlan(payload.input);
	if (!computed.preview) {
		throw new ApiError(
			400,
			"validation_failed",
			computed.limitations.join(" ") || "Plan could not be generated",
		);
	}
	const hash = await contentHash({
		input: computed.preview.input,
		template: computed.preview.template,
		rationale: computed.preview.rationale,
		algorithmVersion: computed.preview.algorithmVersion,
		catalogVersion: computed.preview.catalogVersion,
	});
	const currentRevision = await db.latestPlanRevision(env.DB);
	const existing = await db.getPlanByRequestId(env.DB, requestId);
	const decision = decidePlanAccept({
		currentRevision,
		expectedRevision: payload.expectedRevision,
		existingRequest: existing ? { requestId, contentHash: existing.contentHash } : null,
		requestId,
		contentHash: hash,
	});
	if (decision.action === "conflict") {
		throw new ApiError(
			409,
			"conflict",
			decision.reason === "request_reuse"
				? "Plan request id was reused with different content"
				: "Stored revision does not match expectedRevision",
			{ currentRevision: decision.currentRevision },
		);
	}
	if (decision.action === "idempotent") {
		if (!existing) {
			throw new ApiError(500, "internal_error", "Internal error");
		}
		return jsonOk({ revision: existing });
	}
	const inserted = await db.insertPlanRevision(
		env.DB,
		{
			requestId,
			reviewMonth: payload.input.reviewMonth,
			acceptedAt: utcNow(),
			algorithmVersion: computed.preview.algorithmVersion,
			catalogVersion: computed.preview.catalogVersion,
			input: computed.preview.input,
			template: computed.preview.template,
			rationale: computed.preview.rationale,
		},
		payload.expectedRevision,
		hash,
	);
	if (!inserted) {
		const concurrent = await db.getPlanByRequestId(env.DB, requestId);
		if (concurrent?.contentHash === hash) return jsonOk({ revision: concurrent });
		throw new ApiError(409, "conflict", "Stored revision does not match expectedRevision", {
			currentRevision: await db.latestPlanRevision(env.DB),
		});
	}
	return jsonOk({ revision: inserted });
}
