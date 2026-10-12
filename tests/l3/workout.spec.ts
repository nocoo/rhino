import { expect, type Page, test } from "@playwright/test";
import type { SessionRecord } from "../../src/domain/contracts";
import { addDays, localDateInTimeZone } from "../../src/domain/dates";
import { sessionTarget, uuid } from "../helpers/fixtures";
import { assertMarker, type TestRun } from "../helpers/isolation";

test.beforeEach(async () => {
	const state = process.env.RHINO_TEST_STATE,
		id = process.env.RHINO_TEST_RUN_ID,
		config = process.env.RHINO_TEST_CONFIG;
	if (!state || !id || !config) throw new Error("L3 requires the isolated runner");
	await assertMarker({ state, id, config, env: process.env } satisfies TestRun);
});

async function openRecord(page: Page, id: string) {
	const menu = page.getByRole("button", { name: "打开导航", exact: true });
	if (await menu.isVisible()) await menu.click();
	await page.getByRole("button", { name: "我的进展", exact: true }).click();
	const date = localDateInTimeZone(new Date(), "Asia/Shanghai");
	const response = await page.request.get(`/api/sessions?from=${addDays(date, -365)}&to=${date}`);
	const { data } = await response.json();
	const index = data.sessions.findIndex((item: SessionRecord) => item.id === id);
	await page.getByRole("button", { name: "查看记录", exact: true }).nth(index).click();
}

