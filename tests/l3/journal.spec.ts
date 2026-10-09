import { expect, type Page, test } from "@playwright/test";
import { EXERCISES } from "../../src/data/exercises";
import { CATALOG_VERSION, type GetSessionsResponse } from "../../src/domain/contracts";
import { addDays, localDateInTimeZone } from "../../src/domain/dates";
import { sessionTarget, uuid } from "../helpers/fixtures";
import { assertMarker, type TestRun } from "../helpers/isolation";

async function guard() {
	const state = process.env.RHINO_TEST_STATE,
		id = process.env.RHINO_TEST_RUN_ID,
		config = process.env.RHINO_TEST_CONFIG;
	if (!state || !id || !config) throw new Error("L3 requires the isolated runner");
	await assertMarker({ state, id, config, env: process.env } satisfies TestRun);
}
test.beforeEach(guard);
async function navigate(page: Page, name: string) {
	const menu = page.getByRole("button", { name: "打开导航", exact: true });
	if (await menu.isVisible()) await menu.click();
	await page.getByRole("button", { name: new RegExp(`^${name}( |$)`) }).click();
}
test("profile, measurements, plan, workout and reopened progress persist", async ({
	page,
}, testInfo) => {
	await page.goto("/");
	await navigate(page, "个人档案");
	await page.getByLabel("生日", { exact: true }).fill("1990-02-28");
	await page.getByRole("button", { name: "保存档案", exact: true }).click();
	await expect(page.getByText("档案已保存", { exact: true })).toBeVisible();
	await page.getByLabel("体重（kg）").fill("72.123");
	await page.getByRole("button", { name: "记录体重", exact: true }).click();
	await expect(
		page.getByText("测量记录已保存，同日记录会更新而非重复新增", { exact: true }),
	).toBeVisible();
	await page.getByLabel("身高（cm）").fill("180.125");
	await page.getByRole("button", { name: "记录身高", exact: true }).click();
	await expect(
		page.getByText("测量记录已保存，同日记录会更新而非重复新增", { exact: true }),
	).toBeVisible();
	await navigate(page, "训练计划");
	await page.getByRole("button", { name: "生成计划", exact: true }).click();
	await page.getByRole("button", { name: "采用这个计划", exact: true }).click();
	await expect(
		page.getByText("新计划已采用，旧版本与训练记录已保留", { exact: true }),
	).toBeVisible();
	await navigate(page, "今日训练");
	await page.getByRole("button", { name: "开始训练", exact: true }).click();
	await expect(page.getByRole("button", { name: "确认并开始", exact: true })).toBeVisible();
	await page.screenshot({
		path: testInfo.outputPath("session-preparation.png"),
		animations: "disabled",
	});
	await page.getByRole("button", { name: "确认并开始", exact: true }).click();
	await expect(page.getByRole("button", { name: "按计划完成", exact: true })).toBeVisible();
	await page.screenshot({
		path: testInfo.outputPath("session-active.png"),
		animations: "disabled",
	});
	await page.getByRole("button", { name: "按计划完成", exact: true }).click();
	await page.getByRole("button", { name: "保存训练", exact: true }).click();
	await expect(page.getByText("训练已记录。下一次，继续。", { exact: true })).toBeVisible();
	await page.reload();
	await navigate(page, "我的进展");
	await expect(page.getByText("72.123", { exact: false }).first()).toBeVisible();
	const response = await page.request.get("/api/sessions?from=2026-01-01&to=2026-12-31");
	expect(response.ok()).toBe(true);
	const result = await response.json();
	expect(
		result.data.sessions.some((session: { status: string }) => session.status === "completed"),
	).toBe(true);
});
test("failed save keeps editor input, and reduced-motion fallback remains accessible", async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.addInitScript(() => {
		const original = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (
			this: HTMLCanvasElement,
			type: string,
			...args: unknown[]
		) {
			if (type.includes("webgl")) return null;
			return original.call(this, type, ...args);
		} as typeof original;
	});
	await page.goto("/");
	await navigate(page, "个人档案");
	await page.getByLabel("体重（kg）").fill("73.25");
	await page.route("**/api/measurements/*", async (route) => {
		if (route.request().method() === "PUT") await route.abort("failed");
		else await route.continue();
	});
	await page.getByRole("button", { name: "记录体重", exact: true }).click();
	await expect(page.getByRole("alert")).toBeVisible();
	await expect(page.getByLabel("体重（kg）")).toHaveValue("73.25");
	await page.unroute("**/api/measurements/*");
	await page.getByRole("button", { name: "记录体重", exact: true }).click();
	await expect(
		page.getByText("测量记录已保存，同日记录会更新而非重复新增", { exact: true }),
	).toBeVisible();
	await navigate(page, "动作实验室");
	await page
		.locator(".library-nav")
		.getByRole("button", { name: /俯身哑铃臂屈伸/ })
		.click();
	const poster = page.getByRole("img", { name: "动作起始与中间阶段的静态示意，尚未经专业审核" });
	await expect(poster).toBeVisible();
	await expect(poster).toHaveJSProperty("naturalWidth", 680);
	await expect(page.getByRole("button", { name: "播放演示", exact: true })).toBeDisabled();
});

