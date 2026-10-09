import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
const database = config.d1_databases?.[0];
if (
	config.vars.RESOURCE_ENV !== "production" ||
	!config.vars.OWNER_SUB ||
	config.vars.TEST_ACCESS_JWKS ||
	!database ||
	database.database_name !== "rhino" ||
	!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(database.database_id) ||
	database.database_id === "00000000-0000-0000-0000-000000000000"
) {
	throw new Error("Production owner and confirmed D1 UUID must be explicitly configured");
}
