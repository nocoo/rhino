import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanEnvironment, run } from "./process";
import { prepareDependencies } from "./snapshot";

const root = mkdtempSync(join(tmpdir(), "rhino-gate-proof-"));
const marker = crypto.randomUUID();
writeFileSync(join(root, "run-id"), marker);
const env = { ...cleanEnvironment(), GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
const command = (args: string[]) => run(args, { cwd: root, env, capture: true, timeout: 90_000 });
const write = (path: string, text: string) => writeFileSync(join(root, path), text);
const source = "export function absolute(value: number) { return value < 0 ? -value : value; }\n";
const tests =
	'import { expect, test } from "vitest"; import { absolute } from "./source"; test("boundaries", () => { expect(absolute(-1)).toBe(1); expect(absolute(0)).toBe(0); expect(absolute(1)).toBe(1); });\n';
const config =
	'import { defineConfig } from "vitest/config"; export default defineConfig({ test: { include: ["sample.test.ts"], allowOnly: false, coverage: { provider: "v8", include: ["source.ts"], reporter: ["json-summary"], thresholds: { statements: 95, branches: 95, functions: 95, lines: 95 } } } });\n';
async function rejectCommit(label: string, requiredOutput?: string) {
	const before = (await command(["git", "rev-parse", "HEAD"])).trim();
	let output = "";
	try {
		await command(["git", "commit", "-m", `test: reject ${label}`]);
	} catch (error) {
		output = String(error);
	}
	if (!output || (requiredOutput && !output.includes(requiredOutput)))
		throw new Error(`Probe ${label} did not reject for expected reason: ${output}`);
	if ((await command(["git", "rev-parse", "HEAD"])).trim() !== before)
		throw new Error(`Probe ${label} advanced HEAD`);
	await command(["git", "reset", "--hard", "HEAD"]);
	console.log(`已证实拒绝：${label}`);
}
try {
	mkdirSync(join(root, "scripts"));
	mkdirSync(join(root, ".husky"));
	for (const file of ["process.ts", "snapshot.ts", "gate-l1.ts", "unit-tests.ts"])
		copyFileSync(`scripts/${file}`, join(root, "scripts", file));
	copyFileSync("bun.lock", join(root, "bun.lock"));
	const manifest = JSON.parse(readFileSync("package.json", "utf8"));
	manifest.scripts = {
		"gate:l1": "bun scripts/gate-l1.ts",
		"test:coverage": "bun scripts/unit-tests.ts",
		lint: "biome check --error-on-warnings .",
		typecheck: "tsc --noEmit",
	};
	write("package.json", JSON.stringify(manifest));
	write("source.ts", source);
	write("sample.test.ts", tests);
	write("vitest.config.ts", config);
	write(
		"tsconfig.json",
		JSON.stringify({
			compilerOptions: {
				strict: true,
				noEmit: true,
				target: "ES2023",
				module: "ESNext",
				moduleResolution: "Bundler",
				types: ["bun"],
				skipLibCheck: true,
			},
			include: ["source.ts", "sample.test.ts"],
		}),
	);
	write(
		"biome.json",
		JSON.stringify({
			files: { includes: ["source.ts", "sample.test.ts"] },
			formatter: { enabled: false },
			assist: { enabled: false },
			linter: { enabled: true, rules: { recommended: true, suspicious: { noDebugger: "warn" } } },
		}),
	);
	write(".gitignore", "node_modules/\ncoverage/\ntest-results/\n.husky/_/\n");
	write(".husky/pre-commit", readFileSync(".husky/pre-commit", "utf8"));
	await command(["git", "init", "-b", "main"]);
	await command(["git", "config", "user.name", "Rhino Gate Fixture"]);
	await command(["git", "config", "user.email", "fixture@example.test"]);
	await prepareDependencies(root);
	await command(["node", "node_modules/husky/bin.js"]);
	await command(["git", "add", "."]);
	await command(["git", "commit", "-m", "test: healthy gate fixture"]);
	console.log("已证实：真实 Husky 健康输入提交成功");
	write("sample.test.ts", tests.replace("toBe(1)", "toBe(9)"));
	await command(["git", "add", "sample.test.ts"]);
	await rejectCommit("unit failure", "FAIL");
	for (const metric of ["statements", "branches", "functions", "lines"]) {
		write("vitest.config.ts", config.replace(`${metric}: 95`, `${metric}: 101`));
		await command(["git", "add", "vitest.config.ts"]);
		await rejectCommit(`${metric} coverage`, metric);
	}
	for (const severity of ["warn", "error"]) {
		write("source.ts", `${source}debugger;\n`);
		if (severity === "error")
			write(
				"biome.json",
				readFileSync(join(root, "biome.json"), "utf8").replace('"warn"', '"error"'),
			);
		await command(["git", "add", "source.ts", "biome.json"]);
		await rejectCommit(`lint ${severity}`, "noDebugger");
	}
	write("source.ts", `${source}const invalid: string = 1;\n`);
	await command(["git", "add", "source.ts"]);
	await rejectCommit("type error", "TS2322");
	write("source.ts", source.replace("-value", "value"));
	await command(["git", "add", "source.ts"]);
	await rejectCommit("staged bug", "FAIL");
	write("source.ts", source.replace("-value", "value"));
	await command(["git", "add", "source.ts"]);
	write("source.ts", source);
	await rejectCommit("staged bug with unstaged fix", "FAIL");
	for (const script of [
		"definitely-missing-rhino-tool",
		"bun -e 'process.kill(process.pid, \"SIGTERM\")'",
	]) {
		const changed = { ...manifest, scripts: { ...manifest.scripts, typecheck: script } };
		write("package.json", JSON.stringify(changed));
		await command(["git", "add", "package.json"]);
		await rejectCommit(script.startsWith("bun") ? "child signal" : "missing tool");
	}
	write(
		"scripts/gate-l1.ts",
		readFileSync(join(root, "scripts/gate-l1.ts"), "utf8").replace("60_000", "50"),
	);
	await command(["git", "add", "scripts/gate-l1.ts"]);
	await rejectCommit("timeout", "timed out");
	write("sample.test.ts", tests.replace('test("boundaries"', 'test.skip("boundaries"'));
	await command(["git", "add", "sample.test.ts"]);
	await rejectCommit("skipped required suite");
	await command(["git", "rm", "sample.test.ts"]);
	await rejectCommit("empty required suite");
	console.log(
		"真实 runner／Husky／暂存快照失败阻断探针完成；覆盖率单项使用 101% 阈值探针，不代表项目覆盖率。",
	);
} finally {
	if (readFileSync(join(root, "run-id"), "utf8") === marker) rmSync(root, { recursive: true });
	else console.error(`Refusing fixture cleanup: marker mismatch at ${root}`);
}
