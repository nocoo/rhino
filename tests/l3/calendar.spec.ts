import { expect, type Page, test } from "@playwright/test";
import { addDays, localDateInTimeZone, weekdayOf } from "../../src/domain/dates";
import { planInput, sessionTarget, uuid } from "../helpers/fixtures";
import { assertMarker, type TestRun } from "../helpers/isolation";

test.beforeEach(async () => {
	const state = process.env.RHINO_TEST_STATE,
		id = process.env.RHINO_TEST_RUN_ID,
		config = process.env.RHINO_TEST_CONFIG;
	if (!state || !id || !config) throw new Error("L3 requires the isolated runner");
	await assertMarker({ state, id, config, env: process.env } satisfies TestRun);
});
async function openCalendar(page: Page) {
	const menu = page.getByRole("button", { name: "打开导航", exact: true });
	if (await menu.isVisible()) await menu.click();
	await page.getByRole("button", { name: "训练日历", exact: true }).click();
	await expect(page.getByRole("region", { name: "训练月历" })).toBeVisible();
}
test("calendar reads older months and preserves selection after record review", async ({
	page,
}, info) => {
	await page.goto("/");
	const today = localDateInTimeZone(new Date(), "Asia/Shanghai");
	const date = addDays(today, -450);
	const response = await page.request.put(`/api/sessions/${uuid()}`, {
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
	await openCalendar(page);
	await page.getByLabel("日历月份", { exact: true }).fill(date.slice(0, 7));
	await page.getByRole("button", { name: new RegExp(`^${date}`) }).click();
	await page.getByRole("button", { name: "继续记录", exact: true }).first().click();
	await expect(page.locator(".workout-topbar")).toContainText(date);
	await page.getByRole("button", { name: "离开", exact: true }).click();
	await expect(page.getByRole("button", { name: new RegExp(`^${date}`) })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await page.getByRole("button", { name: "下个月", exact: true }).click();
	await page.getByRole("button", { name: "上个月", exact: true }).click();
	await page.screenshot({ path: info.outputPath("calendar-history.png") });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	const minWidth = await page
		.locator(".calendar-day")
		.first()
		.evaluate((el) => el.getBoundingClientRect().width);
	expect(minWidth).toBeGreaterThanOrEqual(40);
});
test("calendar manually records actuals without inventing a timer or performed sets", async ({
	page,
}, info) => {
	await page.goto("/");
	const today = localDateInTimeZone(new Date(), "Asia/Shanghai");
	const { data } = await (await page.request.get("/api/plans")).json();
	const input = {
		...planInput(),
		reviewMonth: today.slice(0, 7),
		weeklyFrequency: 1,
		preferredWeekdays: [weekdayOf(today)],
	};
	const plan = await page.request.put(`/api/plans/${uuid()}`, {
		headers: { Origin: new URL(page.url()).origin },
		data: { expectedRevision: data.current?.revision ?? 0, input },
	});
	expect(plan.ok()).toBe(true);
	await page.reload();
	await openCalendar(page);
	await expect(page.getByRole("button", { name: "补记实际训练", exact: true })).toBeEnabled();
	await page.screenshot({ path: info.outputPath("calendar-today.png") });
	await page.getByRole("button", { name: "补记实际训练", exact: true }).click();
	await expect(page.locator(".workout-plan-heading")).toContainText("补记实际训练");
	await expect(page.getByTestId("total-timer")).toHaveCount(0);
	await page.getByRole("button", { name: "增加第1组次数", exact: true }).first().click();
	await page.getByRole("button", { name: "结束并保存", exact: true }).click();
	await page.getByRole("button", { name: "确认结束并保存", exact: true }).click();
	await expect(page.locator(".workout-topbar")).toContainText("训练回顾");
	await page.getByRole("button", { name: "返回上一页", exact: true }).click();
	await expect(
		page.getByRole("button", { name: "查看训练结果", exact: true }).first(),
	).toBeVisible();
	const result = await (await page.request.get(`/api/sessions?from=${today}&to=${today}`)).json();
	const manual =
		result.data.sessions.find(
			(session: { sourcePlanRevision: number; status: string }) =>
				session.sourcePlanRevision === data.current?.revision + 1 && session.status === "completed",
		) ??
		result.data.sessions.find(
			(session: { actual?: { timing?: unknown }; status: string }) =>
				session.status === "completed" && !session.actual?.timing,
		);
	expect(manual.actual.timing).toBeUndefined();
	expect(
		manual.actual.exercises
			.flatMap((exercise: { sets: { status: string }[] }) => exercise.sets)
			.filter((set: { status: string }) => set.status === "performed"),
	).toHaveLength(1);
});