test("immersive timeline persists every step, survives lost responses and ends visibly", async ({
	page,
}, info) => {
	await page.goto("/");
	await page.locator(".page-body").waitFor();
	const target = sessionTarget();
	const strength = target.blocks[0];
	const exercise = strength.exercises[0];
	exercise.warmUpSetCount = 0;
	exercise.workingSets[0].loadKg = null;
	exercise.workingSets.push({ ...exercise.workingSets[0], id: uuid(), setIndex: 2 });
	const cardio = target.blocks[1].cardio;
	if (!cardio) throw new Error("Missing cardio fixture");
	target.blocks = [
		{
			kind: "preparation",
			durationMinutes: 1,
			exercises: [],
			cardio: {
				...cardio,
				id: uuid(),
				role: "preparation",
				plannedMinutes: 1,
				plannedIntensity: "easy",
			},
		},
		strength,
		target.blocks[1],
	];
	const id = uuid();
	const result = await page.request.put(`/api/sessions/${id}`, {
		headers: { Origin: new URL(page.url()).origin },
		data: {
			expectedVersion: 0,
			mutationId: uuid(),
			sourcePlanRevision: null,
			localDate: localDateInTimeZone(new Date(), "Asia/Shanghai"),
			timezone: "Asia/Shanghai",
			status: "draft",
			target,
			actual: null,
		},
	});
	expect(result.ok()).toBe(true);
	await page.reload();
	await openRecord(page, id);
	if (info.project.name === "mobile") {
		await page.getByRole("button", { name: "切换主题", exact: true }).click();
		await expect(page.locator("html")).toHaveClass(/dark/);
	}

	await expect(page.locator(".timeline-label").first()).toContainText("热身");
	await page.getByRole("button", { name: "增加每组次数", exact: true }).click();
	await page.getByRole("button", { name: "动作预览", exact: true }).click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await expect(page.getByRole("button", { name: "回到训练", exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await page.screenshot({ path: info.outputPath("workout-preparation.png") });
	await page.getByRole("button", { name: "确认并开始", exact: true }).click();
	await expect(page.locator(".current-heading h1")).toHaveText("热身");
	await expect(page.getByRole("button", { name: "结束训练", exact: true })).toBeInViewport();
	await expect(page.getByRole("button", { name: "完成本段并保存", exact: true })).toBeInViewport();
	if (info.project.name === "mobile") await expect(page.locator(".rhino-header")).toBeHidden();
	await expect.poll(() => page.getByTestId("total-timer").textContent()).not.toBe("00:00");
	await page.getByRole("button", { name: "完成本段并保存", exact: true }).click();
	await expect(page.locator(".current-heading h1")).toHaveText("高脚杯深蹲");
	await page.getByRole("button", { name: "开始下一组 / 段", exact: true }).click();
	await page.getByRole("button", { name: "选用 15 kg", exact: true }).click();
	await page.getByRole("button", { name: "增加本组负重", exact: true }).click();
	await expect(page.locator(".current-heading h1")).toBeInViewport();
	await expect(page.getByTestId("total-timer")).toBeInViewport();
	await expect(page.getByRole("button", { name: "完成本组并保存", exact: true })).toBeInViewport();
	await page.screenshot({ path: info.outputPath("workout-active.png") });
	if (info.project.name === "mobile") {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.getByRole("button", { name: "增加本组负重", exact: true }).click();
		await page.getByRole("button", { name: "减少本组负重", exact: true }).click();
		await expect(page.locator(".current-heading h1")).toBeInViewport();
		await expect(page.getByTestId("total-timer")).toBeInViewport();
		await expect(
			page.getByRole("button", { name: "完成本组并保存", exact: true }),
		).toBeInViewport();
		await page.screenshot({ path: info.outputPath("workout-small-phone.png") });
	}
	await page.getByRole("button", { name: "回顾动作要领", exact: true }).click();
	const before = await page.getByTestId("total-timer").textContent();
	await expect.poll(() => page.getByTestId("total-timer").textContent()).not.toBe(before);
	await page.keyboard.press("Escape");
	await expect(page.getByRole("button", { name: "回顾动作要领", exact: true })).toBeFocused();
	const requests: string[] = [];
	await page.route(`**/api/sessions/${id}`, async (route) => {
		if (route.request().method() !== "PUT") return route.continue();
		requests.push(route.request().postData() ?? "");
		if (requests.length === 1) {
			await route.fetch();
			await route.abort("failed");
		} else await route.continue();
	});
	await page.getByRole("button", { name: "完成本组并保存", exact: true }).click();
	await expect(page.getByRole("alert")).toBeVisible();
	await expect(page.locator(".current-heading")).toContainText("第 1 / 2 组");
	await page.getByRole("button", { name: "完成本组并保存", exact: true }).click();
	await expect(page.locator(".current-heading")).toContainText("第 2 / 2 组");
	expect(requests[0]).toBe(requests[1]);
	await page.unroute(`**/api/sessions/${id}`);
	const saved = (await (await page.request.get(`/api/sessions/${id}`)).json()).data
		.session as SessionRecord;
	expect(saved.actual?.exercises[0].sets[0]).toMatchObject({
		status: "performed",
		reps: 13,
		loadKg: 20,
	});
	expect(saved.actual?.cardioSegments[0].actualMinutes).toBeGreaterThan(0);
	expect(saved.actual?.timing?.steps).toHaveLength(2);
	await page.reload();
	await openRecord(page, id);
	await expect(page.locator(".current-heading")).toContainText("第 2 / 2 组");
	await expect(page.getByTestId("total-timer")).not.toHaveText("00:00");
	await page.getByRole("button", { name: "计划 / 记录", exact: true }).click();
	await expect(page.getByText("本场目标已锁定", { exact: false })).toBeVisible();
	await page.getByRole("button", { name: "继续训练", exact: true }).click();
	await page.getByRole("button", { name: "结束训练", exact: true }).click();
	await page.getByRole("button", { name: "确认结束并保存", exact: true }).click();
	await expect(page.getByText("训练已记录。下一次，继续。", { exact: true })).toBeVisible();
	const ended = (await (await page.request.get(`/api/sessions/${id}`)).json()).data
		.session as SessionRecord;
	expect(ended.status).toBe("completed");
	expect(ended.actual?.timing?.endedAt).not.toBeNull();
	expect(ended.actual?.exercises[0].sets[1].status).toBe("not-recorded");
	expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
