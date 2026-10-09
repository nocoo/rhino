import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { createIdentity } from "../tests/helpers/identity";
import { cleanupDatabase, createTestRun, initializeDatabase } from "../tests/helpers/isolation";
import { run } from "./process";

const tier = process.argv[2];
if (tier !== "l2" && tier !== "l3") throw new Error("Use run-tests.ts l2|l3");
const port = await new Promise<number>((resolve, reject) => {
	const probe = createServer();
	probe.once("error", reject);
	probe.listen(0, "127.0.0.1", () => {
		const address = probe.address();
		if (!address || typeof address === "string") {
			probe.close();
			reject(new Error("No test port"));
			return;
		}
		probe.close(() => resolve(address.port));
	});
});
const base = `http://127.0.0.1:${port}`;
const identity = await createIdentity();
const test = createTestRun(base, identity.jwks);
const env = { ...test.env, RHINO_TEST_TOKENS: JSON.stringify(identity.tokens) };
mkdirSync(`test-results/${tier}`, { recursive: true });
const log = openSync(`test-results/${tier}/server.log`, "w");
let server: ReturnType<typeof spawn> | undefined;
let interrupted = false;
const stop = () => {
	interrupted = true;
	if (server?.pid) {
		try {
			process.kill(-server.pid, "SIGTERM");
		} catch {}
	}
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
try {
	await initializeDatabase(test);
	server = spawn(
		"node",
		[
			"node_modules/vite/bin/vite.js",
			"--host",
			"127.0.0.1",
			"--port",
			String(port),
			"--strictPort",
		],
		{ env, detached: true, stdio: ["ignore", log, log] },
	);
	server.once("error", stop);
	const started = Date.now();
	while (true) {
		if (interrupted || server.exitCode !== null)
			throw new Error(
				`Test Worker exited\n${readFileSync(`test-results/${tier}/server.log`, "utf8")}`,
			);
		try {
			const response = await fetch(`${base}/api/live`, {
				headers: { "Cf-Access-Jwt-Assertion": identity.tokens.owner },
				signal: AbortSignal.timeout(1000),
			});
			if (response.ok) break;
		} catch {}
		if (Date.now() - started > 45_000)
			throw new Error(`Worker startup timeout. See test-results/${tier}/server.log`);
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	console.log(`${tier.toUpperCase()}: 本地 Worker ${base}，隔离 D1 ${test.id}`);
	await run(
		tier === "l2"
			? ["bun", "test", "./tests/l2", ...process.argv.slice(3)]
			: ["node", "node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(3)],
		{ env, timeout: tier === "l2" ? 120_000 : 180_000 },
	);
	if (interrupted) throw new Error("Test run interrupted");
} finally {
	if (server?.pid && server.exitCode === null) {
		const exited = new Promise<void>((resolve) => server?.once("close", () => resolve()));
		try {
			process.kill(-server.pid, "SIGTERM");
		} catch {}
		await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
		if (server.exitCode === null) {
			try {
				process.kill(-server.pid, "SIGKILL");
			} catch {}
			await exited;
		}
	}
	closeSync(log);
	process.removeListener("SIGINT", stop);
	process.removeListener("SIGTERM", stop);
	await cleanupDatabase(test);
}
