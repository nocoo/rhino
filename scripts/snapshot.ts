import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { cleanEnvironment, run } from "./process";

export async function prepareDependencies(path: string): Promise<void> {
	const source = resolve(import.meta.dirname, "..");
	if (
		readFileSync(join(path, "bun.lock"), "utf8") !== readFileSync(join(source, "bun.lock"), "utf8")
	) {
		throw new Error(
			"Snapshot lockfile differs from installed dependencies; install that revision before retrying",
		);
	}
	const manifest = JSON.parse(readFileSync(join(path, "package.json"), "utf8"));
	for (const [name, version] of Object.entries({
		...manifest.dependencies,
		...manifest.devDependencies,
	})) {
		const installed = JSON.parse(
			readFileSync(join(source, "node_modules", name, "package.json"), "utf8"),
		);
		if (installed.version !== version)
			throw new Error(`Installed ${name} does not match snapshot pin ${version}`);
	}
	await run(
		process.platform === "darwin"
			? ["cp", "-cR", join(source, "node_modules"), join(path, "node_modules")]
			: ["cp", "-R", "--reflink=auto", join(source, "node_modules"), join(path, "node_modules")],
		{ timeout: 60_000 },
	);
}

export async function withSnapshot(
	ref: string | undefined,
	check: (path: string, env: NodeJS.ProcessEnv) => Promise<void>,
): Promise<void> {
	const root = mkdtempSync(join(tmpdir(), "rhino-gate-"));
	const path = join(root, "source");
	mkdirSync(path);
	const env: NodeJS.ProcessEnv = { ...cleanEnvironment(), XDG_CACHE_HOME: join(root, "cache") };
	try {
		if (ref) {
			if (!/^[a-f0-9]{40,64}$/.test(ref)) throw new Error("Invalid pushed revision");
			await run(["git", "archive", "--format=tar", `--output=${join(root, "source.tar")}`, ref], {
				capture: true,
			});
			await run(["tar", "-xf", join(root, "source.tar"), "-C", path], { capture: true });
		} else {
			await run(["git", "checkout-index", "--all", `--prefix=${path}/`], { capture: true });
		}
		env.RHINO_SOURCE_FILES = JSON.stringify(
			readdirSync(path, { recursive: true, withFileTypes: true })
				.filter((file) => file.isFile())
				.map((file) => join(file.parentPath, file.name).slice(path.length + 1)),
		);
		await prepareDependencies(path);
		await check(path, env);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}
