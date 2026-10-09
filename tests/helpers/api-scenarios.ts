import { strict as assert } from "node:assert";
import {
	API_ROUTES,
	type ApiData,
	type ApiErrorBody,
	type GetPlansResponse,
	type GetProfileResponse,
	type GetProgressResponse,
	type PutMeasurementResponse,
	type PutPlanResponse,
	type PutProfileResponse,
	type PutSessionResponse,
} from "../../src/domain/contracts";
import { actualFromTarget } from "../../src/features/use-rhino-model";
import { planInput, profileValues, sessionTarget, uuid } from "./fixtures";

export type ApiHarness = {
	request: (path: string, init?: RequestInit) => Promise<Response>;
	tokens: Record<string, string>;
	origin: string;
	guard: () => Promise<void>;
};
export async function exerciseApi(harness: ApiHarness): Promise<void> {
	const covered = new Set<string>();
	const range = "from=2025-10-01&to=2026-10-09";
	async function call<T>(
		method: string,
		path: string,
		body?: unknown,
		status = 200,
		token = harness.tokens.owner,
		headers: Record<string, string> = {},
	): Promise<T> {
		if (["PUT", "POST", "DELETE", "PATCH"].includes(method)) await harness.guard();
		const response = await harness.request(path, {
			method,
			headers: {
				...(token ? { "Cf-Access-Jwt-Assertion": token } : {}),
				Origin: harness.origin,
				"Content-Type": "application/json",
				...headers,
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		});
		assert.equal(response.status, status, `${method} ${path}: ${await response.clone().text()}`);
		assert.equal(response.headers.get("cache-control"), "no-store");
		const result = (await response.json()) as ApiData<T> & ApiErrorBody;
		if (status < 400) {
			const route = API_ROUTES.find(
				(route) =>
					route.method === method &&
					new RegExp(`^${route.path.replace(/:[^/]+/g, "[^/]+")}$`).test(path.split("?")[0] ?? ""),
			);
			if (route) covered.add(`${method} ${route.path}`);
			return result.data;
		}
		assert.ok(result.error.code);
		return result as T;
	}
	const live = await call<{ ok: boolean; version: string; revision: string; environment: string }>(
		"GET",
		"/api/live",
	);
	assert.deepEqual(live, { ok: true, version: "0.1.0", revision: "test", environment: "test" });
	await call("GET", "/api/live", undefined, 200, harness.tokens.rotated);
	await call("GET", "/api/live", undefined, 401, "");
	for (const [key, token] of Object.entries(harness.tokens))
		if (key !== "owner" && key !== "rotated") await call("GET", "/api/live", undefined, 403, token);
	for (const route of API_ROUTES)
		await call(
			route.method,
			route.path.replace(/:[^/]+/g, uuid()) +
				(route.path.endsWith("measurements") ||
				route.path.endsWith("sessions") ||
				route.path.endsWith("progress")
					? `?${range}`
					: ""),
			route.method === "GET" ? undefined : {},
			401,
			"",
		);
	await call("OPTIONS", "/api/live", undefined, 405);
	await call("PATCH", "/api/profile", {}, 404);
	await call("GET", "/api/unknown", undefined, 404);
	await call("PUT", "/api/profile", {}, 403, harness.tokens.owner, {
		Origin: "https://evil.example.test",
	});
	await call("PUT", "/api/profile", {}, 403, harness.tokens.owner, {
		"Sec-Fetch-Site": "cross-site",
	});
	await call("PUT", "/api/profile", {}, 400);
	await call("PUT", "/api/profile", {}, 400, harness.tokens.owner, {
		"Content-Type": "text/plain",
	});
	const initial = await call<GetProfileResponse>("GET", "/api/profile");
	assert.equal(initial.profile, null);
	const profile = { ...profileValues(), expectedVersion: 0, mutationId: uuid() };
	await call("PUT", "/api/profile", { ...profile, birthday: "2099-01-01" }, 400);
	let stored = await call<PutProfileResponse>("PUT", "/api/profile", profile);
	assert.equal(stored.profile.version, 1);
	assert.equal((await call<PutProfileResponse>("PUT", "/api/profile", profile)).profile.version, 1);
	await call("PUT", "/api/profile", { ...profile, birthday: null }, 409);
	await call("PUT", "/api/profile", { ...profile, mutationId: uuid() }, 409);
	stored = await call<PutProfileResponse>("PUT", "/api/profile", {
		...profile,
		expectedVersion: 1,
		mutationId: uuid(),
		birthday: null,
	});
	assert.equal(stored.profile.version, 2);
	const raceProfile = await Promise.all(
		[1, 2].map(async (index) => {
			await harness.guard();
			return harness.request("/api/profile", {
				method: "PUT",
				headers: {
					"Cf-Access-Jwt-Assertion": harness.tokens.owner ?? "",
					Origin: harness.origin,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					...profile,
					expectedVersion: 2,
					mutationId: uuid(),
					birthday: index === 1 ? "1990-01-01" : "1991-01-01",
				}),
			});
		}),
	);
	assert.deepEqual(raceProfile.map((response) => response.status).sort(), [200, 409]);
	await call("GET", `/api/measurements?${range}`);
	await call("GET", "/api/measurements", undefined, 400);
	for (const query of [
		"from=bad&to=bad",
		"from=2026-10-09&to=2026-10-01",
		"from=2020-01-01&to=2026-10-09",
	])
		await call("GET", `/api/measurements?${query}`, undefined, 400);
	const heightId = uuid(),
		weightId = uuid();
	const height = {
		kind: "height",
		effectiveDate: "2025-10-01",
		value: 180.125,
		expectedVersion: 0,
		mutationId: uuid(),
	};
	const weight = {
		kind: "weight",
		effectiveDate: "2026-10-09",
		value: 72.123,
		expectedVersion: 0,
		mutationId: uuid(),
	};
	await call("PUT", "/api/measurements/bad", weight, 400);
	await call("PUT", `/api/measurements/${uuid()}`, { ...weight, effectiveDate: "2099-01-01" }, 400);
	await call("PUT", `/api/measurements/${uuid()}`, { ...weight, value: 1 }, 400);
	await call<PutMeasurementResponse>("PUT", `/api/measurements/${heightId}`, height);
	assert.equal(
		(await call<PutMeasurementResponse>("PUT", `/api/measurements/${weightId}`, weight)).measurement
			.value,
		72.123,
	);
	assert.equal(
		(await call<PutMeasurementResponse>("PUT", `/api/measurements/${weightId}`, weight)).measurement
			.version,
		1,
	);
	await call("PUT", `/api/measurements/${uuid()}`, { ...weight, mutationId: uuid() }, 409);
	await call("PUT", `/api/measurements/${weightId}`, {
		...weight,
		expectedVersion: 1,
		mutationId: uuid(),
		value: 73.5,
	});
	await call("PUT", `/api/measurements/${weightId}`, { ...weight, mutationId: uuid() }, 409);
	await call(
		"DELETE",
		`/api/measurements/${uuid()}`,
		{ expectedVersion: 1, mutationId: uuid() },
		404,
	);
	await call(
		"DELETE",
		`/api/measurements/${heightId}`,
		{ expectedVersion: 9, mutationId: uuid() },
		409,
	);
	const plans = await call<GetPlansResponse>("GET", "/api/plans");
	assert.equal(plans.current, null);
	const input = planInput();
	await call("POST", "/api/plans/preview", input);
	const requestId = uuid();
	const accepted = await call<PutPlanResponse>("PUT", `/api/plans/${requestId}`, {
		expectedRevision: 0,
		input,
	});
	assert.equal(accepted.revision.revision, 1);
	assert.equal(
		(await call<PutPlanResponse>("PUT", `/api/plans/${requestId}`, { expectedRevision: 0, input }))
			.revision.revision,
		1,
	);
	await call(
		"PUT",
		`/api/plans/${requestId}`,
		{ expectedRevision: 1, input: { ...input, weeklyFrequency: 2 } },
		409,
	);
	await call("PUT", `/api/plans/${uuid()}`, { expectedRevision: 0, input }, 409);
	const sessionId = uuid();
	const target = sessionTarget();
	const session = {
		expectedVersion: 0,
		mutationId: uuid(),
		sourcePlanRevision: 1,
		localDate: "2026-10-09",
		timezone: "Asia/Shanghai",
		status: "draft",
		target,
		actual: null,
	};
	await call("GET", `/api/sessions?${range}`);
	await call("GET", `/api/sessions/${uuid()}`, undefined, 404);
	await call("PUT", `/api/sessions/${uuid()}`, { ...session, sourcePlanRevision: 999 }, 400);
	await call("PUT", `/api/sessions/${uuid()}`, { ...session, localDate: "2099-01-01" }, 400);
	await call("PUT", `/api/sessions/${uuid()}`, { ...session, status: "completed" }, 400);
	let saved = await call<PutSessionResponse>("PUT", `/api/sessions/${sessionId}`, session);
	assert.equal(saved.session.version, 1);
	await call("PUT", `/api/sessions/${sessionId}`, session);
	await call(
		"PUT",
		`/api/sessions/${sessionId}`,
		{
			...session,
			expectedVersion: 1,
			mutationId: uuid(),
			status: "completed",
			actual: actualFromTarget(target),
		},
		409,
	);
	saved = await call<PutSessionResponse>("PUT", `/api/sessions/${sessionId}`, {
		...session,
		expectedVersion: 1,
		mutationId: uuid(),
		status: "active",
	});
	const actual = actualFromTarget(target);
	saved = await call<PutSessionResponse>("PUT", `/api/sessions/${sessionId}`, {
		...session,
		expectedVersion: 2,
		mutationId: uuid(),
		status: "completed",
		actual,
	});
	const history = await call<{ session: typeof saved.session }>(
		"GET",
		`/api/sessions/${sessionId}`,
	);
	assert.deepEqual(history.session.actual, actual);
	await call("PUT", `/api/plans/${uuid()}`, {
		expectedRevision: 1,
		input: { ...input, weeklyFrequency: 2 },
	});
	assert.deepEqual(
		(await call<{ session: typeof saved.session }>("GET", `/api/sessions/${sessionId}`)).session
			.target,
		target,
	);
	const progress = await call<GetProgressResponse>("GET", `/api/progress?${range}`);
	assert.ok(progress.weeklyTotals.some((week) => week.completedSessions === 1));
	assert.ok(progress.measurements.find((row) => row.id === weightId)?.bmi);
	const deleted = await call<{ affectedBmiDates: string[] }>(
		"DELETE",
		`/api/measurements/${heightId}`,
		{ expectedVersion: 1, mutationId: uuid() },
	);
	assert.deepEqual(deleted.affectedBmiDates, [weight.effectiveDate]);
	await call("DELETE", `/api/measurements/${weightId}`, { expectedVersion: 2, mutationId: uuid() });
	assert.deepEqual(
		[...covered].sort(),
		API_ROUTES.map((route) => `${route.method} ${route.path}`).sort(),
	);
}
