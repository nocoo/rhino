// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIdentity } from "../../../src/features/use-identity";
import * as client from "../../../src/lib/api";

vi.mock("../../../src/lib/api", () => ({ api: vi.fn() }));
const api = vi.mocked(client.api);
const EMPTY_IDENTITY = { name: null, avatar: null };

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

describe("useIdentity", () => {
	it("resolves the identity profile from the API", async () => {
		api.mockResolvedValueOnce({ name: "Owner", avatar: "https://images.example.test/avatar.webp" });
		const { result } = renderHook(useIdentity);
		expect(api).toHaveBeenCalledWith(
			"/identity",
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		);
		await waitFor(() =>
			expect(result.current).toEqual({
				name: "Owner",
				avatar: "https://images.example.test/avatar.webp",
			}),
		);
	});

	it("keeps the anonymous identity when the request fails", async () => {
		api.mockRejectedValueOnce(new Error("offline"));
		const { result } = renderHook(useIdentity);
		await waitFor(() => expect(api).toHaveBeenCalledOnce());
		expect(result.current).toEqual(EMPTY_IDENTITY);
	});

	it("aborts the request on unmount and ignores a late resolution", async () => {
		let resolve!: (value: { name: string | null; avatar: string | null }) => void;
		api.mockReturnValueOnce(new Promise((yes) => (resolve = yes)));
		const { result, unmount } = renderHook(useIdentity);
		const signal = api.mock.calls[0]?.[1]?.signal;
		expect(signal?.aborted).toBe(false);
		unmount();
		expect(signal?.aborted).toBe(true);
		await act(async () => {
			resolve({ name: "Late", avatar: null });
			await Promise.resolve();
		});
		expect(result.current).toEqual(EMPTY_IDENTITY);
	});
});