test("Basalt shell geometry, collapse and drawer focus match the reference", async ({
	page,
}, testInfo) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/");
	await page.locator(".page-body").waitFor();
	const mobile = testInfo.project.name === "mobile";
	const rail = page.getByRole("complementary", { name: "主导航侧栏" });
	const menu = page.getByRole("button", { name: "打开导航", exact: true });
	const island = page.locator(".rhino-island");
	const geometry = await island.evaluate((element) => {
		const style = getComputedStyle(element);
		const rect = element.getBoundingClientRect();
		return { top: rect.top, left: rect.left, padding: style.paddingLeft };
	});
	expect(geometry).toEqual({ top: 56, left: mobile ? 8 : 272, padding: mobile ? "12px" : "20px" });
	if (mobile) await menu.click();
	await expect(rail).toHaveCSS("width", "260px");
	const logo = await page.locator(".brand-symbol").boundingBox();
	const item = rail.getByRole("button", { name: "今日训练", exact: true });
	expect((await item.boundingBox())?.x).toBe(12);
	await expect(item).toHaveCSS("font-size", "14px");
	await expect(item).toHaveCSS("height", "40px");
	if (mobile) {
		await expect(page.getByRole("dialog")).toHaveCSS("width", "260px");
		await page.keyboard.press("Escape");
		await expect(menu).toBeFocused();
		await menu.click();
		await rail.getByRole("button", { name: "个人档案", exact: true }).click();
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await expect(menu).toBeFocused();
		await menu.click();
		await page.setViewportSize({ width: 768, height: 900 });
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await expect(rail).toHaveCSS("width", "260px");
		await expect(page.locator("body")).not.toHaveCSS("pointer-events", "none");
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(menu).toBeVisible();
		await expect(page.getByRole("dialog")).toHaveCount(0);
	} else {
		await page.getByRole("button", { name: "收起侧栏", exact: true }).click();
		await expect(rail).toHaveCSS("width", "68px");
		await expect(page.getByRole("button", { name: "展开侧栏", exact: true })).toBeFocused();
		expect(await page.locator(".brand-symbol").boundingBox()).toEqual(logo);
		await rail.getByRole("button", { name: "个人档案", exact: true }).hover();
		await expect(page.getByRole("tooltip")).toHaveText("个人档案");
		await rail.getByRole("button", { name: "个人档案", exact: true }).click();
		await expect(page.getByLabel("生日", { exact: true })).toBeVisible();
		await page.screenshot({ path: testInfo.outputPath("collapsed.png"), animations: "disabled" });
		await page.getByRole("button", { name: "展开侧栏", exact: true }).click();
		await expect(rail).toHaveCSS("width", "260px");
		await expect(page.getByRole("button", { name: "收起侧栏", exact: true })).toBeFocused();
	}
	await expect(page.getByLabel("生日", { exact: true })).toHaveCSS("height", "36px");
	await expect(page.getByLabel("生日", { exact: true }).locator("..")).toHaveCSS("gap", "6px");
	await expect(page.locator(".profile-layout form").first().locator("..")).toHaveCSS(
		"padding",
		"16px",
	);
	await expect(page.getByRole("button", { name: "保存档案", exact: true })).toHaveCSS(
		"font-size",
		"14px",
	);
});

