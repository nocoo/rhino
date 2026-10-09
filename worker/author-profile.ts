import { z } from "zod";
import type { IdentityProfile } from "../src/domain/contracts";

const profileSchema = z.object({
	name: z.string().trim().min(1).max(120).nullable(),
	avatar: z
		.url({ protocol: /^https$/ })
		.refine((value) => {
			const url = new URL(value);
			return !url.username && !url.password;
		})
		.nullable(),
});

export async function authorProfile(email: string | null): Promise<IdentityProfile> {
	const empty = { name: null, avatar: null };
	if (!email?.trim()) return empty;
	try {
		const digest = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode(email.trim().toLowerCase()),
		);
		const hash = Array.from(new Uint8Array(digest), (byte) =>
			byte.toString(16).padStart(2, "0"),
		).join("");
		const response = await fetch(`https://lizheng.blog/api/authors/profile?hash=${hash}`, {
			headers: { Accept: "application/json" },
			redirect: "manual",
			signal: AbortSignal.timeout(2500),
		});
		if (!response.ok || !response.body) {
			await response.body?.cancel();
			return empty;
		}
		const reader = response.body.getReader();
		let text = "";
		let bytes = 0;
		const decoder = new TextDecoder();
		try {
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				bytes += value.byteLength;
				if (bytes > 16 * 1024) {
					await reader.cancel();
					return empty;
				}
				text += decoder.decode(value, { stream: true });
			}
			text += decoder.decode();
		} finally {
			reader.releaseLock();
		}
		const parsed = profileSchema.safeParse(JSON.parse(text));
		return parsed.success ? parsed.data : empty;
	} catch {
		return empty;
	}
}
