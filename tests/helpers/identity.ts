import { exportJWK, generateKeyPair, SignJWT } from "jose";

export async function createIdentity() {
	const first = await generateKeyPair("RS256");
	const rotated = await generateKeyPair("RS256");
	const untrusted = await generateKeyPair("RS256");
	const keys = await Promise.all(
		[first, rotated].map(async (pair, index) => ({
			...(await exportJWK(pair.publicKey)),
			kid: `rhino-test-${index}`,
			alg: "RS256",
			use: "sig",
		})),
	);
	async function token(
		options: {
			subject?: string;
			audience?: string | null;
			issuer?: string;
			expiry?: number | null;
			notBefore?: number;
			rotated?: boolean;
			badSignature?: boolean;
			missingSubject?: boolean;
		} = {},
	) {
		let jwt = new SignJWT({ email: "synthetic@example.test" })
			.setProtectedHeader({ alg: "RS256", kid: options.rotated ? "rhino-test-1" : "rhino-test-0" })
			.setIssuer(options.issuer ?? "https://nocoo.cloudflareaccess.com")
			.setIssuedAt();
		if (!options.missingSubject) jwt = jwt.setSubject(options.subject ?? "rhino-local-owner");
		if (options.audience !== null) jwt = jwt.setAudience(options.audience ?? "rhino-test");
		if (options.expiry !== null)
			jwt = jwt.setExpirationTime(options.expiry ?? Math.floor(Date.now() / 1000) + 3600);
		if (options.notBefore) jwt = jwt.setNotBefore(options.notBefore);
		return jwt.sign(
			(options.badSignature ? untrusted : options.rotated ? rotated : first).privateKey,
		);
	}
	const tokens = {
		owner: await token(),
		rotated: await token({ rotated: true }),
		other: await token({ subject: "not-the-owner" }),
		expired: await token({ expiry: 1 }),
		wrongAudience: await token({ audience: "other-app" }),
		missingAudience: await token({ audience: null }),
		wrongIssuer: await token({ issuer: "https://untrusted.example.test" }),
		badSignature: await token({ badSignature: true }),
		noExpiry: await token({ expiry: null }),
		future: await token({ notBefore: Math.floor(Date.now() / 1000) + 3600 }),
		missingSubject: await token({ missingSubject: true }),
	};
	return { jwks: JSON.stringify({ keys }), tokens, token };
}
