import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const testState = process.env.RHINO_TEST_STATE;
if (testState && process.env.CLOUDFLARE_ENV !== "test") {
	throw new Error("Test state requires the test environment");
}

export default defineConfig({
	cacheDir: testState ? `${testState}/vite-cache` : "node_modules/.vite",
	plugins: [
		react(),
		cloudflare({
			inspectorPort: false,
			remoteBindings: false,
			configPath: process.env.RHINO_TEST_CONFIG ?? "wrangler.jsonc",
			persistState: { path: testState ?? ".wrangler/state" },
		}),
	],
	server: {
		cors: false,
		host: "127.0.0.1",
		port: 7057,
		strictPort: true,
		allowedHosts: ["rhino.dev.hexly.ai"],
		watch: { ignored: ["**/.wrangler/**", "**/coverage/**", "**/test-results/**"] },
	},
	build: { sourcemap: true },
});
