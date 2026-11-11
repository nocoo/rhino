import { describe, expect, it } from "vitest";
import { getDisplayName } from "../../../src/lib/identity-display";

describe("getDisplayName", () => {
	it("prefers the profile name and passes through email and avatar", () => {
		expect(
			getDisplayName({
				name: "Zheng Li",
				email: "zheng@example.com",
				avatar: "https://cdn.example/avatar.jpg",
			}),
		).toEqual({
			name: "Zheng Li",
			initial: "Z",
			email: "zheng@example.com",
			avatar: "https://cdn.example/avatar.jpg",
		});
	});

	it("falls back to the email local-part and then User", () => {
		expect(getDisplayName({ name: null, email: "alice@example.com", avatar: null })).toEqual({
			name: "alice",
			initial: "A",
			email: "alice@example.com",
			avatar: null,
		});
		expect(getDisplayName(null)).toEqual({
			name: "User",
			initial: "U",
			email: null,
			avatar: null,
		});
	});

	it("ignores empty avatars", () => {
		expect(getDisplayName({ name: "Bob", email: "bob@example.com", avatar: "" })).toEqual({
			name: "Bob",
			initial: "B",
			email: "bob@example.com",
			avatar: null,
		});
	});
});
