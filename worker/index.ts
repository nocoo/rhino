import { version } from "../package.json";
import { API_ROUTES, ApiError } from "../src/domain/contracts";
import { authenticate } from "./auth";
import { authorProfile } from "./author-profile";
import type { WorkerEnv } from "./env";
import { jsonError, jsonOk, logSafe, requireOrigin } from "./http";
import { deleteMeasurement, getMeasurements, putMeasurement } from "./routes/measurements";
import { getPlans, previewPlans, putPlan } from "./routes/plans";
import { getProfile, putProfile } from "./routes/profile";
import { getProgress } from "./routes/progress";
import { getSession, getSessions, putSession } from "./routes/sessions";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export default {
	async fetch(request: Request, env: WorkerEnv): Promise<Response> {
		const started = Date.now();
		const url = new URL(request.url);
		const requestId = request.headers.get("cf-ray") ?? crypto.randomUUID();
		const route =
			API_ROUTES.find(
				(item) =>
					item.method === request.method &&
					new RegExp(`^${item.path.replace(/:[^/]+/g, "[^/]+")}$`).test(url.pathname),
			)?.path ?? "unmatched";
		try {
			const response =
				url.pathname === "/api" || url.pathname.startsWith("/api/")
					? await handleApi(request, env, url)
					: await env.ASSETS.fetch(request);
			logSafe({
				requestId,
				method: request.method,
				route,
				status: response.status,
				ms: Date.now() - started,
			});
			return response;
		} catch (error) {
			const apiError =
				error instanceof ApiError ? error : new ApiError(500, "internal_error", "Internal error");
			logSafe({
				requestId,
				method: request.method,
				route,
				status: apiError.status,
				ms: Date.now() - started,
				code: apiError.code,
			});
			return jsonError(apiError);
		}
	},
};

export async function handleApi(
	request: Request,
	env: WorkerEnv,
	url = new URL(request.url),
): Promise<Response> {
	if (request.method === "OPTIONS") {
		throw new ApiError(405, "invalid_request", "Method not allowed");
	}
	const identity = await authenticate(request, env);
	if (MUTATING.has(request.method)) {
		requireOrigin(request, env.APP_ORIGIN);
	}
	const path = url.pathname;
	if (path === "/api/identity" && request.method === "GET") {
		return jsonOk(await authorProfile(identity.email));
	}
	if (path === "/api/live" && request.method === "GET") {
		await env.DB.prepare("SELECT id FROM profile LIMIT 1").all();
		return jsonOk({
			ok: true as const,
			version,
			revision: env.DEPLOY_REVISION,
			environment: env.RESOURCE_ENV,
		});
	}
	if (path === "/api/profile" && request.method === "GET") {
		return getProfile(env);
	}
	if (path === "/api/profile" && request.method === "PUT") {
		return putProfile(request, env);
	}
	if (path === "/api/measurements" && request.method === "GET") {
		return getMeasurements(url, env);
	}
	const measurementMatch = /^\/api\/measurements\/([^/]+)$/.exec(path);
	if (measurementMatch?.[1] && request.method === "PUT") {
		return putMeasurement(request, env, measurementMatch[1]);
	}
	if (measurementMatch?.[1] && request.method === "DELETE") {
		return deleteMeasurement(request, env, measurementMatch[1]);
	}
	if (path === "/api/plans" && request.method === "GET") {
		return getPlans(env);
	}
	if (path === "/api/plans/preview" && request.method === "POST") {
		return previewPlans(request);
	}
	const planMatch = /^\/api\/plans\/([^/]+)$/.exec(path);
	if (planMatch?.[1] && request.method === "PUT") {
		return putPlan(request, env, planMatch[1]);
	}
	if (path === "/api/sessions" && request.method === "GET") {
		return getSessions(url, env);
	}
	const sessionMatch = /^\/api\/sessions\/([^/]+)$/.exec(path);
	if (sessionMatch?.[1] && request.method === "GET") {
		return getSession(env, sessionMatch[1]);
	}
	if (sessionMatch?.[1] && request.method === "PUT") {
		return putSession(request, env, sessionMatch[1]);
	}
	if (path === "/api/progress" && request.method === "GET") {
		return getProgress(url, env);
	}
	throw new ApiError(404, "not_found", "Unknown API route");
}
