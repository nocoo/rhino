import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"]) {
	test(`sidebar geometry and drawer keyboard contract in ${theme} theme`, async ({
		page,
	}, info) => {
		await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme as "light" | "dark" });
		await page.route("**/api/identity", (route) =>
			route.fulfill({
				json: {
					data: {
						name: "测试用户",
						email: "owner@example.test",
						avatar: "https://lizheng.blog/rhino-sidebar-fixture.svg",
					},
				},
			}),
		);
		await page.route("https://lizheng.blog/rhino-sidebar-fixture.svg", (route) =>
			route.fulfill({
				contentType: "image/svg+xml",
				body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="18"/></svg>',
			}),
		);
		await page.goto("/today");
		await page.locator(".page-body").waitFor();
		if (theme === "dark") {
			await page.getByRole("button", { name: "切换主题", exact: true }).click();
		}
		await expect(page.locator("html")).toHaveAttribute("data-mode", theme);
		const rail = page.getByRole("complementary", { name: "主导航侧栏" });
		const avatar = rail.getByRole("img", { name: "测试用户", exact: true });
		await expect(avatar).toBeVisible();
		const expanded = await avatar.boundingBox();
		await expect(avatar).toHaveCSS("width", "36px");
		await expect(avatar).toHaveCSS("height", "36px");
		await expect(rail.getByText("owner@example.test", { exact: true })).toHaveCSS(
			"line-height",
			"16px",
		);
		await expect(rail).toHaveCSS("width", "240px");
		await page.getByRole("button", { name: "收起侧栏", exact: true }).click();
		await page.mouse.move(1000, 500);
		await expect(rail).toHaveCSS("width", "68px");
		await expect(avatar).toHaveCSS("width", "36px");
		await expect(avatar).toHaveCSS("height", "36px");
		const collapsed = await avatar.boundingBox();
		await info.attach("avatar-geometry", {
			body: JSON.stringify({ expanded, collapsed }),
			contentType: "application/json",
		});
		expect(collapsed?.y).toBe(expanded?.y);
		await expect.soft(rail.locator('[data-slot="sidebar-brand-name"]')).toBeHidden();
		await expect
			.soft(rail.locator('[data-slot="sidebar-brand-copy"] [data-slot="badge"]'))
			.toBeHidden();
		await expect(rail.getByText("owner@example.test", { exact: true })).toHaveCount(0);
		await page.getByRole("button", { name: "展开侧栏", exact: true }).click();
		await expect(rail).toHaveCSS("width", "240px");
		await expect(rail.locator('[data-slot="sidebar-brand-name"]')).toBeVisible();
		if (theme === "light") {
			await page.setViewportSize({ width: 390, height: 844 });
			const menu = page.getByRole("button", { name: "打开导航", exact: true });
			await menu.click();
			const drawer = page.locator('[data-slot="sidebar-drawer"]');
			await expect(drawer).toBeVisible();
			await expect.soft(drawer).toHaveCSS("width", "240px");
			await expect(drawer.locator("[data-basalt-sidebar]")).toHaveCSS("width", "240px");
			await expect.soft(drawer).toHaveCSS("padding-left", "0px");
			await expect.soft(drawer).toHaveCSS("padding-right", "0px");
			await page.keyboard.press("Escape");
			await expect(drawer).toHaveCount(0);
			await expect(menu).toBeFocused();
		}
	});
}
