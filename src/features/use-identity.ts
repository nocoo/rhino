import { useEffect, useState } from "react";
import type { IdentityProfile } from "../domain/contracts";
import { api } from "../lib/api";

export function useIdentity() {
	const [identity, setIdentity] = useState<IdentityProfile>({ name: null, avatar: null });
	useEffect(() => {
		const controller = new AbortController();
		void api<IdentityProfile>("/identity", { signal: controller.signal })
			.then((profile) => {
				if (!controller.signal.aborted) setIdentity(profile);
			})
			.catch(() => {});
		return () => controller.abort();
	}, []);
	return identity;
}
