import { expect, type Page, test } from "@playwright/test";
import type { SessionRecord, SessionTarget } from "../../src/domain/contracts";
import { addDays, localDateInTimeZone } from "../../src/domain/dates";
import { emptyActual } from "../../src/domain/session";
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

async function createDraft(page: Page, target: SessionTarget) {
	const id = uuid();
	const response = await page.request.put(`/api/sessions/${id}`, {
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
	expect(response.ok()).toBe(true);
	await page.reload();
	await openRecord(page, id);
	return id;
}

function expectReadableBackground(background: string) {
	const channels = background.match(/\d+/g)?.slice(0, 3).map(Number);
	if (!channels) throw new Error("Missing workout background");
	const luminance = channels
		.map((channel) => {
			const value = ((channel * 0.92 + 255 * 0.08) * 0.92 + 255 * 0.08) / 255;
			return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
		})
		.reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
	expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(4.5);
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
	const id = await createDraft(page, target);
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
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await page.screenshot({ path: info.outputPath("workout-preparation.png") });
	await page.getByRole("button", { name: "确认并开始", exact: true }).click();
	await expect(page.locator(".current-heading h1")).toHaveText("热身");
	await expect(page.getByRole("button", { name: "结束训练", exact: true })).toBeInViewport();
	await expect(page.getByRole("button", { name: "完成本段并保存", exact: true })).toBeInViewport();
	if (info.project.name === "mobile") await expect(page.locator(".rhino-header")).toBeHidden();
	if (info.project.name === "mobile") {
		const background = await page
			.locator(".workout-live")
			.evaluate((el) => getComputedStyle(el).backgroundColor);
		await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", background);
		expect(await page.locator("html").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
			background,
		);
		await page.addStyleTag({
			content: "[data-basalt-shell] { --basalt-safe-top: 47px; padding-bottom: 34px; }",
		});
		await expect(page.getByRole("button", { name: "结束训练", exact: true })).toBeInViewport();
		await expect(
			page.getByRole("button", { name: "完成本段并保存", exact: true }),
		).toBeInViewport();
		const portrait = page.viewportSize();
		await page.setViewportSize({ width: 844, height: 390 });
		await page.addStyleTag({
			content: "[data-basalt-shell] { padding-inline: 47px; }",
		});
		await expect(page.locator("html")).toHaveCSS("background-color", background);
		await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", background);
		await expect(page.locator("[data-basalt-shell]")).toHaveCSS(
			"background-color",
			"rgba(0, 0, 0, 0)",
		);
		await expect(page.locator(".rhino-header")).toBeHidden();
		await expect(page.locator(".rhino-app > .rhino-sidebar")).toBeHidden();
		expect(
			await page.locator(".workout-content").evaluate((el) => el.clientHeight),
		).toBeGreaterThan(80);
		await page.locator(".workout-clock").scrollIntoViewIfNeeded();
		await expect(page.locator(".workout-clock")).toBeInViewport();
		await page.screenshot({ path: info.outputPath("workout-landscape-safe-area.png") });
		await page.addStyleTag({ content: "[data-basalt-shell] { padding-inline: 0; }" });
		if (portrait) await page.setViewportSize(portrait);
	}

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
	await expect(
		page.getByText("查看与调整记录期间，总用时继续累计。", { exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "继续训练", exact: true }).click();
	await page.getByRole("button", { name: "结束训练", exact: true }).click();
	const ending = page.getByRole("dialog", { name: "结束这场训练？", exact: true });
	await expect(ending).toBeVisible();
	await ending.evaluate(async (dialog) => {
		await Promise.all(dialog.getAnimations().map((animation) => animation.finished));
	});
	const endingGeometry = await ending.evaluate((dialog) => {
		const notes = dialog.querySelector("input")?.getBoundingClientRect();
		const fields = dialog.querySelectorAll(".field");
		const pain = fields[1].getBoundingClientRect();
		const actions = dialog.lastElementChild?.getBoundingClientRect();
		return {
			padding: Number.parseFloat(getComputedStyle(dialog).paddingTop),
			fieldGap: pain.top - (notes?.bottom ?? 0),
			actionGap: (actions?.top ?? 0) - pain.bottom,
			overflow: dialog.scrollWidth > dialog.clientWidth,
		};
	});
	expect(endingGeometry.padding).toBeGreaterThanOrEqual(16);
	expect(endingGeometry.fieldGap).toBeGreaterThanOrEqual(16);
	expect(endingGeometry.actionGap).toBeGreaterThanOrEqual(16);
	expect(endingGeometry.overflow).toBe(false);
	await ending
		.getByRole("textbox", { name: "训练备注", exact: true })
		.fill("Rest felt comfortable");
	await ending.getByRole("combobox", { name: "有疼痛或明显不适吗？", exact: true }).click();
	await page.getByRole("option", { name: "有，停止并复盘", exact: true }).click();
	await expect(page.getByRole("listbox")).toHaveCount(0);
	await page.screenshot({ path: info.outputPath("workout-ending.png") });
	await page.getByRole("button", { name: "确认结束并保存", exact: true }).click();
	await expect(page.getByText("训练已记录。下一次，继续。", { exact: true })).toBeVisible();
	const ended = (await (await page.request.get(`/api/sessions/${id}`)).json()).data
		.session as SessionRecord;
	expect(ended.status).toBe("completed");
	expect(ended.actual?.timing?.endedAt).not.toBeNull();
	expect(ended.actual?.notes).toBe("Rest felt comfortable");
	expect(ended.actual?.painFlag).toBe(true);
	expect(ended.actual?.exercises[0].sets[1].status).toBe("not-recorded");
	expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("green rest expires without starting the next set or changing records", async ({ page }) => {
	await page.clock.install();
	await page.goto("/");
	await page.locator(".page-body").waitFor();
	const target = sessionTarget();
	target.blocks = [target.blocks[0]];
	const exercise = target.blocks[0].exercises[0];
	exercise.workingSets.push({ ...exercise.workingSets[0], id: uuid(), setIndex: 2 });
	const id = await createDraft(page, target);
	await page.getByRole("button", { name: "确认并开始", exact: true }).click();
	await page.getByRole("button", { name: "完成本组并保存", exact: true }).click();
	await expect(page.locator(".workout-live")).toHaveAttribute("data-workout-tone", "rest");
	await expect(page.locator(".current-heading")).toContainText("第 2 / 2 组");
	const background = await page
		.locator(".workout-live")
		.evaluate((element) => getComputedStyle(element).backgroundColor);
	const rgb = background.match(/\d+/g)?.map(Number);
	if (!rgb) throw new Error("Missing rest color");
	expect(rgb[1]).toBeGreaterThan(rgb[0]);
	expect(rgb[1]).toBeGreaterThan(rgb[2]);
	await page.clock.fastForward(91_000);
	await expect(page.locator(".workout-live")).toHaveAttribute("data-workout-tone", "strength");
	await expect(page.getByTestId("step-timer")).toHaveText("00:00");
	await expect(page.getByRole("button", { name: "开始下一组 / 段", exact: true })).toBeVisible();
	const saved = (await (await page.request.get(`/api/sessions/${id}`)).json()).data
		.session as SessionRecord;
	expect(saved.actual?.timing?.steps).toHaveLength(1);
	expect(saved.actual?.exercises[0].sets[1].status).toBe("not-recorded");
	await page.getByRole("button", { name: "开始下一组 / 段", exact: true }).click();
	await page.getByRole("button", { name: "完成本组并保存", exact: true }).click();
	await expect(page.locator(".workout-live")).not.toHaveAttribute("data-workout-tone", "rest");
	await page.getByRole("button", { name: "结束训练", exact: true }).first().click();
	await page.getByRole("button", { name: "确认结束并保存", exact: true }).click();
	await expect(page.getByText("训练已记录。下一次，继续。", { exact: true })).toBeVisible();
});

test("untimed active overview does not claim a running clock", async ({ page }) => {
	await page.goto("/");
	await page.locator(".page-body").waitFor();
	const target = sessionTarget();
	const id = await createDraft(page, target);
	const response = await page.request.put(`/api/sessions/${id}`, {
		headers: { Origin: new URL(page.url()).origin },
		data: {
			expectedVersion: 1,
			mutationId: uuid(),
			sourcePlanRevision: null,
			localDate: localDateInTimeZone(new Date(), "Asia/Shanghai"),
			timezone: "Asia/Shanghai",
			status: "active",
			target,
			actual: emptyActual(target),
		},
	});
	expect(response.ok()).toBe(true);
	await page.reload();
	await openRecord(page, id);
	await expect(page.locator(".workout-plan-heading")).toContainText("补记实际训练");
	await expect(page.getByTestId("total-timer")).toHaveCount(0);
	const saved = (await (await page.request.get(`/api/sessions/${id}`)).json()).data
		.session as SessionRecord;
	expect(saved.actual?.timing).toBeUndefined();
	await page.getByRole("button", { name: "结束训练", exact: true }).click();
	await page.getByRole("button", { name: "确认结束并保存", exact: true }).click();
	await expect(page.getByText("训练已记录。下一次，继续。", { exact: true })).toBeVisible();
});

for (const theme of ["light", "dark"]) {
	test(`workout palette is readable and centered in ${theme} with short-screen scrolling`, async ({
		page,
	}, info) => {
		if (info.project.name === "desktop") await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto("/");
		await page.locator(".page-body").waitFor();
		const target = sessionTarget();
		Object.assign(target.blocks[0].exercises[0], {
			exerciseId: "dumbbell-curl",
			name: "Dumbbell curl",
			loadConvention: "per-hand",
		});
		target.blocks[0].exercises[0].workingSets[0].loadKg = 12.345;
		const cardio = target.blocks[1].cardio;
		if (!cardio) throw new Error("Missing cardio fixture");
		target.blocks = [
			{
				kind: "preparation",
				durationMinutes: 1,
				exercises: [],
				cardio: { ...cardio, id: uuid(), role: "preparation", plannedMinutes: 1 },
			},
			...target.blocks,
			{
				kind: "recovery",
				durationMinutes: 1,
				exercises: [],
				cardio: { ...cardio, id: uuid(), role: "recovery", plannedMinutes: 1 },
			},
		];
		await createDraft(page, target);
		if (theme === "dark") await page.getByRole("button", { name: "切换主题", exact: true }).click();
		const viewport = page.viewportSize();
		if (!viewport) throw new Error("Missing viewport");
		for (const width of info.project.name === "mobile"
			? [320, 375, viewport.width]
			: [viewport.width]) {
			await page.setViewportSize({ ...viewport, width });
			const heading = page.locator(".exercise-plan-heading").first();
			const alignment = await heading.evaluate((row) => {
				const boxes = ["img", "[role=combobox]", ".plan-preview-button"].map((selector) =>
					row.querySelector(selector)?.getBoundingClientRect(),
				);
				return boxes.map((box) => (box ? box.y + box.height / 2 : -1));
			});
			expect(Math.max(...alignment) - Math.min(...alignment)).toBeLessThan(1);
			const steppers = await page
				.locator(".session-plan .stepper-control")
				.evaluateAll((controls) =>
					controls.map((control) => {
						const [left, right] = [...control.querySelectorAll("button")].map((button) =>
							button.getBoundingClientRect(),
						);
						const output = control.querySelector("output")?.getBoundingClientRect();
						return {
							horizontal:
								Math.abs(left.y - right.y) < 1 &&
								left.right <= (output?.left ?? 0) &&
								(output?.right ?? Infinity) <= right.left,
							targets: [left.width, left.height, right.width, right.height],
							fits: control.scrollWidth <= control.clientWidth,
						};
					}),
				);
			for (const stepper of steppers) {
				expect(stepper.horizontal).toBe(true);
				expect(stepper.fits).toBe(true);
				expect(Math.min(...stepper.targets)).toBeGreaterThanOrEqual(44);
			}
		}
		await expect(page.getByRole("button", { name: "离开", exact: true })).toBeInViewport();
		await page.screenshot({ path: info.outputPath(`preparation-${theme}.png`) });
		await page.getByRole("button", { name: "确认并开始", exact: true }).click();
		const colors = new Set<string>();
		for (const tone of ["preparation", "strength", "main", "recovery"]) {
			if (tone === "main") {
				await expect(page.locator(".workout-live")).toHaveAttribute("data-workout-tone", "rest");
				await expect(page.locator(".current-heading h1")).toHaveText("组间休息");
				await expect(page.locator(".current-heading p")).toContainText("主要有氧");
				expectReadableBackground(
					await page
						.locator(".workout-live")
						.evaluate((element) => getComputedStyle(element).backgroundColor),
				);
				await page.screenshot({ path: info.outputPath(`workout-${theme}-rest.png`) });
				await page.getByRole("button", { name: "开始下一组 / 段", exact: true }).click();
			}
			await expect(page.locator(".workout-live")).toHaveAttribute("data-workout-tone", tone);
			await expect(page.getByTestId("step-timer")).toHaveCSS("color", "rgb(255, 255, 255)");
			const geometry = await page.locator(".workout-stage").evaluate((stage) => {
				const content = document.querySelector(".workout-content") as HTMLElement;
				const clock = stage.querySelector(".workout-clock") as HTMLElement;
				const text = clock.querySelector("div") as HTMLElement;
				const rect = stage.getBoundingClientRect(),
					frame = content.getBoundingClientRect();
				return {
					overflow: content.scrollHeight > content.clientHeight + 1,
					centerOffset: Math.abs((rect.top + rect.bottom - frame.top - frame.bottom) / 2),
					clockOffset: Math.abs(
						text.getBoundingClientRect().height - clock.getBoundingClientRect().height,
					),
					background: getComputedStyle(stage.closest(".workout-live") as HTMLElement)
						.backgroundColor,
					texture: getComputedStyle(stage.closest(".workout-live") as HTMLElement).backgroundImage,
				};
			});
			expect(geometry.overflow).toBe(false);
			expect(geometry.centerOffset).toBeLessThan(2);
			expect(geometry.clockOffset).toBeLessThan(2);
			colors.add(geometry.background);
			expectReadableBackground(geometry.background);
			expect(geometry.texture).toContain("repeating-radial-gradient");
			await page.screenshot({ path: info.outputPath(`workout-${theme}-${tone}.png`) });
			if (tone === "recovery") break;
			if (tone === "preparation") {
				await expect(page.getByTestId("step-timer")).not.toHaveText("00:00");
				await page.getByRole("button", { name: "完成本段并保存", exact: true }).click();
			} else if (tone === "strength") {
				await page.getByRole("button", { name: "开始下一组 / 段", exact: true }).click();
				await page.getByRole("button", { name: "完成本组并保存", exact: true }).click();
			} else {
				page.once("dialog", (dialog) => dialog.accept());
				await page.getByRole("button", { name: "跳过本组 / 段", exact: false }).click();
			}
		}
		expect(colors.size).toBe(4);
		await page.setViewportSize({ width: 375, height: 420 });
		await expect(page.getByRole("button", { name: "结束训练", exact: true })).toBeInViewport();
		await expect(
			page.getByRole("button", { name: "开始下一组 / 段", exact: true }),
		).toBeInViewport();
		const content = page.locator(".workout-content");
		expect(await content.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
			true,
		);
		await page.getByRole("combobox", { name: "实际强度", exact: true }).scrollIntoViewIfNeeded();
		await expect(page.getByRole("combobox", { name: "实际强度", exact: true })).toBeInViewport();
		expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
			false,
		);
		await page.getByRole("button", { name: "计划 / 记录", exact: true }).click();
		await expect(
			page.getByText("查看与调整记录期间，总用时继续累计。", { exact: true }),
		).toBeVisible();
		const minutes = page.locator('.session-plan output[aria-label="实际分钟"]').first();
		await expect(minutes.locator("strong")).toHaveText(/^0\.\d+$/);
		const load = page.locator('.recorded-set output[aria-label="第1组负重"]');
		await expect(load.locator("strong")).toHaveText("12.345");
		await expect(load.locator("span")).toHaveText("kg/只");
		await load.scrollIntoViewIfNeeded();
		await expect(load.locator("span")).toBeVisible();
		const fits = await page
			.locator(".session-plan .stepper-control output")
			.evaluateAll((outputs) =>
				outputs.every((output) => {
					const text = output.querySelector("strong")?.getBoundingClientRect();
					const box = output.getBoundingClientRect();
					return text && text.left >= box.left - 1 && text.right <= box.right + 1;
				}),
			);
		expect(fits).toBe(true);
		await page.getByRole("button", { name: "继续训练", exact: true }).click();
		await page.getByRole("button", { name: "结束训练", exact: true }).click();
		await page.getByRole("button", { name: "确认结束并保存", exact: true }).click();
		await expect(page.getByText("训练已记录。下一次，继续。", { exact: true })).toBeVisible();
	});
}
