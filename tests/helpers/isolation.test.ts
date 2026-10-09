import { mkdirSync, symlinkSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { assertMarker, assertOwnedPath, cleanupDatabase, createTestRun } from "./isolation";

it("refuses mismatched ownership or escaping symlinks before fixture writes and cleanup", async () => {
	const run = createTestRun("http://127.0.0.1:17057", '{"keys":[]}');
	assertOwnedPath(run.state, run.id);
	mkdirSync(join(run.state, "v3/d1/fixture"), { recursive: true });
	const db = new DatabaseSync(join(run.state, "v3/d1/fixture", `${"a".repeat(64)}.sqlite`));
	db.exec("CREATE TABLE _test_marker(env TEXT, run_id TEXT)");
	db.prepare("INSERT INTO _test_marker VALUES('test',?)").run(run.id);
	db.close();
	try {
		await assertMarker(run);
		expect(() => assertOwnedPath(run.state, crypto.randomUUID())).toThrow("ID mismatch");
		await expect(cleanupDatabase({ ...run, id: crypto.randomUUID() })).rejects.toThrow();
		symlinkSync(process.cwd(), join(run.state, "escape"));
		expect(() => assertOwnedPath(run.state, run.id)).toThrow("symlink");
		unlinkSync(join(run.state, "escape"));
		await assertMarker(run);
	} finally {
		await cleanupDatabase(run);
	}
});
