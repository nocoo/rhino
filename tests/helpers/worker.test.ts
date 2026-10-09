import { join } from "node:path";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { getPlatformProxy } from "wrangler";
import { actualFromTarget } from "../../src/features/use-rhino-model";
import type { WorkerEnv } from "../../worker/env";
import worker from "../../worker/index";
import { exerciseApi } from "./api-scenarios";
import { sessionTarget, uuid } from "./fixtures";
import { createIdentity } from "./identity";
import {
	assertOwnedPath,
	cleanupDatabase,
	createTestRun,
	initializeDatabase,
	type TestRun,
} from "./isolation";

let state: TestRun;
let proxy: Awaited<ReturnType<typeof getPlatformProxy<WorkerEnv>>>;
let identity: Awaited<ReturnType<typeof createIdentity>>;
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
	vi.spyOn(console, "log").mockImplementation(() => {});
}, 60_000);
afterAll(async () => {
	await proxy?.dispose();
	vi.restoreAllMocks();
	if (state) await cleanupDatabase(state);
}, 30_000);
it("executes real Worker business logic against isolated local D1", async () => {
	await exerciseApi({
		origin,
		tokens: identity.tokens,
		guard: async () => {
			assertOwnedPath(state.state, state.id);
			const marker = await proxy.env.DB.prepare("SELECT env, run_id FROM _test_marker").first<{
				env: string;
				run_id: string;
			}>();
			expect(marker).toEqual({ env: "test", run_id: state.id });
		},
		request: (path, init) => worker.fetch(new Request(origin + path, init), proxy.env),
	});
}, 120_000);
it("handles same-ID insert races and real D1 constraints without partial writes", async () => {
	assertOwnedPath(state.state, state.id);
	expect(await proxy.env.DB.prepare("SELECT env,run_id FROM _test_marker").first()).toEqual({
		env: "test",
		run_id: state.id,
	});
	const id = uuid();
	const target = sessionTarget();
	const body = {
		expectedVersion: 0,
		mutationId: uuid(),
		sourcePlanRevision: null,
		localDate: "2026-10-09",
		timezone: "Asia/Shanghai",
		status: "draft",
		target,
		actual: null,
	};
	const save = (payload: unknown) =>
		worker.fetch(
			new Request(`${origin}/api/sessions/${id}`, {
				method: "PUT",
				headers: {
					"Cf-Access-Jwt-Assertion": identity.tokens.owner,
					Origin: origin,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			}),
			proxy.env,
		);
	const responses = await Promise.all([save(body), save(body)]);
	expect(responses.map((response) => response.status)).toEqual([200, 200]);
	const stored = await proxy.env.DB.prepare("SELECT version FROM sessions WHERE id=?")
		.bind(id)
		.first();
	expect(stored).toEqual({ version: 1 });
	await expect(
		proxy.env.DB.prepare(
			"INSERT INTO profile(id,timezone,preferences_json,guidance_json,version,last_mutation_id,last_mutation_hash,created_at,updated_at) VALUES(2,'UTC','{}','{}',1,'a','h','x','x')",
		).run(),
	).rejects.toThrow();
	const constraintId = uuid();
	await expect(
		proxy.env.DB.prepare(
			"INSERT INTO measurements(id,kind,effective_date,value,version,last_mutation_id,last_mutation_hash,created_at,updated_at) VALUES(?,'weight','2026-10-01',-1,1,'a','h','x','x')",
		)
			.bind(constraintId)
			.run(),
	).rejects.toThrow();
	expect(
		await proxy.env.DB.prepare("SELECT COUNT(*) AS count FROM measurements WHERE id=?")
			.bind(constraintId)
			.first(),
	).toEqual({ count: 0 });
	const invalidActual = actualFromTarget(target);
	invalidActual.exercises[0].id = uuid();
	expect(
		(
			await save({
				...body,
				expectedVersion: 1,
				mutationId: uuid(),
				status: "active",
				actual: invalidActual,
			})
		).status,
	).toBe(400);
});

it("fails closed with unconfigured production owner and safe unknown errors", async () => {
	const request = new Request(`${origin}/api/profile`);
	const response = await worker.fetch(request, {
		...proxy.env,
		RESOURCE_ENV: "production",
		OWNER_SUB: "",
	});
	expect(response.status).toBe(403);
	expect(await response.json()).toMatchObject({ error: { code: "owner_not_configured" } });
	const assets = await worker.fetch(new Request(`${origin}/view`), {
		...proxy.env,
		ASSETS: { fetch: async () => new Response("Static") } as unknown as Fetcher,
	});
	expect(await assets.text()).toBe("Static");
	const failed = await worker.fetch(new Request(`${origin}/view`), {
		...proxy.env,
		ASSETS: {
			fetch: async () => {
				throw new Error("private detail");
			},
		} as unknown as Fetcher,
	});
	expect(failed.status).toBe(500);
	expect(await failed.text()).not.toContain("private detail");
});
