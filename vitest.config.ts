import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/unit/**/*.test.{ts,tsx}", "tests/helpers/**/*.test.ts"],
		environment: "node",
		passWithNoTests: false,
		allowOnly: false,
		testTimeout: 15_000,
		hookTimeout: 30_000,
		coverage: {
			provider: "v8",
			include: [
				"dev/**/*.ts",
				"src/domain/**/*.{ts,tsx}",
				"worker/**/*.ts",
				"src/models/**/*.{ts,tsx}",
				"src/hooks/**/*.{ts,tsx}",
				"src/features/**/*.ts",
				"src/lib/api.ts",
			],
			exclude: ["**/*.d.ts"],
			reporter: ["text", "json-summary", "lcov"],
			thresholds: { statements: 95, branches: 95, functions: 95, lines: 95 },
		},
	},
});
