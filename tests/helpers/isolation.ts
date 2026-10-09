import {
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { cleanEnvironment, run } from "../../scripts/process";

export type TestRun = { state: string; id: string; config: string; env: NodeJS.ProcessEnv };

export function assertOwnedPath(state: string, id: string): void {
	const root = resolve(".wrangler/tests");
	if (
		!/^[a-f0-9-]{36}$/.test(id) ||
		lstatSync(root).isSymbolicLink() ||
		lstatSync(state).isSymbolicLink()
	) {
		throw new Error("Refusing unowned or symlinked test state");
	}
	if (realpathSync(root) !== root || !realpathSync(state).startsWith(root + sep)) {
		throw new Error("Test state must stay inside .wrangler/tests");
	}
	if (readFileSync(join(state, "run-id"), "utf8") !== id) throw new Error("Test run ID mismatch");
	const walk = (path: string) => {
		for (const file of readdirSync(path, { withFileTypes: true })) {
			if (file.isSymbolicLink()) throw new Error("Test state contains a symlink");
			if (file.isDirectory()) walk(join(path, file.name));
		}
	};
	walk(state);
}

export function createTestRun(origin: string, jwks: string): TestRun {
	const source = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
	const test = source.env.test;
	if (
		test.vars.RESOURCE_ENV !== "test" ||
		test.routes.length ||
		test.workers_dev ||
		test.preview_urls ||
		JSON.stringify(test).includes('"remote":true') ||
		test.d1_databases.length !== 1 ||
		test.d1_databases[0].binding !== "DB" ||
		test.d1_databases[0].database_id !== "local-rhino-test" ||
		source.d1_databases.some(
			(db: { database_id: string }) => db.database_id === test.d1_databases[0].database_id,
		)
	) {
		throw new Error("Tests require exclusively local test bindings");
	}
	mkdirSync(".wrangler/tests", { recursive: true });
	const id = crypto.randomUUID();
	const state = mkdtempSync(resolve(".wrangler/tests", "run-"));
	writeFileSync(join(state, "run-id"), id);
	assertOwnedPath(state, id);
	const config = join(state, "wrangler.json");
	const selected = {
		name: "rhino-test",
		main: resolve(source.main),
		compatibility_date: source.compatibility_date,
		compatibility_flags: source.compatibility_flags,
		workers_dev: false,
		preview_urls: false,
		routes: [],
		assets: test.assets,
		vars: { ...test.vars, APP_ORIGIN: origin, TEST_ACCESS_JWKS: jwks },
		d1_databases: test.d1_databases.map((db: object) => ({
			...db,
			migrations_dir: resolve("migrations"),
			remote: false,
		})),
	};
	writeFileSync(config, JSON.stringify({ ...selected, env: { test: selected } }));
	const env = {
		...cleanEnvironment(),
		CLOUDFLARE_ENV: "test",
		RESOURCE_ENV: "test",
		RHINO_TEST_STATE: state,
		RHINO_TEST_RUN_ID: id,
		RHINO_TEST_CONFIG: config,
		RHINO_TEST_URL: origin,
		XDG_CONFIG_HOME: join(state, "config"),
		XDG_CACHE_HOME: join(state, "cache"),
		WRANGLER_LOG_PATH: join(state, "wrangler.log"),
		PLAYWRIGHT_BROWSERS_PATH:
			process.env.PLAYWRIGHT_BROWSERS_PATH ??
			(process.platform === "linux"
				? join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "ms-playwright")
				: join(homedir(), "Library/Caches/ms-playwright")),
	};
	return { state, id, config, env };
}

async function executeSql(test: TestRun, sql: string): Promise<unknown> {
	assertOwnedPath(test.state, test.id);
	const file = join(test.state, `query-${crypto.randomUUID()}.sql`);
	writeFileSync(file, sql);
	try {
		return JSON.parse(
			await run(
				[
					"node",
					"node_modules/wrangler/bin/wrangler.js",
					"d1",
					"execute",
					"rhino-test",
					"--local",
					"--config",
					test.config,
					"--env",
					"test",
					"--persist-to",
					test.state,
					"--file",
					file,
					"--json",
				],
				{ env: test.env, capture: true, timeout: 30_000 },
			),
		);
	} finally {
		rmSync(file);
	}
}

export async function assertMarker(test: TestRun): Promise<void> {
	assertOwnedPath(test.state, test.id);
	const files = readdirSync(join(test.state, "v3", "d1"), {
		recursive: true,
		withFileTypes: true,
	}).filter((file) => file.isFile() && /^[a-f0-9]{64}\.sqlite$/.test(file.name));
	if (files.length !== 1 || !files[0])
		throw new Error("Expected exactly one owned D1 SQLite database");
	const database = new DatabaseSync(join(files[0].parentPath, files[0].name), { readOnly: true });
	try {
		const rows = database.prepare("SELECT env, run_id FROM _test_marker").all();
		if (rows.length !== 1 || rows[0]?.env !== "test" || rows[0]?.run_id !== test.id) {
			throw new Error("Refusing database without matching _test_marker(env=test, run_id)");
		}
	} finally {
		database.close();
	}
}

export async function localSql(test: TestRun, sql: string): Promise<unknown> {
	await assertMarker(test);
	return executeSql(test, sql);
}

export async function initializeDatabase(test: TestRun): Promise<void> {
	await executeSql(
		test,
		`CREATE TABLE _test_marker(env TEXT NOT NULL CHECK(env='test'), run_id TEXT NOT NULL); INSERT INTO _test_marker VALUES('test','${test.id}');`,
	);
	for (const file of readdirSync("migrations")
		.filter((file) => file.endsWith(".sql"))
		.sort()) {
		await assertMarker(test);
		await localSql(test, readFileSync(join("migrations", file), "utf8"));
	}
}

export async function cleanupDatabase(test: TestRun): Promise<void> {
	await assertMarker(test);
	assertOwnedPath(test.state, test.id);
	rmSync(test.state, { recursive: true });
}
