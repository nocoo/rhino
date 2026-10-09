export function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(sortKeys);
	}
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		return Object.fromEntries(
			Object.keys(record)
				.sort()
				.map((key) => [key, sortKeys(record[key])]),
		);
	}
	return value;
}

export function canonicalize(value: unknown): string {
	return JSON.stringify(sortKeys(value));
}

export function stableUuid(seed: string): string {
	const hex = mixHex(seed, 32);
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function sha256Hex(value: string): Promise<string> {
	const bytes = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function contentHash(value: unknown): Promise<string> {
	return sha256Hex(canonicalize(value));
}

function mixHex(seed: string, length: number): string {
	let h1 = 2166136261;
	let h2 = 16777619;
	let h3 = 0x9e3779b9;
	let h4 = 0x85ebca6b;
	for (let index = 0; index < seed.length; index += 1) {
		const code = seed.charCodeAt(index);
		h1 ^= code;
		h1 = Math.imul(h1, 16777619);
		h2 ^= code + index;
		h2 = Math.imul(h2, 2166136261);
		h3 = Math.imul(h3 ^ code, 2246822519);
		h4 = Math.imul(h4 + code + index, 3266489917);
	}
	const parts = [h1, h2, h3, h4].map((value) => (value >>> 0).toString(16).padStart(8, "0"));
	return parts.join("").slice(0, length);
}
