import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { createIdentity } from "../tests/helpers/identity.ts";
import { cleanupDatabase, createTestRun, initializeDatabase } from "../tests/helpers/isolation.ts";

const CREDENTIAL =
	/^(CLOUDFLARE_(API_TOKEN|ACCOUNT_ID|API_KEY)|CF_(API_TOKEN|API_KEY)|CF_ACCESS_CLIENT_(ID|SECRET))$/;

export type E2EChild = {
	instanceId: string;
	url: string;
	token: () => Promise<string>;
	stop: () => Promise<void>;
};

export function assertNoProductionCredentials(source: Record<string, string | undefined>): void {
	const names = Object.keys(source).filter((name) => source[name] && CREDENTIAL.test(name));
	if (names.length) throw new Error(`E2E refuses production credentials: ${names.join(", ")}`);
}

export async function availablePort(): Promise<number> {
	const server = createServer();
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("No local port allocated");
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve())),
	);
	return address.port;
}

function childEnv(testEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
	const env = {
		...testEnv,
		CI: "true",
		WRANGLER_SEND_METRICS: "false",
		WRANGLER_HIDE_BANNER: "true",
		CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
		CLOUDFLARE_INCLUDE_PROCESS_ENV: "false",
	};
	assertNoProductionCredentials(env);
	return env;
}

async function stopProcess(child: ChildProcess): Promise<void> {
	if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
	const exited = once(child, "exit");
	try {
		process.kill(-child.pid, "SIGTERM");
	} catch {
		child.kill("SIGTERM");
	}
	const timer = setTimeout(() => {
		if (child.pid) {
			try {
				process.kill(-child.pid, "SIGKILL");
			} catch {}
		}
	}, 10_000);
	try {
		await exited;
	} finally {
		clearTimeout(timer);
	}
}

async function waitForLive(url: string, token: string, child: ChildProcess): Promise<void> {
	const deadline = Date.now() + 45_000;
	while (Date.now() < deadline) {
		if (child.exitCode !== null || child.signalCode !== null) {
			throw new Error("E2E Worker exited before readiness");
		}
		try {
			const response = await fetch(`${url}/api/live`, {
				headers: { "Cf-Access-Jwt-Assertion": token },
				signal: AbortSignal.timeout(1000),
			});
			if (response.ok) {
				await response.body?.cancel();
				return;
			}
		} catch {}
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	throw new Error("E2E Worker failed authenticated readiness");
}

async function untilReady(child: ChildProcess, start: () => Promise<void>): Promise<void> {
	if (child.exitCode !== null || child.signalCode !== null) {
		throw new Error("E2E Worker exited before readiness");
	}
	await new Promise<void>((resolve, reject) => {
		const fail = (message: string) => {
			cleanup();
			reject(new Error(message));
		};
		const onError = () => fail("E2E Worker failed to start");
		const onExit = () => fail("E2E Worker exited before readiness");
		const cleanup = () => {
			child.off("error", onError);
			child.off("exit", onExit);
		};
		child.on("error", onError);
		child.on("exit", onExit);
		start().then(
			() => {
				cleanup();
				child.on("error", () => {});
				resolve();
			},
			(error: unknown) => {
				cleanup();
				child.on("error", () => {});
				reject(error);
			},
		);
	});
}

export async function startE2EChild(
	hooks: {
		allocatePort?: () => Promise<number>;
		spawnVite?: (command: string[], env: NodeJS.ProcessEnv) => ChildProcess;
		ready?: (url: string, token: string, child: ChildProcess) => Promise<void>;
	} = {},
): Promise<E2EChild> {
	const port = await (hooks.allocatePort ?? availablePort)();
	const url = `http://127.0.0.1:${port}`;
	const identity = await createIdentity();
	const test = createTestRun(url, identity.jwks);
	let child: ChildProcess | undefined;
	let stopping: Promise<void> | undefined;
	const stop = () =>
		(stopping ??= (async () => {
			if (child) await stopProcess(child);
			child = undefined;
			await cleanupDatabase(test);
		})().catch((error: unknown) => {
			stopping = undefined;
			throw error;
		}));
	try {
		const env = childEnv(test.env);
		await initializeDatabase(test);
		const command = [
			"node",
			"node_modules/vite/bin/vite.js",
			"--host",
			"127.0.0.1",
			"--port",
			String(port),
			"--strictPort",
		];
		const token = await identity.token();
		child =
			hooks.spawnVite?.(command, env) ??
			spawn(command[0] ?? "", command.slice(1), {
				env,
				detached: true,
				stdio: ["ignore", "ignore", "ignore", "ipc"],
			});
		const running = child;
		await untilReady(running, () => (hooks.ready ?? waitForLive)(url, token, running));
		return {
			instanceId: test.id,
			url,
			token: () => identity.token(),
			stop,
		};
	} catch (error) {
		await stop().catch(() => {});
		throw error;
	}
}
