import { createLocalJWKSet, createRemoteJWKSet, type JSONWebKeySet, jwtVerify } from "jose";
import { ApiError } from "../src/domain/contracts";
import type { AuthContext, WorkerEnv } from "./env";

const CLOCK_TOLERANCE_SECONDS = 60;
const REQUIRED_CLAIMS = ["exp", "sub"] as const;
let remoteJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let remoteJwksIssuer: string | null = null;

export async function authenticate(request: Request, env: WorkerEnv): Promise<AuthContext> {
	if (env.RESOURCE_ENV === "local") {
		const owner = configuredOwner(env);
		return { sub: owner, mode: "local", email: null };
	}
	if (env.RESOURCE_ENV === "production") {
		configuredOwner(env);
		const identity = await verifyAccessJwt(request, env, await productionKeySet(env));
		assertOwner(identity.sub, env);
		return identity;
	}
	if (env.RESOURCE_ENV === "test") {
		const identity = await verifyAccessJwt(request, env, await testKeySet(env));
		assertOwner(identity.sub, env);
		return identity;
	}
	throw new ApiError(500, "auth_configuration_error", "Unknown resource environment");
}

export function configuredOwner(env: WorkerEnv): string {
	const owner = env.OWNER_SUB.trim();
	if (!owner) {
		throw new ApiError(403, "owner_not_configured", "Owner identity is not configured");
	}
	return owner;
}

export function assertOwner(sub: string, env: WorkerEnv): void {
	const owner = configuredOwner(env);
	if (sub !== owner) {
		throw new ApiError(403, "forbidden", "Authenticated subject is not the owner");
	}
}

async function verifyAccessJwt(
	request: Request,
	env: WorkerEnv,
	keySet: ReturnType<typeof createLocalJWKSet> | ReturnType<typeof createRemoteJWKSet>,
): Promise<AuthContext> {
	const token = request.headers.get("Cf-Access-Jwt-Assertion");
	if (!token) {
		throw new ApiError(401, "unauthorized", "Missing Access assertion");
	}
	if (!env.ACCESS_ISSUER || !env.ACCESS_AUD) {
		throw new ApiError(
			500,
			"auth_configuration_error",
			"Access issuer or audience is not configured",
		);
	}
	try {
		const { payload } = await jwtVerify(token, keySet, {
			issuer: env.ACCESS_ISSUER,
			audience: env.ACCESS_AUD,
			algorithms: ["RS256"],
			requiredClaims: [...REQUIRED_CLAIMS],
			clockTolerance: CLOCK_TOLERANCE_SECONDS,
		});
		if (typeof payload.sub !== "string" || payload.sub.length === 0) {
			throw new ApiError(401, "unauthorized", "Access assertion is missing a subject");
		}
		return {
			sub: payload.sub,
			mode: "access",
			email: typeof payload.email === "string" ? payload.email : null,
		};
	} catch (error) {
		if (error instanceof ApiError) {
			throw error;
		}
		throw new ApiError(403, "forbidden", "Invalid Access assertion");
	}
}

async function productionKeySet(env: WorkerEnv): Promise<ReturnType<typeof createRemoteJWKSet>> {
	if (remoteJwks && remoteJwksIssuer === env.ACCESS_ISSUER) {
		return remoteJwks;
	}
	remoteJwks = createRemoteJWKSet(
		new URL(`${env.ACCESS_ISSUER.replace(/\/$/, "")}/cdn-cgi/access/certs`),
	);
	remoteJwksIssuer = env.ACCESS_ISSUER;
	return remoteJwks;
}

export async function testKeySet(env: WorkerEnv): Promise<ReturnType<typeof createLocalJWKSet>> {
	if (env.RESOURCE_ENV !== "test") {
		throw new ApiError(
			500,
			"auth_configuration_error",
			"Test JWKS is only valid in the test environment",
		);
	}
	const source = env.TEST_ACCESS_JWKS.trim();
	if (!source) {
		throw new ApiError(500, "auth_configuration_error", "TEST_ACCESS_JWKS is required in test");
	}
	const jwks = parseJwksJson(source);
	return createLocalJWKSet(jwks);
}

function parseJwksJson(text: string): JSONWebKeySet {
	try {
		const parsed = JSON.parse(text) as JSONWebKeySet;
		if (!parsed || !Array.isArray(parsed.keys)) {
			throw new Error("missing keys");
		}
		return parsed;
	} catch {
		throw new ApiError(
			500,
			"auth_configuration_error",
			"TEST_ACCESS_JWKS is not a valid JWKS document",
		);
	}
}

export function resetAuthCaches(): void {
	remoteJwks = null;
	remoteJwksIssuer = null;
}
