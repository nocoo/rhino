import type { IdentityProfile } from "../../src/domain/contracts";
import { authorProfile } from "../author-profile";
import type { AuthContext } from "../env";

export async function getIdentity(auth: AuthContext): Promise<IdentityProfile> {
	const email = auth.email;
	const profile = email ? await authorProfile(email) : { name: null, avatar: null };
	return {
		email,
		name: profile.name ?? auth.accessName ?? (email ? email.split("@")[0] : null),
		avatar: profile.avatar,
	};
}
