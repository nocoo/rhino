import { join } from "node:path";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { getPlatformProxy } from "wrangler";
import { contentHash } from "../../src/domain/hash";
import * as db from "../../worker/db";
import type { WorkerEnv } from "../../worker/env";
import worker from "../../worker/index";
import { assertConcurrentRetry } from "../../worker/versioned";
import { planInput, profileValues, sessionRecord, uuid } from "./fixtures";
import { createIdentity } from "./identity";
import {
	assertOwnedPath,
	cleanupDatabase,
	createTestRun,
	initializeDatabase,
	type TestRun,
} from "./isolation";

let state: TestRun,
	env: WorkerEnv,
	proxy: Awaited<ReturnType<typeof getPlatformProxy<WorkerEnv>>>,
	identity: Awaited<ReturnType<typeof createIdentity>>;
const origin = "http://127.0.0.1:17057";
beforeAll(async () => {
	identity = await createIdentity();
	state = createTestRun(origin, identity.jwks);
	await initializeDatabase(state);
	proxy = await getPlatformProxy<WorkerEnv>({
		configPath: state.config,
		environment: "test",
		persist: { path: join(state.state, "v3") },
		remoteBindings: false,
		envFiles: [],
	});
	env = proxy.env;
	vi.spyOn(console, "log").mockImplementation(() => {});
}, 30_000);
afterAll(async () => {
	vi.restoreAllMocks();
	await proxy?.dispose();
	if (state) await cleanupDatabase(state);
});
async function call(path: string, body: unknown) {
	assertOwnedPath(state.state, state.id);
	expect(await env.DB.prepare("SELECT env,run_id FROM _test_marker").first()).toEqual({
		env: "test",
		run_id: state.id,
	});
	return worker.fetch(
		new Request(origin + path, {
			method: "PUT",
			headers: {
				"Cf-Access-Jwt-Assertion": identity.tokens.owner,
				Origin: origin,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		}),
		env,
	);
}
const profile = () => ({ ...profileValues(), expectedVersion: 0, mutationId: uuid() });
const session = () => {
	const record = sessionRecord();
	return {
		...record,
		id: undefined,
		version: undefined,
		lastMutationId: undefined,
		createdAt: undefined,
		updatedAt: undefined,
		expectedVersion: 0,
		mutationId: uuid(),
	};
};
it("rejects lost conditional updates and disappearing records", async () => {
	let request = profile();
	expect((await call("/api/profile", request)).status).toBe(200);
	request = { ...request, expectedVersion: 1, mutationId: uuid() };
	const missing = vi.spyOn(db, "getProfile").mockResolvedValueOnce(null);
	expect((await call("/api/profile", request)).status).toBe(409);
	missing.mockRestore();
	const lost = vi.spyOn(db, "updateProfile").mockResolvedValueOnce(false);
	expect((await call("/api/profile", request)).status).toBe(409);
	lost.mockRestore();
	const disappeared = vi
		.spyOn(db, "getProfile")
		.mockResolvedValueOnce(await db.getProfile(env.DB))
		.mockResolvedValueOnce(null);
	expect((await call("/api/profile", request)).status).toBe(500);
	disappeared.mockRestore();
});
it("exercises database conditional failures on the real D1 engine", async () => {
	const stored = await db.getProfile(env.DB);
	if (!stored) throw new Error("No profile");
	expect(await db.updateProfile(env.DB, stored, 999, "h")).toBe(false);
	const record = sessionRecord();
	expect(await db.updateSession(env.DB, record, 999, "h")).toBe(false);
	const measurement = {
		id: uuid(),
		kind: "weight" as const,
		effectiveDate: "2026-10-01",
		value: 70,
		version: 1,
		lastMutationId: uuid(),
		createdAt: "2026-10-09T00:00:00Z",
		updatedAt: "2026-10-09T00:00:00Z",
	};
	expect(await db.updateMeasurement(env.DB, measurement, 999, "h")).toBe(false);
	expect(await db.deleteMeasurement(env.DB, measurement.id, 999)).toBe(false);
	expect(await db.getMeasurement(env.DB, measurement.id)).toBeNull();
	expect(await db.getSession(env.DB, record.id)).toBeNull();
});
it("maps measurement insert constraints, lost updates and vanished reads safely", async () => {
	const id = uuid(),
		body = {
			kind: "weight",
			effectiveDate: "2026-10-01",
			value: 70,
			expectedVersion: 0,
			mutationId: uuid(),
		};
	const insert = vi
		.spyOn(db, "insertMeasurement")
		.mockRejectedValueOnce(new Error("disk unavailable"));
	expect((await call(`/api/measurements/${id}`, body)).status).toBe(500);
	insert.mockRestore();
	expect((await call(`/api/measurements/${id}`, body)).status).toBe(200);
	const missingRetry = vi.spyOn(db, "getMeasurement").mockResolvedValueOnce(null);
	expect((await call(`/api/measurements/${id}`, body)).status).toBe(500);
	missingRetry.mockRestore();
	const missingUpdate = vi.spyOn(db, "getMeasurement").mockResolvedValueOnce(null);
	expect(
		(
			await call(`/api/measurements/${id}`, {
				...body,
				expectedVersion: 1,
				mutationId: uuid(),
				value: 71,
			})
		).status,
	).toBe(404);
	missingUpdate.mockRestore();
	const lost = vi.spyOn(db, "updateMeasurement").mockResolvedValueOnce(false);
	expect(
		(
			await call(`/api/measurements/${id}`, {
				...body,
				expectedVersion: 1,
				mutationId: uuid(),
				value: 71,
			})
		).status,
	).toBe(409);
	lost.mockRestore();
	const vanished = vi
		.spyOn(db, "getMeasurement")
		.mockResolvedValueOnce(await db.getMeasurement(env.DB, id))
		.mockResolvedValueOnce(null);
	expect(
		(
			await call(`/api/measurements/${id}`, {
				...body,
				expectedVersion: 1,
				mutationId: uuid(),
				value: 71,
			})
		).status,
	).toBe(500);
	vanished.mockRestore();
	const nextId = uuid();
	const vanishInsert = vi.spyOn(db, "getMeasurement").mockResolvedValueOnce(null);
	expect(
		(
			await call(`/api/measurements/${nextId}`, {
				...body,
				effectiveDate: "2026-10-02",
				mutationId: uuid(),
			})
		).status,
	).toBe(500);
	vanishInsert.mockRestore();
});
it("rejects failed conditional plan acceptance and impossible previews", async () => {
	const input = planInput();
	expect(
		(
			await call(`/api/plans/${uuid()}`, {
				expectedRevision: 0,
				input: { ...input, weeklyFrequency: 1, cardioOnlyWeekdays: ["monday", "tuesday"] },
			})
		).status,
	).toBe(400);
	const lost = vi.spyOn(db, "insertPlanRevision").mockResolvedValueOnce(null);
	expect((await call(`/api/plans/${uuid()}`, { expectedRevision: 0, input })).status).toBe(409);
	lost.mockRestore();
});
it("covers concurrent retry branches and frozen workout provenance", async () => {
	const row = { version: 1, last_mutation_id: "mutation", last_mutation_hash: "hash" };
	expect(() => assertConcurrentRetry(null, "mutation", "hash")).toThrow();
	expect(() => assertConcurrentRetry(row, "mutation", "changed")).toThrow();
	assertConcurrentRetry(row, "mutation", "hash");
	const id = uuid(),
		body = session();
	expect((await call(`/api/sessions/${id}`, body)).status).toBe(200);
	expect(
		(
			await call(`/api/sessions/${id}`, {
				...body,
				expectedVersion: 1,
				mutationId: uuid(),
				status: "active",
			})
		).status,
	).toBe(200);
	expect(
		(
			await call(`/api/sessions/${id}`, {
				...body,
				expectedVersion: 2,
				mutationId: uuid(),
				status: "active",
				localDate: "2026-10-08",
			})
		).status,
	).toBe(409);
	const measurementId = uuid();
	const measurementBody = {
		kind: "weight",
		effectiveDate: "2026-10-05",
		value: 70,
		expectedVersion: 0,
		mutationId: uuid(),
	};
	const falseInsert = vi.spyOn(db, "insertMeasurement").mockResolvedValueOnce(false);
	expect((await call(`/api/measurements/${measurementId}`, measurementBody)).status).toBe(409);
	falseInsert.mockRestore();
	expect((await call(`/api/measurements/${measurementId}`, measurementBody)).status).toBe(200);
	const deletion = vi.spyOn(db, "deleteMeasurement").mockResolvedValueOnce(false);
	const response = await worker.fetch(
		new Request(`${origin}/api/measurements/${measurementId}`, {
			method: "DELETE",
			headers: {
				"Cf-Access-Jwt-Assertion": identity.tokens.owner,
				Origin: origin,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ expectedVersion: 1, mutationId: uuid() }),
		}),
		env,
	);
	expect(response.status).toBe(409);
	deletion.mockRestore();
	const stored = await db.getProfile(env.DB);
	if (!stored) throw new Error("No profile");
	const pbody = { ...profileValues(), expectedVersion: stored.version, mutationId: uuid() };
	const hash = await contentHash(profileValues());
	const retry = vi
		.spyOn(db, "getProfileVersioned")
		.mockResolvedValueOnce({
			version: stored.version,
			last_mutation_id: "old",
			last_mutation_hash: "old",
		})
		.mockResolvedValueOnce({
			version: stored.version + 1,
			last_mutation_id: pbody.mutationId,
			last_mutation_hash: hash,
		});
	const lost = vi.spyOn(db, "updateProfile").mockResolvedValueOnce(false);
	expect((await call("/api/profile", pbody)).status).toBe(200);
	retry.mockRestore();
	lost.mockRestore();
});

