import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorProfile } from "../../../worker/author-profile";

const remoteFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
const EMPTY_PROFILE = { name: null, avatar: null };

beforeEach(() => {
	remoteFetch.mockReset();
	vi.stubGlobal("fetch", remoteFetch);
});

afterEach(() => vi.unstubAllGlobals());

describe("authorProfile", () => {
	it("returns an empty profile without fetching when the authenticated email is absent", async () => {
		await expect(authorProfile(null)).resolves.toEqual(EMPTY_PROFILE);
		await expect(authorProfile("  ")).resolves.toEqual(EMPTY_PROFILE);
		expect(remoteFetch).not.toHaveBeenCalled();
	});

	it("fetches a normalized email hash and returns a valid profile", async () => {
		remoteFetch.mockResolvedValue(
			Response.json({ name: " Owner ", avatar: "https://images.example.test/avatar.webp" }),
		);

		await expect(authorProfile(" Owner@Example.Test ")).resolves.toEqual({
			name: "Owner",
			avatar: "https://images.example.test/avatar.webp",
		});
		const [input, init] = remoteFetch.mock.calls[0] ?? [];
		const digest = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode("owner@example.test"),
		);
		const hash = Array.from(new Uint8Array(digest), (byte) =>
			byte.toString(16).padStart(2, "0"),
		).join("");
		expect(new URL(String(input)).searchParams.get("hash")).toBe(hash);
		expect(init).toMatchObject({
			headers: { Accept: "application/json" },
			redirect: "manual",
		});
		expect(init?.signal).toBeInstanceOf(AbortSignal);
	});

	it("fails soft on remote HTTP and network failures", async () => {
		remoteFetch.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
		await expect(authorProfile("owner@example.test")).resolves.toEqual(EMPTY_PROFILE);
		remoteFetch.mockRejectedValueOnce(new Error("network unavailable"));
		await expect(authorProfile("owner@example.test")).resolves.toEqual(EMPTY_PROFILE);
	});

	it("fails soft on malformed JSON and invalid profile shapes", async () => {
		remoteFetch.mockResolvedValueOnce(new Response("{"));
		await expect(authorProfile("owner@example.test")).resolves.toEqual(EMPTY_PROFILE);
		remoteFetch.mockResolvedValueOnce(Response.json({ name: "", avatar: null }));
		await expect(authorProfile("owner@example.test")).resolves.toEqual(EMPTY_PROFILE);
		remoteFetch.mockResolvedValueOnce(Response.json({ name: null, avatar: null }));
		await expect(authorProfile("owner@example.test")).resolves.toEqual(EMPTY_PROFILE);
	});

	it("rejects oversized streamed profiles", async () => {
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array(16 * 1024 + 1));
				controller.close();
			},
		});
		remoteFetch.mockResolvedValueOnce(new Response(body));
		await expect(authorProfile("owner@example.test")).resolves.toEqual(EMPTY_PROFILE);
	});

	it("accepts only absolute HTTPS avatars without URL credentials", async () => {
		for (const avatar of [
			"http://images.example.test/avatar.webp",
			"https://user:secret@images.example.test/avatar.webp",
		]) {
			remoteFetch.mockResolvedValueOnce(Response.json({ name: "Owner", avatar }));
			await expect(authorProfile("owner@example.test")).resolves.toEqual(EMPTY_PROFILE);
		}
	});
});
