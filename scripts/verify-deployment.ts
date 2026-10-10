import assert from "node:assert/strict";
import { version } from "../package.json";
import { run } from "./process";

const revision = (await run(["git", "rev-parse", "HEAD"], { capture: true })).trim();
if (!/^[a-f0-9]{40}$/.test(revision)) {
	throw new Error("Deployment verification requires the proven checkout revision");
}

const live = await fetch("https://rhino.hexly.ai/api/live", {
	redirect: "manual",
	signal: AbortSignal.timeout(10_000),
});
if (live.status !== 200 || live.headers.get("cache-control") !== "no-store") {
	throw new Error("Production health must return uncached HTTP 200");
}
assert.deepEqual(
	await live.json(),
	{ status: "ok", name: "rhino", version, revision },
	new Error("Production health must match the proven version and revision"),
);

const response = await fetch("https://rhino.hexly.ai/api/profile", {
	redirect: "manual",
	signal: AbortSignal.timeout(10_000),
});
const redirect = response.headers.get("location");
if (
	response.status !== 302 ||
	!redirect ||
	new URL(redirect).hostname !== "nocoo.cloudflareaccess.com"
) {
	throw new Error("Unauthenticated production API must redirect to the configured Access team");
}
console.log(`部署验证完成：v${version} / ${revision}，D1 健康且业务 API 保持 Access 保护。`);