test("all pages retain responsive spacing and usable controls in both themes", async ({
	page,
}, testInfo) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/");
	const widths = testInfo.project.name === "mobile" ? [360, 390] : [768, 1024, 1440];
	const pages = ["今日训练", "训练计划", "动作实验室", "我的进展", "个人档案"];
	for (const theme of ["light", "dark"]) {
		if (theme === "dark") await page.getByRole("button", { name: "切换主题", exact: true }).click();
		await expect(page.locator("html")).toHaveClass(new RegExp(theme));
		for (const width of widths) {
			await page.setViewportSize({ width, height: 1000 });
			for (const [index, name] of pages.entries()) {
				await navigate(page, name);
				await expect(page.locator(".page-body")).toBeVisible();
				if (name === "今日训练" || name === "动作实验室") {
					await expect(page.locator(".movement-viewer")).toBeVisible();
					await expect(page.getByRole("button", { name: "播放演示", exact: true })).toBeEnabled();
				}
				const sizes = await page.locator(".rhino-island").evaluate((island) => {
					const rect = island.getBoundingClientRect();
					return {
						overflow: island.scrollWidth > island.clientWidth,
						clipped: [...island.querySelectorAll("input,button,[role=combobox]")]
							.filter((control) => {
								if (control.closest("table, .library-nav")) return false;
								const box = control.getBoundingClientRect();
								return box.width > 0 && (box.left < rect.left || box.right > rect.right);
							})
							.map((control) => control.getAttribute("aria-label") ?? control.textContent),
					};
				});
				expect(sizes, `${theme} ${width}px ${name}`).toEqual({ overflow: false, clipped: [] });
				if (width === widths.at(-1))
					await page.screenshot({
						path: testInfo.outputPath(`${theme}-${index}.png`),
						animations: "disabled",
					});
			}
		}
	}
});

test("all eleven previews render with unobstructed controls and scrubbed arm views", async ({
	page,
}, testInfo) => {
	test.setTimeout(60_000);
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/");
	await navigate(page, "动作实验室");
	await expect(page.locator(".library-nav button")).toHaveCount(11);
	if (testInfo.project.name === "mobile") {
		const navigation = await page.locator(".library-nav").boundingBox();
		expect(navigation?.height).toBeLessThan(120);
	}
	for (const [index, exercise] of EXERCISES.entries()) {
		await page.locator(".library-nav button").nth(index).click();
		await expect(page.getByRole("button", { name: "播放演示", exact: true })).toBeEnabled();
		await expect(page.locator("canvas")).toHaveCount(1);
		await expect(page.locator(".stage-poster")).toHaveCount(0);
		const slider = page.getByRole("slider", { name: "动作进度" });
		await slider.focus();
		await slider.press("Home");
		for (let step = 0; step < 5; step++) await slider.press("PageUp");
		await expect(slider).toHaveAttribute("aria-valuenow", "50");
		await page.getByRole("button", { name: "侧面视角", exact: true }).click();
		await page.getByRole("button", { name: "背面视角", exact: true }).click();
		if (["triceps-kickback", "cable-row"].includes(exercise.id))
			await page.locator(".movement-viewer").screenshot({
				path: testInfo.outputPath(`${exercise.id}-rear.png`),
			});
		await page.getByRole("button", { name: "局部细节", exact: true }).click();
		if (exercise.id === "triceps-kickback")
			await page.locator(".movement-viewer").screenshot({
				path: testInfo.outputPath("triceps-kickback-detail.png"),
			});
		await page.getByRole("button", { name: "正面视角", exact: true }).click();
		await page.locator(".movement-viewer").scrollIntoViewIfNeeded();
		const canvas = await page.locator("canvas").boundingBox();
		const tools = await page.locator(".stage-controls").boundingBox();
		const playback = await page.locator(".playback-bar").boundingBox();
		if (!canvas || !tools || !playback) throw new Error("Missing viewer geometry");
		expect(canvas.height).toBeGreaterThanOrEqual(360);
		expect(tools.y + tools.height).toBeLessThanOrEqual(canvas.y + 1);
		expect(canvas.y + canvas.height).toBeLessThanOrEqual(playback.y + 1);
		if (["shoulder-press", "dumbbell-curl", "lateral-raise"].includes(exercise.id))
			await page.locator(".movement-viewer").screenshot({
				path: testInfo.outputPath(`${exercise.id}-front.png`),
			});
		await slider.press("End");
		await expect(slider).toHaveAttribute("aria-valuenow", "100");
	}
	await page.getByRole("button", { name: "播放演示", exact: true }).click();
	await expect(page.getByRole("button", { name: "暂停演示", exact: true })).toBeEnabled();
	await page.getByRole("button", { name: "暂停演示", exact: true }).click();
	await page.getByRole("button", { name: "切换肌群高亮", exact: true }).click();
	await expect(page.getByRole("button", { name: "切换肌群高亮" })).toHaveAttribute(
		"aria-pressed",
		"false",
	);
	expect(errors).toEqual([]);
});

