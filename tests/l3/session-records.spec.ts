import { expect, test } from "@playwright/test";
import type { SessionRecord } from "../../src/domain/contracts";
import { addDays, localDateInTimeZone } from "../../src/domain/dates";
import { calendarPath } from "../../src/domain/routes";
import { emptyActual } from "../../src/domain/session";
import { actualFromTarget, sessionTarget, uuid } from "../helpers/fixtures";
import { assertMarker, type TestRun } from "../helpers/isolation";

test.beforeEach(async () => {
	const state = process.env.RHINO_TEST_STATE,
		id = process.env.RHINO_TEST_RUN_ID,
		config = process.env.RHINO_TEST_CONFIG;
	if (!state || !id || !config) throw new Error("L3 requires the isolated runner");
	await assertMarker({ state, id, config, env: process.env } satisfies TestRun);
});

test("date records are compact, open read-only, edit and delete safely", async ({ page }, info) => {
	await page.goto("/");
	const date = addDays(localDateInTimeZone(new Date(), "Asia/Shanghai"), -60);
	const headers = { Origin: new URL(page.url()).origin };
	const target = sessionTarget();
	const ids = [uuid(), uuid(), uuid()];
	const write = async (
		id: string,
		status: SessionRecord["status"],
		expectedVersion: number,
		actual: SessionRecord["actual"],
	) => {
		const response = await page.request.put(`/api/sessions/${id}`, {
			headers,
			data: {
				expectedVersion,
				mutationId: uuid(),
				sourcePlanRevision: null,
				localDate: date,
				timezone: "Asia/Shanghai",
				status,
				target,
				actual,
			},
		});
		expect(response.ok()).toBe(true);
	};
	await write(ids[0], "active", 0, actualFromTarget(target));
	await write(ids[0], "completed", 1, actualFromTarget(target));
	await write(ids[1], "draft", 0, null);
	await write(ids[2], "active", 0, {
		...emptyActual(target),
		timing: { startedAt: new Date().toISOString(), endedAt: null, steps: [] },
	});
	await page.goto(calendarPath(date));
	const row = (id: string) => page.locator(`.calendar-record[data-session-id="${id}"]`);
	await expect(row(ids[0])).toBeVisible();
	for (const id of ids) {
		await row(id).scrollIntoViewIfNeeded();
		await expect(row(id).getByRole("button")).toHaveCount(3);
		for (const name of ["打开训练记录", "修改训练记录", "删除训练记录"]) {
			const button = row(id).getByRole("button", { name, exact: true });
			await expect(button).toBeVisible();
			const bounds = await button.boundingBox();
			expect(bounds?.width).toBeGreaterThanOrEqual(44);
			expect(bounds?.height).toBeGreaterThanOrEqual(44);
		}
		expect((await row(id).boundingBox())?.height).toBeLessThanOrEqual(96);
	}
	await expect(row(ids[0]).locator(".session-record-title > span").first()).toHaveCSS(
		"font-size",
		"14px",
	);
	await expect(row(ids[0]).locator(".session-record-title > span").first()).toHaveCSS(
		"font-weight",
		"500",
	);
	await page.locator(".session-record-list").scrollIntoViewIfNeeded();
	await page.screenshot({
		path: info.outputPath("date-records-light.png"),
		animations: "disabled",
	});
	await page.getByRole("button", { name: "切换主题", exact: true }).click();
	await page.screenshot({ path: info.outputPath("date-records-dark.png"), animations: "disabled" });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

	await row(ids[0]).getByRole("button", { name: "打开训练记录", exact: true }).click();
	await expect(page).toHaveURL(/mode=view/);
	await expect(page.getByRole("table", { name: "实际训练明细", exact: true })).toContainText("次");
	await expect(page.getByRole("button", { name: "保存调整", exact: true })).toHaveCount(0);
	await page.reload();
	await expect(page.locator(".session-review")).toBeVisible();
	await page.getByRole("button", { name: "修改记录", exact: true }).click();
	await expect(page).toHaveURL(/mode=edit/);
	await page.getByRole("button", { name: "增加第1组次数", exact: true }).first().click();
	await page.getByRole("button", { name: "保存调整", exact: true }).click();
	await expect(page.locator(".workout-save-state")).toContainText("已保存");
	await page.getByRole("button", { name: "返回上一页", exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`date=${date}`));
	await row(ids[2]).getByRole("button", { name: "修改训练记录", exact: true }).click();
	await expect(page.locator(".workout-plan-heading")).toContainText("本场计划与记录");
	await page.getByRole("button", { name: "离开", exact: true }).click();

	await row(ids[1]).getByRole("button", { name: "删除训练记录", exact: true }).click();
	const dialog = page.getByRole("alertdialog");
	await expect(dialog.getByRole("button", { name: "取消", exact: true })).toBeFocused();
	await dialog.getByRole("button", { name: "取消", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	await expect(
		row(ids[1]).getByRole("button", { name: "删除训练记录", exact: true }),
	).toBeFocused();
	expect((await page.request.get(`/api/sessions/${ids[1]}`)).ok()).toBe(true);
	await write(ids[1], "draft", 1, null);
	await row(ids[1]).getByRole("button", { name: "删除训练记录", exact: true }).click();
	await dialog.getByRole("button", { name: "确认删除", exact: true }).click();
	await expect(dialog.getByRole("alert")).toContainText("其他页面更新");
	expect((await page.request.get(`/api/sessions/${ids[1]}`)).ok()).toBe(true);
	await dialog.getByRole("button", { name: "重新加载记录", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	await expect(row(ids[1])).toBeVisible();
	await row(ids[1]).getByRole("button", { name: "删除训练记录", exact: true }).click();
	await expect(dialog.getByRole("alert")).toHaveCount(0);
	await dialog.getByRole("button", { name: "确认删除", exact: true }).click();
	await expect(row(ids[1])).toHaveCount(0);
	expect((await page.request.get(`/api/sessions/${ids[1]}`)).status()).toBe(404);

	let lost = false;
	await page.route(`**/api/sessions/${ids[0]}`, async (route) => {
		if (route.request().method() === "DELETE" && !lost) {
			lost = true;
			await route.fetch();
			await route.fulfill({
				status: 503,
				contentType: "application/json",
				body: JSON.stringify({ error: { code: "internal_error" } }),
			});
		} else await route.continue();
	});
	await row(ids[0]).getByRole("button", { name: "删除训练记录", exact: true }).click();
	await dialog.getByRole("button", { name: "确认删除", exact: true }).click();
	await expect(dialog.getByRole("alert")).toContainText("服务暂时不可用");
	await expect(row(ids[0])).toHaveCount(1);
	await dialog.getByRole("button", { name: "确认删除", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	await expect(row(ids[0])).toHaveCount(0);
	await expect(row(ids[2])).toBeVisible();
	const progress = await (await page.request.get(`/api/progress?from=${date}&to=${date}`)).json();
	expect(progress.data.sessions.some((item: { id: string }) => item.id === ids[0])).toBe(false);
	await page.reload();
	await expect(row(ids[0])).toHaveCount(0);
	await expect(row(ids[1])).toHaveCount(0);
	await expect(row(ids[2])).toBeVisible();
});