it("rejects a disappeared session and lost session updates without exposing internal details", async () => {
	const id = uuid(),
		body = session();
	expect((await call(`/api/sessions/${id}`, body)).status).toBe(200);
	const missing = vi
		.spyOn(db, "getSession")
		.mockResolvedValueOnce(null)
		.mockResolvedValueOnce(null);
	expect((await call(`/api/sessions/${id}`, body)).status).toBe(500);
	missing.mockRestore();
	const lost = vi.spyOn(db, "updateSession").mockResolvedValueOnce(false);
	expect(
		(
			await call(`/api/sessions/${id}`, {
				...body,
				expectedVersion: 1,
				mutationId: uuid(),
				status: "active",
			})
		).status,
	).toBe(409);
	lost.mockRestore();
	const vanished = vi
		.spyOn(db, "getSession")
		.mockResolvedValueOnce(await db.getSession(env.DB, id))
		.mockResolvedValueOnce(null);
	expect(
		(
			await call(`/api/sessions/${id}`, {
				...body,
				expectedVersion: 1,
				mutationId: uuid(),
				status: "active",
			})
		).status,
	).toBe(500);
	vanished.mockRestore();
	const insertedRead = vi
		.spyOn(db, "getSession")
		.mockResolvedValueOnce(null)
		.mockResolvedValueOnce(null);
	expect((await call(`/api/sessions/${uuid()}`, { ...body, mutationId: uuid() })).status).toBe(500);
	insertedRead.mockRestore();
});
