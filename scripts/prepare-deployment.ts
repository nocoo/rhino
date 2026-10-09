import { readFileSync, writeFileSync } from "node:fs";
import { run } from "./process";
import "./verify-production";

const revision = (await run(["git", "rev-parse", "HEAD"], { capture: true })).trim();
if (!/^[a-f0-9]{40}$/.test(revision) || process.env.GITHUB_ACTIONS !== "true") {
	throw new Error("Deployment metadata requires the proven CI checkout");
}
const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
config.vars.DEPLOY_REVISION = revision;
writeFileSync("wrangler.jsonc", `${JSON.stringify(config, null, "\t")}\n`);
console.log(`生产构建 revision：${revision}`);
