import { expect, test } from "bun:test";
import {
	type ApiData,
	type ApiErrorBody,
	type DeleteSessionResponse,
	MAX_BODY_BYTES,
	type PutSessionRequest,
	type SessionRecord,
} from "../../src/domain/contracts";
import { actualFromTarget, sessionTarget, uuid } from "../helpers/fixtures";
import { assertMarker, type TestRun } from "../helpers/isolation";

function harness() {
	const origin = process.env.RHINO_TEST_URL;
	if (
		!origin ||
		!process.env.RHINO_TEST_TOKENS ||
		!process.env.RHINO_TEST_STATE ||
		!process.env.RHINO_TEST_RUN_ID ||
		!process.env.RHINO_TEST_CONFIG
	)
		throw new Error("L2 requires the isolated runner");
	const state: TestRun = {
		state: process.env.RHINO_TEST_STATE,
		id: process.env.RHINO_TEST_RUN_ID,
		config: process.env.RHINO_TEST_CONFIG,
		env: process.env,
	};
	const tokens = JSON.parse(process.env.RHINO_TEST_TOKENS) as Record<string, string>;
	const call = async (
		method: string,
		path: string,
		body?: unknown,
		headers: Record<string, string> = {},
	) => {
		if (method !== "GET") await assertMarker(state);
		const response = await fetch(origin + path, {
			method,
			headers: {
				"Cf-Access-Jwt-Assertion": tokens.owner ?? "",
				Origin: origin,
				"Content-Type": "application/json",
				...headers,
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		});
		expect(response.headers.get("cache-control")).toBe("no-store");
		return response;
	};
	return { call, tokens };
}

test("session deletion is authorized, versioned, permanent and idempotent on real D1", async () => {
	const { call, tokens } = harness();
	const id = uuid();
	const path = `/api/sessions/${id}`;
	const target = sessionTarget();
	const original: PutSessionRequest = {
		expectedVersion: 0,
		mutationId: uuid(),
		sourcePlanRevision: null,
		localDate: "2026-10-09",
		timezone: "Asia/Shanghai",
		status: "draft",
		target,
		actual: null,
	};
	expect((await call("PUT", path, original)).status).toBe(200);
	for (const [token, status] of [
		["", 401],
		[tokens.other ?? "", 403],
		[tokens.badSignature ?? "", 403],
		[tokens.expired ?? "", 403],
	] as const)
		expect(
			(await call("DELETE", path, { expectedVersion: 1 }, { "Cf-Access-Jwt-Assertion": token }))
				.status,
		).toBe(status);
	const rejectedHeaders: Record<string, string>[] = [
		{ Origin: "https://evil.example.test" },
		{ Origin: "" },
		{ "Sec-Fetch-Site": "cross-site" },
	];
	for (const headers of rejectedHeaders)
		expect((await call("DELETE", path, { expectedVersion: 1 }, headers)).status).toBe(403);
	for (const body of [
		{},
		{ expectedVersion: 0 },
		{ expectedVersion: -1 },
		{ expectedVersion: 1.5 },
		{ expectedVersion: "1" },
		{ expectedVersion: 1, mutationId: uuid() },
	])
		expect((await call("DELETE", path, body)).status).toBe(400);
	expect(
		(await call("DELETE", path, { expectedVersion: 1 }, { "Content-Type": "text/plain" })).status,
	).toBe(400);
	expect((await call("DELETE", path, "x".repeat(MAX_BODY_BYTES))).status).toBe(413);
	expect((await call("GET", path)).status).toBe(200);
	expect(
		(
			await call("PUT", path, {
				...original,
				expectedVersion: 1,
				mutationId: uuid(),
				status: "active",
			})
		).status,
	).toBe(200);
	expect(
		(
			await call("PUT", path, {
				...original,
				expectedVersion: 2,
				mutationId: uuid(),
				status: "completed",
				actual: actualFromTarget(target),
			})
		).status,
	).toBe(200);
	const before = (await (await call("GET", path)).json()) as ApiData<{ session: SessionRecord }>;
	expect(before.data.session.version).toBe(3);
	const stale = await call("DELETE", path, { expectedVersion: 2 });
	expect(stale.status).toBe(409);
	expect((await stale.json()) as ApiErrorBody).toMatchObject({ error: { currentVersion: 3 } });
	expect((await (await call("GET", path)).json()) as typeof before).toEqual(before);
	const range = "from=2026-10-09&to=2026-10-09";
	const progressBefore = (await (await call("GET", `/api/progress?${range}`)).json()) as ApiData<{
		sessions: { id: string }[];
		weeklyTotals: { completedSessions: number }[];
	}>;
	expect(progressBefore.data.sessions.some((session) => session.id === id)).toBe(true);
	const deleted = await call("DELETE", path, { expectedVersion: 3 });
	expect(deleted.status).toBe(200);
	expect((await deleted.json()) as ApiData<DeleteSessionResponse>).toEqual({ data: { id } });
	for (const version of [3, 1, 999]) {
		const repeat = await call("DELETE", path, { expectedVersion: version });
		expect(repeat.status).toBe(200);
		expect((await repeat.json()) as ApiData<DeleteSessionResponse>).toEqual({ data: { id } });
	}
	expect((await call("GET", path)).status).toBe(404);
	const list = (await (await call("GET", `/api/sessions?${range}`)).json()) as ApiData<{
		sessions: { id: string }[];
	}>;
	expect(list.data.sessions.some((session) => session.id === id)).toBe(false);
	const progressAfter = (await (
		await call("GET", `/api/progress?${range}`)
	).json()) as typeof progressBefore;
	expect(progressAfter.data.sessions.some((session) => session.id === id)).toBe(false);
	expect(
		progressAfter.data.weeklyTotals.reduce((sum, week) => sum + week.completedSessions, 0),
	).toBe(
		progressBefore.data.weeklyTotals.reduce((sum, week) => sum + week.completedSessions, 0) - 1,
	);
	for (const retry of [
		original,
		{ ...original, mutationId: uuid() },
		{ ...original, expectedVersion: 3, mutationId: uuid() },
	])
		expect((await call("PUT", path, retry)).status).toBe(409);
	expect((await call("GET", path)).status).toBe(404);
	const unknown = uuid();
	expect((await call("DELETE", `/api/sessions/${unknown}`, { expectedVersion: 1 })).status).toBe(
		404,
	);
	expect(
		(await call("PUT", `/api/sessions/${unknown}`, { ...original, mutationId: uuid() })).status,
	).toBe(200);
	expect((await call("DELETE", `/api/sessions/${unknown}`, { expectedVersion: 1 })).status).toBe(
		200,
	);
}, 120_000);

test("concurrent D1 put and delete preserve the newer version or prevent resurrection", async () => {
	const { call } = harness();
	for (let run = 0; run < 3; run++) {
		const id = uuid();
		const path = `/api/sessions/${id}`;
		const original = {
			expectedVersion: 0,
			mutationId: uuid(),
			sourcePlanRevision: null,
			localDate: "2026-10-09",
			timezone: "Asia/Shanghai",
			status: "draft",
			target: sessionTarget(),
			actual: null,
		};
		expect((await call("PUT", path, original)).status).toBe(200);
		const responses = await Promise.all([
			call("PUT", path, {
				...original,
				expectedVersion: 1,
				mutationId: uuid(),
				target: { ...original.target, timeBudgetMinutes: 55 },
			}),
			call("DELETE", path, { expectedVersion: 1 }),
		]);
		expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
		if (responses[0]?.status === 200) {
			const stored = (await (await call("GET", path)).json()) as ApiData<{
				session: SessionRecord;
			}>;
			expect(stored.data.session.version).toBe(2);
			expect(stored.data.session.target.timeBudgetMinutes).toBe(55);
			expect((await call("DELETE", path, { expectedVersion: 1 })).status).toBe(409);
			expect((await call("DELETE", path, { expectedVersion: 2 })).status).toBe(200);
		}
		expect((await call("PUT", path, original)).status).toBe(409);
		expect((await call("GET", path)).status).toBe(404);
		const repeats = await Promise.all(
			[1, 2].map(() => call("DELETE", path, { expectedVersion: 1 })),
		);
		expect(repeats.map((response) => response.status)).toEqual([200, 200]);
	}
}, 120_000);
