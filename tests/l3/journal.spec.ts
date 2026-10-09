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
test("profile, measurements, plan, workout and reopened progress persist", async ({ page }) => {
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
	await page.getByRole("button", { name: "确认并开始", exact: true }).click();
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
