import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const root = new URL("../", import.meta.url).pathname;
const server = await createServer({
	root,
	configFile: false,
	appType: "custom",
	server: { host: "127.0.0.1", port: 0 },
});
server.middlewares.use((request, response, next) => {
	if (request.url !== "/") return next();
	response.setHeader("content-type", "text/html");
	response.end(
		`<body style="margin:0;background:#dfe6ef"><div id="stage" style="width:340px;height:420px"></div><script type="module">import {createExerciseScene} from '/src/three/exercise-scene.ts'; window.scene=await createExerciseScene(document.querySelector('#stage'),'goblet-squat',()=>{});</script>`,
	);
});
await server.listen();
const browser = await chromium.launch({ headless: true });
try {
	const page = await browser.newPage({
		viewport: { width: 340, height: 420 },
		deviceScaleFactor: 1,
	});
	await page.goto(server.resolvedUrls.local[0]);
	await page.waitForFunction(() => window.scene);
	const output = `${root}public/models/exercises`;
	mkdirSync(output, { recursive: true });
	const sheet = await browser.newPage({
		viewport: { width: 680, height: 420 },
		deviceScaleFactor: 1,
	});
	for (const id of [
		"goblet-squat",
		"romanian-deadlift",
		"chest-press",
		"cable-row",
		"lat-pulldown",
		"shoulder-press",
		"dumbbell-curl",
		"triceps-kickback",
		"lateral-raise",
		"bent-over-row",
		"calf-raise",
	]) {
		const frames = [];
		await page.evaluate((exercise) => window.scene.setExercise(exercise), id);
		for (const phase of [0, 0.5]) {
			await page.evaluate((value) => window.scene.setProgress(value), phase);
			frames.push((await page.screenshot()).toString("base64"));
		}
		await sheet.setContent(
			`<body style="margin:0;display:flex">${frames.map((frame) => `<img width="340" height="420" src="data:image/png;base64,${frame}">`).join("")}</body>`,
		);
		await sheet
			.locator("img")
			.evaluateAll((images) => Promise.all(images.map((image) => image.decode())));
		await sheet.screenshot({ path: `${output}/${id}.png` });
		console.log(`Exported ${id} static phases`);
	}
	await page.evaluate(() => window.scene.dispose());
} finally {
	await browser.close();
	await server.close();
}
