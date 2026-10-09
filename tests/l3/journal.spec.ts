import { expect, type Page, test } from "@playwright/test";
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
	await expect(page.getByText(/WebGL|静态|三维/).first()).toBeVisible();
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
				if (name === "今日训练" || name === "动作实验室")
					await expect(page.locator(".movement-viewer")).toBeVisible();
				const sizes = await page.locator(".rhino-island").evaluate((island) => {
					const rect = island.getBoundingClientRect();
					return {
						overflow: island.scrollWidth > island.clientWidth,
						clipped: [...island.querySelectorAll("input,button,[role=combobox]")]
							.filter((control) => {
								if (control.closest("table")) return false;
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
