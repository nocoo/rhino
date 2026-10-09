import { ChildProcess } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	assertNoProductionCredentials,
	availablePort,
	startE2EChild,
} from "../../../dev/e2e-child.ts";

const mocks = vi.hoisted(() => ({
	createIdentity: vi.fn(),
	createTestRun: vi.fn(),
	initializeDatabase: vi.fn(),
	cleanupDatabase: vi.fn(),
	spawn: vi.fn(),
	fetch: vi.fn(),
}));

vi.mock("../../../tests/helpers/identity.ts", () => ({
	createIdentity: mocks.createIdentity,
}));
vi.mock("../../../tests/helpers/isolation.ts", () => ({
	createTestRun: mocks.createTestRun,
	initializeDatabase: mocks.initializeDatabase,
	cleanupDatabase: mocks.cleanupDatabase,
}));
vi.mock("node:child_process", async (load) => {
	const actual = await load<typeof import("node:child_process")>();
	return { ...actual, spawn: mocks.spawn };
});

let current: ChildProcess | undefined;

function fakeChild(fields: { pid?: number; exitCode?: number | null } = {}): ChildProcess {
	const child = new ChildProcess();
	Object.defineProperties(child, {
		pid: { value: fields.pid, configurable: true },
		exitCode: { value: fields.exitCode ?? null, configurable: true },
		signalCode: { value: null, configurable: true },
	});
	child.kill = vi.fn();
	current = child;
	return child;
}

function identity() {
	return {
		jwks: JSON.stringify({ keys: [] }),
		tokens: { owner: "owner-jwt" },
		token: vi.fn().mockResolvedValue("owner-jwt"),
	};
}

function testRun(env: Record<string, string> = { PATH: "/bin", CLOUDFLARE_ENV: "test" }) {
	return {
		state: "/tmp/rhino-e2e",
		id: "run-id",
		config: "/tmp/rhino-e2e/wrangler.json",
		env: { ...process.env, ...env },
	};
}

beforeEach(() => {
	vi.spyOn(process, "kill").mockImplementation(() => {
		if (current) {
			Object.defineProperty(current, "exitCode", { value: 0 });
			current.emit("exit", 0, "SIGTERM");
		}
		return true;
	});
});

afterEach(() => {
	current = undefined;
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.resetAllMocks();
	vi.restoreAllMocks();
});

