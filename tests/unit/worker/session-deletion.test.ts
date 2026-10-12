import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import {
	type ApiData,
	type GetProgressResponse,
	type GetSessionsResponse,
	MAX_BODY_BYTES,
	type PutSessionRequest,
} from "../../../src/domain/contracts";
import * as db from "../../../worker/db";
import type { WorkerEnv } from "../../../worker/env";
import worker from "../../../worker/index";
import { actualFromTarget, sessionRecord, uuid } from "../../helpers/fixtures";
import { createIdentity } from "../../helpers/identity";

const origin = "http://127.0.0.1";
let identity: Awaited<ReturnType<typeof createIdentity>>;
let sqlite: DatabaseSync;
let env: WorkerEnv;

beforeAll(async () => {
	identity = await createIdentity();
});

beforeEach(() => {
	sqlite = new DatabaseSync(":memory:");
	for (const file of ["0001_initial.sql", "0002_session_tombstones.sql"])
		sqlite.exec(readFileSync(`migrations/${file}`, "utf8"));
	const prepare = (sql: string) => {
		let values: SQLInputValue[] = [];
		const execute = () => {
			const statement = sqlite.prepare(sql);
			const results = statement.columns().length ? statement.all(...values) : [];
			const changes = results.length ? 0 : statement.run(...values).changes;
			return { success: true, results, meta: { changes: Number(changes) } };
		};
		const statement = {
			bind: (...args: SQLInputValue[]) => {
				values = args;
				return statement;
			},
			first: async () => sqlite.prepare(sql).get(...values) ?? null,
			all: async () => ({ results: sqlite.prepare(sql).all(...values) }),
			run: async () => execute(),
			execute,
		};
		return statement;
	};
	const database = {
		prepare,
		batch: async (statements: ReturnType<typeof prepare>[]) => {
			sqlite.exec("BEGIN");
			try {
				const results = statements.map((statement) => statement.execute());
				sqlite.exec("COMMIT");
				return results;
			} catch (error) {
				sqlite.exec("ROLLBACK");
				throw error;
			}
		},
	};
	env = {
		RESOURCE_ENV: "test",
		DEPLOY_REVISION: "test",
		OWNER_SUB: "rhino-local-owner",
		ACCESS_ISSUER: "https://nocoo.cloudflareaccess.com",
		ACCESS_AUD: "rhino-test",
		TEST_ACCESS_JWKS: identity.jwks,
		APP_ORIGIN: origin,
		DB: database as unknown as D1Database,
		ASSETS: {} as Fetcher,
	};
	vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	sqlite.close();
});

