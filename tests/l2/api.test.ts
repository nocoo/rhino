import { test } from "bun:test";
import { exerciseApi } from "../helpers/api-scenarios";
import { assertMarker, type TestRun } from "../helpers/isolation";

test("all owned routes enforce auth, real D1 persistence, conflicts and history", async () => {
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
	await exerciseApi({
		origin,
		tokens: JSON.parse(process.env.RHINO_TEST_TOKENS),
		guard: () => assertMarker(state),
		request: (path, init) => fetch(origin + path, init),
	});
}, 120_000);