describe("e2e child isolation", () => {
	it("refuses production credentials in the spawned environment", () => {
		expect(() =>
			assertNoProductionCredentials({ PATH: "/bin", CLOUDFLARE_API_TOKEN: "secret" }),
		).toThrow("production credentials");
		expect(() =>
			assertNoProductionCredentials({ PATH: "/bin", CLOUDFLARE_ENV: "test" }),
		).not.toThrow();
	});

	it("allocates a loopback port", async () => {
		const port = await availablePort();
		expect(port).toBeGreaterThan(0);
	});

	it("spawns Vite with ignored stdio and isolated test env", async () => {
		const spawned = fakeChild({ pid: 4242 });
		const envSeen: NodeJS.ProcessEnv[] = [];
		mocks.createIdentity.mockResolvedValue(identity());
		mocks.createTestRun.mockReturnValue(testRun());
		mocks.initializeDatabase.mockResolvedValue(undefined);
		mocks.cleanupDatabase.mockResolvedValue(undefined);
		const started = await startE2EChild({
			allocatePort: async () => 18057,
			spawnVite: (command, env) => {
				envSeen.push(env);
				expect(command).toEqual([
					"node",
					"node_modules/vite/bin/vite.js",
					"--host",
					"127.0.0.1",
					"--port",
					"18057",
					"--strictPort",
				]);
				return spawned;
			},
			ready: async (url, token, child) => {
				expect(url).toBe("http://127.0.0.1:18057");
				expect(token).toBe("owner-jwt");
				expect(child).toBe(spawned);
			},
		});
		expect(started.instanceId).toBe("run-id");
		expect(envSeen[0]?.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV).toBe("false");
		expect(envSeen[0]?.CLOUDFLARE_INCLUDE_PROCESS_ENV).toBe("false");
		expect(await started.token()).toBe("owner-jwt");
		await started.stop();
		expect(mocks.cleanupDatabase).toHaveBeenCalledOnce();
	});

	it("attempts marker cleanup when credentials leak into the child env", async () => {
		mocks.createIdentity.mockResolvedValue(identity());
		mocks.createTestRun.mockReturnValue(testRun({ CLOUDFLARE_API_TOKEN: "leak" }));
		mocks.cleanupDatabase.mockResolvedValue(undefined);
		await expect(startE2EChild({ allocatePort: async () => 1 })).rejects.toThrow(
			"production credentials",
		);
		expect(mocks.initializeDatabase).not.toHaveBeenCalled();
		expect(mocks.cleanupDatabase).toHaveBeenCalledOnce();
	});

	it("leaves owned state when marker cleanup fails after a dead child", async () => {
		const spawned = fakeChild({ pid: 4242, exitCode: 1 });
		mocks.createIdentity.mockResolvedValue(identity());
		mocks.createTestRun.mockReturnValue(testRun());
		mocks.initializeDatabase.mockResolvedValue(undefined);
		mocks.cleanupDatabase.mockRejectedValueOnce(new Error("marker"));
		mocks.spawn.mockReturnValue(spawned);
		await expect(startE2EChild({ allocatePort: async () => 19057 })).rejects.toThrow(
			"exited before readiness",
		);
		expect(mocks.cleanupDatabase).toHaveBeenCalledOnce();
	});

	it("handles spawn early error without pid and still attempts guarded cleanup", async () => {
		const spawned = fakeChild();
		mocks.createIdentity.mockResolvedValue(identity());
		mocks.createTestRun.mockReturnValue(testRun());
		mocks.initializeDatabase.mockResolvedValue(undefined);
		mocks.cleanupDatabase.mockResolvedValue(undefined);
		await expect(
			startE2EChild({
				allocatePort: async () => 18058,
				spawnVite: () => {
					queueMicrotask(() => spawned.emit("error", new Error("ENOENT")));
					return spawned;
				},
				ready: () => new Promise(() => {}),
			}),
		).rejects.toThrow("E2E Worker failed to start");
		expect(spawned.pid).toBeUndefined();
		expect(mocks.cleanupDatabase).toHaveBeenCalledOnce();
	});

	it("uses default spawn with ignored stdio and treats a live probe as ready", async () => {
		const spawned = fakeChild({ pid: 4242 });
		mocks.createIdentity.mockResolvedValue(identity());
		mocks.createTestRun.mockReturnValue(testRun());
		mocks.initializeDatabase.mockResolvedValue(undefined);
		mocks.cleanupDatabase.mockResolvedValue(undefined);
		mocks.spawn.mockReturnValue(spawned);
		vi.stubGlobal("fetch", mocks.fetch);
		mocks.fetch.mockResolvedValue({
			ok: true,
			body: { cancel: async () => undefined },
		});
		const started = await startE2EChild({ allocatePort: async () => 19057 });
		expect(mocks.spawn).toHaveBeenCalledWith(
			"node",
			["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "19057", "--strictPort"],
			expect.objectContaining({
				detached: true,
				stdio: ["ignore", "ignore", "ignore", "ipc"],
				env: expect.objectContaining({ CLOUDFLARE_ENV: "test" }),
			}),
		);
		expect(started.url).toBe("http://127.0.0.1:19057");
		await started.stop();
	});

	it("retries failed readiness probes and preserves marker failures for an explicit retry", async () => {
		vi.useFakeTimers();
		const spawned = fakeChild({ pid: 4242 });
		mocks.createIdentity.mockResolvedValue(identity());
		mocks.createTestRun.mockReturnValue(testRun());
		mocks.initializeDatabase.mockResolvedValue(undefined);
		mocks.spawn.mockReturnValue(spawned);
		vi.stubGlobal("fetch", mocks.fetch);
		mocks.fetch
			.mockRejectedValueOnce(new Error("starting"))
			.mockResolvedValueOnce({ ok: false })
			.mockResolvedValueOnce({ ok: true, body: null });
		const pending = startE2EChild({ allocatePort: async () => 19057 });
		await vi.advanceTimersByTimeAsync(500);
		const runtime = await pending;
		mocks.cleanupDatabase
			.mockRejectedValueOnce(new Error("marker mismatch"))
			.mockResolvedValue(undefined);
		await expect(runtime.stop()).rejects.toThrow("marker mismatch");
		await runtime.stop();
		await runtime.stop();
		expect(mocks.cleanupDatabase).toHaveBeenCalledTimes(2);
	});

	it("times out authenticated readiness and escalates child shutdown before cleanup", async () => {
		vi.useFakeTimers();
		const spawned = fakeChild({ pid: 4242 });
		mocks.createIdentity.mockResolvedValue(identity());
		mocks.createTestRun.mockReturnValue(testRun());
		mocks.initializeDatabase.mockResolvedValue(undefined);
		mocks.cleanupDatabase.mockResolvedValue(undefined);
		mocks.spawn.mockReturnValue(spawned);
		vi.stubGlobal("fetch", mocks.fetch);
		mocks.fetch.mockResolvedValue({ ok: false });
		vi.mocked(process.kill).mockImplementation((_pid, signal) => {
			if (signal === "SIGKILL") {
				Object.defineProperty(spawned, "signalCode", { value: "SIGKILL" });
				spawned.emit("exit", null, "SIGKILL");
			}
			return true;
		});
		const pending = startE2EChild({ allocatePort: async () => 19057 });
		const rejected = expect(pending).rejects.toThrow("failed authenticated readiness");
		await vi.advanceTimersByTimeAsync(56_000);
		await rejected;
		expect(process.kill).toHaveBeenCalledWith(-4242, "SIGKILL");
		expect(mocks.cleanupDatabase).toHaveBeenCalledOnce();
	});

	it("handles initialization failure and per-process termination fallback", async () => {
		mocks.createIdentity.mockResolvedValue(identity());
		mocks.createTestRun.mockReturnValue(testRun());
		mocks.initializeDatabase.mockRejectedValueOnce(new Error("migration failed"));
		mocks.cleanupDatabase.mockResolvedValue(undefined);
		await expect(startE2EChild()).rejects.toThrow("migration failed");
		expect(mocks.spawn).not.toHaveBeenCalled();
		const spawned = fakeChild({ pid: 4242 });
		mocks.initializeDatabase.mockResolvedValue(undefined);
		const runtime = await startE2EChild({
			allocatePort: async () => 19057,
			spawnVite: () => spawned,
			ready: async () => {},
		});
		vi.mocked(process.kill).mockImplementation(() => {
			throw new Error("no group");
		});
		vi.mocked(spawned.kill).mockImplementation(() => {
			spawned.emit("exit", null, "SIGTERM");
			return true;
		});
		await runtime.stop();
		expect(spawned.kill).toHaveBeenCalledWith("SIGTERM");
	});
});