const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
	worker.fetch(
		new Request(origin + path, {
			method,
			headers: {
				"Cf-Access-Jwt-Assertion": identity.tokens.owner,
				Origin: origin,
				"Content-Type": "application/json",
				...headers,
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		}),
		env,
	);

const creation = (): PutSessionRequest => {
	const record = sessionRecord();
	return {
		expectedVersion: 0,
		mutationId: record.lastMutationId,
		sourcePlanRevision: record.sourcePlanRevision,
		localDate: record.localDate,
		timezone: record.timezone,
		status: record.status,
		target: record.target,
		actual: record.actual,
	};
};

it("hard-deletes every session status and retains only the ID", async () => {
	const survivor = sessionRecord();
	await db.insertSession(env.DB, survivor, "hash");
	for (const status of ["draft", "active", "completed", "abandoned"] as const) {
		const record = sessionRecord();
		record.status = status;
		record.actual = actualFromTarget(record.target);
		await db.insertSession(env.DB, record, "hash");
		const path = `/api/sessions/${record.id}`;
		const deleted = await call("DELETE", path, { expectedVersion: 1 });
		expect(deleted.status).toBe(200);
		expect(deleted.headers.get("cache-control")).toBe("no-store");
		expect(await deleted.json()).toEqual({ data: { id: record.id } });
		expect((await call("GET", path)).status).toBe(404);
		expect(await db.getSessionVersioned(env.DB, record.id)).toBeNull();
		expect(sqlite.prepare("SELECT * FROM session_tombstones WHERE id=?").get(record.id)).toEqual({
			id: record.id,
		});
		for (const version of [1, 999]) {
			const repeat = await call("DELETE", path, { expectedVersion: version });
			expect(repeat.status).toBe(200);
			expect(await repeat.json()).toEqual({ data: { id: record.id } });
		}
	}
	const range = "from=2026-10-01&to=2026-10-09";
	const listed = (await (
		await call("GET", `/api/sessions?${range}`)
	).json()) as ApiData<GetSessionsResponse>;
	expect(listed.data.sessions.map((record: { id: string }) => record.id)).toEqual([survivor.id]);
	const progress = (await (
		await call("GET", `/api/progress?${range}`)
	).json()) as ApiData<GetProgressResponse>;
	expect(progress.data.sessions.map((record: { id: string }) => record.id)).toEqual([survivor.id]);
	expect(
		progress.data.weeklyTotals.every(
			(week: { completedSessions: number }) => week.completedSessions === 0,
		),
	).toBe(true);
	expect(await db.getSession(env.DB, survivor.id)).toEqual(survivor);
});

it("checks the current version atomically and does not tombstone unknown IDs", async () => {
	const id = uuid();
	const payload = creation();
	const path = `/api/sessions/${id}`;
	expect((await call("DELETE", path, { expectedVersion: 1 })).status).toBe(404);
	expect(sqlite.prepare("SELECT * FROM session_tombstones").all()).toEqual([]);
	expect((await call("PUT", path, payload)).status).toBe(200);
	expect(
		(await call("PUT", path, { ...payload, expectedVersion: 1, mutationId: uuid() })).status,
	).toBe(200);
	const stale = await call("DELETE", path, { expectedVersion: 1 });
	expect(stale.status).toBe(409);
	expect(await stale.json()).toMatchObject({ error: { currentVersion: 2 } });
	expect(sqlite.prepare("SELECT * FROM session_tombstones").all()).toEqual([]);
	expect((await db.getSession(env.DB, id))?.version).toBe(2);
	expect((await call("DELETE", path, { expectedVersion: 2 })).status).toBe(200);
	for (const retry of [
		payload,
		{ ...payload, mutationId: uuid() },
		{ ...payload, expectedVersion: 2, mutationId: uuid() },
	]) {
		expect((await call("PUT", path, retry)).status).toBe(409);
	}
	expect(await db.getSession(env.DB, id)).toBeNull();
});

it("blocks a create retry that read absence before another request created and deleted", async () => {
	const id = uuid();
	const original = db.insertSession;
	vi.spyOn(db, "insertSession").mockImplementationOnce(async (database, record, hash) => {
		expect(await original(database, record, hash)).toBe(true);
		expect(await db.deleteSession(database, id, 1)).toEqual({ deleted: 1, currentVersion: null });
		return original(database, record, hash);
	});
	expect((await call("PUT", `/api/sessions/${id}`, creation())).status).toBe(409);
	expect(await db.getSession(env.DB, id)).toBeNull();
});

it("blocks a put that read the session before a concurrent deletion", async () => {
	const id = uuid();
	const payload = creation();
	const path = `/api/sessions/${id}`;
	expect((await call("PUT", path, payload)).status).toBe(200);
	const original = db.updateSession;
	vi.spyOn(db, "updateSession").mockImplementationOnce(async (database, record, version, hash) => {
		await db.deleteSession(database, id, version);
		return original(database, record, version, hash);
	});
	expect(
		(await call("PUT", path, { ...payload, expectedVersion: 1, mutationId: uuid() })).status,
	).toBe(409);
	expect(await db.getSession(env.DB, id)).toBeNull();
});

it("rolls back the tombstone if deleting the payload fails", async () => {
	const record = sessionRecord();
	await db.insertSession(env.DB, record, "hash");
	sqlite.exec(
		"CREATE TRIGGER fail_delete BEFORE DELETE ON sessions BEGIN SELECT RAISE(ABORT, 'fixture failure'); END",
	);
	expect((await call("DELETE", `/api/sessions/${record.id}`, { expectedVersion: 1 })).status).toBe(
		500,
	);
	expect(await db.getSession(env.DB, record.id)).toEqual(record);
	expect(sqlite.prepare("SELECT * FROM session_tombstones").all()).toEqual([]);
	vi.spyOn(env.DB, "batch").mockResolvedValueOnce([]);
	expect((await call("DELETE", `/api/sessions/${record.id}`, { expectedVersion: 1 })).status).toBe(
		500,
	);
});

it("rejects unauthorized, cross-origin and invalid delete requests before writing", async () => {
	const record = sessionRecord();
	await db.insertSession(env.DB, record, "hash");
	const path = `/api/sessions/${record.id}`;
	const batch = vi.spyOn(env.DB, "batch");
	for (const [token, status] of [
		["", 401],
		[identity.tokens.other, 403],
		[identity.tokens.badSignature, 403],
		[identity.tokens.expired, 403],
	] as const) {
		expect(
			(await call("DELETE", path, { expectedVersion: 1 }, { "Cf-Access-Jwt-Assertion": token }))
				.status,
		).toBe(status);
	}
	const rejectedHeaders: Record<string, string>[] = [
		{ Origin: "https://evil.example.test" },
		{ Origin: "" },
		{ "Sec-Fetch-Site": "cross-site" },
	];
	for (const headers of rejectedHeaders) {
		expect((await call("DELETE", path, { expectedVersion: 1 }, headers)).status).toBe(403);
	}
	for (const body of [
		{},
		{ expectedVersion: 0 },
		{ expectedVersion: -1 },
		{ expectedVersion: 1.5 },
		{ expectedVersion: "1" },
		{ expectedVersion: 1, mutationId: uuid() },
	]) {
		expect((await call("DELETE", path, body)).status).toBe(400);
	}
	expect((await call("DELETE", "/api/sessions/invalid", { expectedVersion: 1 })).status).toBe(400);
	expect((await call("DELETE", path)).status).toBe(400);
	expect(
		(await call("DELETE", path, { expectedVersion: 1 }, { "Content-Type": "text/plain" })).status,
	).toBe(400);
	expect((await call("DELETE", path, "x".repeat(MAX_BODY_BYTES))).status).toBe(413);
	expect(
		(
			await call(
				"DELETE",
				path,
				{ expectedVersion: 1 },
				{ "Content-Length": String(MAX_BODY_BYTES + 1) },
			)
		).status,
	).toBe(413);
	expect(batch).not.toHaveBeenCalled();
	expect(await db.getSession(env.DB, record.id)).toEqual(record);
	expect(sqlite.prepare("SELECT * FROM session_tombstones").all()).toEqual([]);
});