test("five added movements can replace an old draft and persist precise per-hand loads", async ({
	page,
}) => {
	await page.goto("/");
	await navigate(page, "个人档案");
	await page.getByLabel("生日", { exact: true }).fill("1990-02-28");
	await page.getByRole("button", { name: "保存档案", exact: true }).click();
	await expect(page.getByText("档案已保存", { exact: true })).toBeVisible();
	const names = ["哑铃弯举", "俯身哑铃臂屈伸", "哑铃侧平举", "俯身哑铃划船", "哑铃提踵"];
	const ids = ["dumbbell-curl", "triceps-kickback", "lateral-raise", "bent-over-row", "calf-raise"];
	const target = sessionTarget();
	const exercise = target.blocks[0].exercises[0];
	target.blocks[0].exercises = names.map(() => ({
		...structuredClone(exercise),
		id: uuid(),
		workingSets: [{ ...exercise.workingSets[0], id: uuid() }],
	}));
	const date = localDateInTimeZone(new Date(), "Asia/Shanghai");
	const id = uuid();
	const seeded = await page.request.put(`/api/sessions/${id}`, {
		headers: { Origin: new URL(page.url()).origin },
		data: {
			expectedVersion: 0,
			mutationId: uuid(),
			sourcePlanRevision: null,
			localDate: date,
			timezone: "Asia/Shanghai",
			status: "draft",
			target,
			actual: null,
		},
	});
	expect(seeded.ok()).toBe(true);
	await page.reload();
	await page.getByRole("button", { name: "继续训练", exact: true }).click();
	for (const [index, name] of names.entries()) {
		await page.getByRole("combobox", { name: "训练动作", exact: true }).nth(index).click();
		await page.getByRole("option", { name, exact: true }).click();
	}
	await page.getByRole("button", { name: "确认并开始", exact: true }).click();
	await page.getByRole("button", { name: "按计划完成", exact: true }).click();
	for (const name of names)
		await page.getByLabel(`${name}第1组负重`, { exact: true }).fill("2.375");
	await page.getByRole("button", { name: "保存训练", exact: true }).click();
	await expect(page.getByText("训练已记录。下一次，继续。", { exact: true })).toBeVisible();
	await page.reload();
	const response = await page.request.get(`/api/sessions?from=${addDays(date, -365)}&to=${date}`);
	expect(response.ok()).toBe(true);
	const { data }: { data: GetSessionsResponse } = await response.json();
	const position = data.sessions.findIndex((session) => session.id === id);
	const saved = data.sessions[position];
	expect(saved.status).toBe("completed");
	const savedExercises = saved.target.blocks.flatMap((block) => block.exercises);
	expect(savedExercises.map((item) => item.exerciseId)).toEqual(ids);
	for (const item of savedExercises) {
		expect(item).toMatchObject({ catalogVersion: CATALOG_VERSION, loadConvention: "per-hand" });
		expect(item.workingSets[0].loadKg).toBeNull();
	}
	expect(saved.actual?.exercises.map((item) => item.sets[0].loadKg)).toEqual(
		names.map(() => 2.375),
	);
	await navigate(page, "我的进展");
	await page.getByRole("button", { name: "查看记录", exact: true }).nth(position).click();
	for (const name of names)
		await expect(page.getByLabel(`${name}第1组负重`, { exact: true })).toHaveValue("2.375");
});
