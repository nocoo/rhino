import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/l3",
	fullyParallel: false,
	workers: 1,
	forbidOnly: true,
	retries: 0,
	timeout: 30_000,
	outputDir: "test-results/l3/browser",
	reporter: [["list"], ["html", { outputFolder: "test-results/l3/report", open: "never" }]],
	use: {
		baseURL: process.env.RHINO_TEST_URL,
		extraHTTPHeaders: {
			"Cf-Access-Jwt-Assertion": JSON.parse(process.env.RHINO_TEST_TOKENS ?? "{}").owner ?? "",
		},
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{ name: "desktop", use: { ...devices["Desktop Chrome"] } },
		{ name: "mobile", use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" } },
	],
});
