import { dateRangeQuerySchema, parseWithSchema } from "../../src/domain/contracts";
import { deriveProgress } from "../../src/domain/metrics";
import * as db from "../db";
import type { WorkerEnv } from "../env";
import { jsonOk, queryValue } from "../http";

export async function getProgress(url: URL, env: WorkerEnv): Promise<Response> {
	const range = parseWithSchema(dateRangeQuerySchema, {
		from: queryValue(url, "from"),
		to: queryValue(url, "to"),
	});
	const measurements = await db.listMeasurements(env.DB, range.from, range.to);
	const heights = (await db.listAllMeasurements(env.DB)).filter((row) => row.kind === "height");
	const merged = [
		...heights.filter((row) => !measurements.some((item) => item.id === row.id)),
		...measurements,
	];
	const sessions = await db.listSessions(env.DB, range.from, range.to);
	return jsonOk(deriveProgress({ from: range.from, to: range.to, measurements: merged, sessions }));
}
