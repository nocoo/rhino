import { run } from "./process";
import { withSnapshot } from "./snapshot";

const input = await new Response(Bun.stdin.stream()).text();
const revisions = new Set<string>();
for (const line of input.trim().split("\n").filter(Boolean)) {
	const fields = line.trim().split(/\s+/);
	if (
		fields.length !== 4 ||
		!/^[a-f0-9]{40,64}$/.test(fields[1] ?? "") ||
		!/^[a-f0-9]{40,64}$/.test(fields[3] ?? "")
	) {
		throw new Error("Malformed Git pre-push input");
	}
	const sha = fields[1];
	if (sha && !/^0+$/.test(sha)) revisions.add(sha);
}
for (const revision of revisions) {
	await withSnapshot(revision, async (cwd, env) => {
		const outcomes = await Promise.allSettled(
			["test:l2", "gate:security"].map((script) =>
				run(["bun", "run", script], { cwd, env, timeout: 170_000 }),
			),
		);
		const failures = outcomes.filter((result) => result.status === "rejected");
		if (failures.length)
			throw new AggregateError(
				failures.map((result) => result.reason),
				`Pre-push rejected ${revision}`,
			);
	});
}
console.log(`Pre-push：已检查 ${revisions.size} 个推送 revision`);
