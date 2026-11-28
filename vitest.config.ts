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
				"src/domain/**/*.{ts,tsx}",
				"worker/**/*.ts",
				"src/models/**/*.{ts,tsx}",
				"src/hooks/**/*.{ts,tsx}",
				"src/features/**/*.ts",
				"src/lib/api.ts",
			],
			exclude: [
				"**/*.d.ts",
				// Pure View components & Three.js scenes — covered by L4 E2E
				"src/components/**",
				"src/features/**/*.tsx",
				"src/app.tsx",
				"src/main.tsx",
				"src/three/**",
				// Local Vite dev/E2E environment plugin — never bundled into production Worker
				"dev/**",
			],
			reporter: ["text", "json-summary", "lcov"],
			thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
		},
	},
});
