import { spawn } from "node:child_process";

export function cleanEnvironment(): NodeJS.ProcessEnv {
	const env = { ...process.env };
	for (const key of Object.keys(env)) {
		if (/^(CLOUDFLARE_|CF_|RHINO_TEST_|TEST_ACCESS_)/.test(key)) delete env[key];
	}
	env.WRANGLER_SEND_METRICS = "false";
	return env;
}

export async function run(
	command: string[],
	options: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number; capture?: boolean } = {},
): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn(command[0] ?? "", command.slice(1), {
			cwd: options.cwd,
			env: options.env ?? cleanEnvironment(),
			detached: process.platform !== "win32",
			stdio: ["ignore", options.capture ? "pipe" : "inherit", options.capture ? "pipe" : "inherit"],
		});
		let output = "";
		let failure: Error | undefined;
		const stop = () => {
			failure = new Error(`Cancelled or timed out: ${command.join(" ")}`);
			if (child.pid) {
				try {
					if (process.platform === "win32") child.kill("SIGKILL");
					else process.kill(-child.pid, "SIGKILL");
				} catch {}
			}
		};
		const timer = setTimeout(stop, options.timeout ?? 180_000);
		process.once("SIGINT", stop);
		process.once("SIGTERM", stop);
		child.stdout?.on("data", (chunk) => {
			output += chunk;
		});
		child.stderr?.on("data", (chunk) => {
			output += chunk;
		});
		const cleanup = () => {
			clearTimeout(timer);
			process.removeListener("SIGINT", stop);
			process.removeListener("SIGTERM", stop);
		};
		child.once("error", (error) => {
			cleanup();
			reject(error);
		});
		child.once("close", (code, signal) => {
			cleanup();
			if (failure || code !== 0 || signal)
				reject(failure ?? new Error(`${command.join(" ")} failed (${code ?? signal})\n${output}`));
			else resolve(output);
		});
	});
}
