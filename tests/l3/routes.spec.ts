import { expect, test } from "@playwright/test";
import { addDays, localDateInTimeZone } from "../../src/domain/dates";
import { calendarPath, sessionPath } from "../../src/domain/routes";
import { sessionTarget, uuid } from "../helpers/fixtures";
import { assertMarker, type TestRun } from "../helpers/isolation";

test.beforeEach(async () => {
	const state = process.env.RHINO_TEST_STATE,
		id = process.env.RHINO_TEST_RUN_ID,
		config = process.env.RHINO_TEST_CONFIG;
	if (!state || !id || !config) throw new Error("L3 requires the isolated runner");
	await assertMarker({ state, id, config, env: process.env } satisfies TestRun);
});

test("calendar is home and native history restores pages and exercise paths", async ({
	page,
}, info) => {
	await page.goto("/");
	await expect(page).toHaveURL(/\/calendar$/);
	await expect(page.getByRole("region", { name: "训练月历" })).toBeVisible();
	await page.evaluate(() => {
		document.documentElement.dataset.navigationProof = "retained";
	});
	const menu = page.getByRole("button", { name: "打开导航", exact: true });
	if (await menu.isVisible()) await menu.click();
	await page.getByRole("button", { name: "动作实验室", exact: true }).click();
	await expect(page).toHaveURL(/\/library$/);
	await page.locator(".library-nav button").nth(1).click();
	await expect(page).toHaveURL(/\/library\/romanian-deadlift$/);
	await page.goBack();
	await expect(page).toHaveURL(/\/library$/);
	await page.goForward();
	await expect(page).toHaveURL(/\/library\/romanian-deadlift$/);
	const crumb = page.getByRole("navigation", { name: "Breadcrumb" });
	await crumb.getByRole("link", { name: "动作实验室", exact: true }).click();
	await expect(page).toHaveURL(/\/library$/);
	await crumb.getByRole("link", { name: "训练日历", exact: true }).click();
	await expect(page).toHaveURL(/\/calendar$/);
	expect(await page.locator("html").getAttribute("data-navigation-proof")).toBe("retained");
	await expect(page.locator(".calendar-caption")).toContainText("本月已完成");
	await expect(
		page.getByRole("heading", { name: "训练日历", exact: true }).last(),
	).toBeInViewport();
	expect(await page.locator(".rhino-island").evaluate((island) => island.scrollTop)).toBe(0);
	if (info.project.name === "desktop") {
		const cell = await page.locator(".calendar-day").first().boundingBox();
		expect(cell?.height).toBeGreaterThanOrEqual(70);
		await expect(page.locator(".calendar-number").first()).toHaveCSS("font-size", "20px");
	}
	await expect(page.locator(".calendar-stats, .calendar-history, .calendar-day-note")).toHaveCount(
		0,
	);
	await page.screenshot({
		path: info.outputPath("calendar-home.png"),
		fullPage: true,
		animations: "disabled",
	});
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("old session deep links reload and cancelled back navigation preserves edits", async ({
	page,
}) => {
	const date = addDays(localDateInTimeZone(new Date(), "Asia/Shanghai"), -500);
	const from = calendarPath(date);
	await page.goto(from);
	const id = uuid();
	const response = await page.request.put(`/api/sessions/${id}`, {
		headers: { Origin: new URL(page.url()).origin },
		data: {
			expectedVersion: 0,
			mutationId: uuid(),
			sourcePlanRevision: null,
			localDate: date,
			timezone: "Asia/Shanghai",
			status: "draft",
			target: sessionTarget(),
			actual: null,
		},
	});
	expect(response.ok()).toBe(true);
	await page.reload();
	const records = await (await page.request.get(`/api/sessions?from=${date}&to=${date}`)).json();
	const index = records.data.sessions.findIndex((session: { id: string }) => session.id === id);
	await page
		.locator(".calendar-record")
		.nth(index)
		.getByRole("button", { name: "修改训练记录", exact: true })
		.click();
	await expect(page).toHaveURL(new RegExp(`/sessions/${id}\\?`));
	await page.reload();
	await expect(page.locator(".workout-topbar")).toContainText(date);
	await page.getByRole("button", { name: "增加每组次数", exact: true }).first().click();
	const reps = await page.locator('output[aria-label="每组次数"]').first().textContent();
	const beforeSkip = page.url();
	const historyLength = await page.evaluate(() => window.history.length);
	await page.getByRole("link", { name: "跳到主要内容", exact: true }).focus();
	await page.keyboard.press("Enter");
	await expect(page.locator("#main-content")).toBeFocused();
	expect(page.url()).toBe(beforeSkip);
	expect(await page.evaluate(() => window.history.length)).toBe(historyLength);
	page.once("dialog", (dialog) => dialog.dismiss());
	await page.evaluate(() => window.history.back());
	await expect(page).toHaveURL(new RegExp(`/sessions/${id}\\?`));
	await expect(page.locator('output[aria-label="每组次数"]').first()).toHaveText(reps ?? "");
	page.once("dialog", (dialog) => dialog.accept());
	await page.getByRole("button", { name: "离开", exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`date=${date}`));
	await expect(page.getByRole("button", { name: new RegExp(`^${date}`) })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await page.goto(sessionPath(uuid(), from));
	await expect(page.getByRole("alert")).toContainText("记录不存在");
	await page.getByRole("button", { name: "返回上一页", exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`date=${date}`));
	await page.goto("/unknown-page");
	await expect(page.getByText("没有这个页面", { exact: true })).toBeVisible();
});
