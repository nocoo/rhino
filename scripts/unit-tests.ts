import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { run } from "./process";

const report = "test-results/unit.json";
mkdirSync("test-results", { recursive: true });
rmSync(report, { force: true });
rmSync("coverage/coverage-summary.json", { force: true });
await run(
	[
		"node",
		"node_modules/vitest/vitest.mjs",
		"run",
		"--coverage",
		"--reporter=default",
		"--reporter=json",
		`--outputFile.json=${report}`,
	],
	{ timeout: 60_000 },
);
const result = JSON.parse(readFileSync(report, "utf8"));
if (
	!result.success ||
	result.numTotalTests < 1 ||
	result.numPassedTests !== result.numTotalTests ||
	result.numPendingTests ||
	result.numTodoTests ||
	result.numFailedTests
) {
	throw new Error("Unit gate requires a nonempty, complete, passing suite");
}
const summary = JSON.parse(readFileSync("coverage/coverage-summary.json", "utf8"));
const thresholds: Record<string, number> = {
	statements: 90,
	branches: 85,
	functions: 90,
	lines: 90,
};
for (const [metric, minimum] of Object.entries(thresholds)) {
	const coverage = summary.total?.[metric];
	if (
		!coverage ||
		!Number.isFinite(coverage.pct) ||
		coverage.total === 0 ||
		coverage.pct < minimum
	) {
		throw new Error(`Invalid or insufficient ${metric} coverage`);
	}
}
