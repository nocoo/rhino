import type { ResourceEnv } from "../src/domain/contracts";

export type WorkerEnv = Omit<Cloudflare.Env, "RESOURCE_ENV"> & {
	RESOURCE_ENV: ResourceEnv;
};

export type AuthContext = {
	sub: string;
	mode: "local" | "access";
	email: string | null;
};
