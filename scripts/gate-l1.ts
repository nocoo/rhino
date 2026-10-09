import { join } from "node:path";
import { run } from "./process";
import { withSnapshot } from "./snapshot";

const started = Date.now();
await withSnapshot(undefined, async (cwd, env) => {
	const outcomes = await Promise.allSettled(
		["typecheck", "lint", "test:coverage"].map((script) =>
			run(["bun", "run", script], {
				cwd,
				env: { ...env, PATH: `${join(cwd, "node_modules/.bin")}:${env.PATH ?? ""}` },
				timeout: 60_000,
			}),
		),
	);
	const failures = outcomes.filter((result) => result.status === "rejected");
	if (failures.length)
		throw new AggregateError(
			failures.map((result) => result.reason),
			"L1 rejected the staged snapshot",
		);
});
console.log(`L1：暂存快照检查完成 (${((Date.now() - started) / 1000).toFixed(1)}s)`);
