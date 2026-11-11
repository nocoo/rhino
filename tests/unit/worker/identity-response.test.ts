import { afterEach, expect, it, vi } from "vitest";
import { getIdentity } from "../../../worker/routes/identity";

const remoteFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

afterEach(() => {
	remoteFetch.mockReset();
	vi.unstubAllGlobals();
});

it("merges author profile, JWT name and email local-part fallbacks", async () => {
	vi.stubGlobal("fetch", remoteFetch);
	remoteFetch.mockResolvedValueOnce(
		Response.json({ name: "Zheng Li", avatar: "https://images.example.test/avatar.webp" }),
	);

	const hit = await getIdentity({
		sub: "owner",
		mode: "access",
		email: "signed@example.com",
		accessName: "JWT Name",
	});
	expect(hit).toEqual({
		email: "signed@example.com",
		name: "Zheng Li",
		avatar: "https://images.example.test/avatar.webp",
	});

	remoteFetch.mockResolvedValueOnce(new Response("rate limited", { status: 429 }));
	const miss = await getIdentity({
		sub: "owner",
		mode: "access",
		email: "alice@example.com",
		accessName: "Alice",
	});
	expect(miss).toEqual({
		email: "alice@example.com",
		name: "Alice",
		avatar: null,
	});

	remoteFetch.mockReset();
	const localPart = await getIdentity({
		sub: "owner",
		mode: "access",
		email: "bob@example.com",
		accessName: null,
	});
	expect(localPart).toEqual({
		email: "bob@example.com",
		name: "bob",
		avatar: null,
	});
	expect(remoteFetch).toHaveBeenCalledOnce();
});

it("returns empty profile fields for local synthetic identity", async () => {
	vi.stubGlobal("fetch", remoteFetch);
	const local = await getIdentity({
		sub: "rhino-local-owner",
		mode: "local",
		email: null,
		accessName: null,
	});
	expect(local).toEqual({ email: null, name: null, avatar: null });
	expect(remoteFetch).not.toHaveBeenCalled();
});
