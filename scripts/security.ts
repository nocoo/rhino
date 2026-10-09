import {
	copyFileSync,
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { run } from "./process";

mkdirSync("test-results/security", { recursive: true });
const snapshot = mkdtempSync(join(tmpdir(), "rhino-secrets-"));
try {
	const files: string[] = process.env.RHINO_SOURCE_FILES
		? JSON.parse(process.env.RHINO_SOURCE_FILES)
		: (
				await run(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
					capture: true,
				})
			)
				.split("\0")
				.filter(Boolean);
	if (!files.length) throw new Error("No source files found for secret scan");
	for (const file of new Set(files)) {
		if (!existsSync(file)) continue;
		if (lstatSync(file).isSymbolicLink()) throw new Error(`Cannot scan symlink: ${file}`);
		if (!lstatSync(file).isFile()) continue;
		const destination = join(snapshot, file);
		mkdirSync(dirname(destination), { recursive: true });
		copyFileSync(file, destination);
	}
	for (const report of ["gitleaks", "osv"])
		rmSync(`test-results/security/${report}.json`, { force: true });
	const outcomes = await Promise.allSettled([
		run(
			[
				"gitleaks",
				"dir",
				snapshot,
				"--redact",
				"--no-banner",
				"--ignore-gitleaks-allow",
				`--config=${resolve(".gitleaks.toml")}`,
				"--report-format=json",
				`--report-path=${resolve("test-results/security/gitleaks.json")}`,
			],
			{ timeout: 120_000 },
		),
		run(
			[
				"osv-scanner",
				"scan",
				"source",
				"--lockfile=bun.lock",
				"--format=json",
				"--output-file=test-results/security/osv.json",
			],
			{ timeout: 120_000 },
		),
	]);
	const failures = outcomes.filter((result) => result.status === "rejected");
	if (failures.length)
		throw new AggregateError(
			failures.map((result) => result.reason),
			"Security gate rejected source or dependencies",
		);
	for (const report of ["gitleaks", "osv"]) {
		JSON.parse(readFileSync(`test-results/security/${report}.json`, "utf8"));
	}
	console.log("G2：源码机密扫描与 bun.lock 依赖扫描完成");
} finally {
	rmSync(snapshot, { recursive: true });
}
