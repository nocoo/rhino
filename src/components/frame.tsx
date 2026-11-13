import { ContentIsland, SidebarDrawer } from "@nocoo/basalt";
import { AppHeader, AppHeaderMenuButton, ProjectLinks } from "@nocoo/basalt/components/app-header";
import { AppMain, AppShell, AppSkipLink } from "@nocoo/basalt/components/app-shell";
import { ThemeToggle } from "@nocoo/basalt/components/theme-toggle";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { type Page, pageLabels } from "../domain/routes";
import { useBrowserChrome } from "../hooks/use-browser-chrome";
import { useIsMobile } from "../hooks/use-mobile";
import { EnvironmentSwitch } from "./environment-switch";
import { MobileNavProvider, useMobileNav } from "./layout/mobile-nav-context";
import { ACCESS_LOGOUT_URL, PersistedSidebarProvider, Sidebar } from "./layout/sidebar";

export type { Page } from "../domain/routes";

function FrameInner({
	page,
	navigate,
	children,
	identity,
	immersive = false,
	title,
	breadcrumbs,
	contentKey,
}: {
	page: Page;
	navigate: (page: Page) => void;
	children: ReactNode;
	identity?: { email: string | null; name: string | null; avatar: string | null };
	immersive?: boolean;
	title?: string;
	breadcrumbs?: { href?: string; label: string }[];
	contentKey: string;
}) {
	useBrowserChrome();
	const isMobile = useIsMobile();
	const { mobileOpen, setMobileOpen } = useMobileNav();
	const menuButton = useRef<HTMLButtonElement>(null);
	const drawerId = useId();

	// biome-ignore lint/correctness/useExhaustiveDependencies: close the drawer when route content changes
	useEffect(() => {
		setMobileOpen(false);
	}, [page, contentKey, setMobileOpen]);

	const headerBreadcrumbs = [{ label: "首页", href: "/calendar" }, ...(breadcrumbs ?? [])];
	const navigatePage = (next: Page) => {
		navigate(next);
		setMobileOpen(false);
	};

	return (
		<AppShell className={`basalt-ui rhino-app${immersive ? " workout-immersive" : ""}`}>
			<AppSkipLink
				onClick={(event) => {
					event.preventDefault();
					document.getElementById("main-content")?.focus();
				}}
			>
				跳到主要内容
			</AppSkipLink>

			{!isMobile && (
				<PersistedSidebarProvider>
					<Sidebar
						ariaLabel="主导航侧栏"
						activePage={page}
						onNavigate={navigatePage}
						identity={identity}
					/>
				</PersistedSidebarProvider>
			)}

			{isMobile && (
				<SidebarDrawer
					id={drawerId}
					open={mobileOpen}
					onOpenChange={setMobileOpen}
					returnFocusRef={menuButton}
					title="Rhino 导航"
					description="切换训练、计划、动作和个人档案"
				>
					<Sidebar
						ariaLabel="主导航抽屉"
						variant="mobile"
						activePage={page}
						onNavigate={navigatePage}
						onDismiss={() => setMobileOpen(false)}
						identity={identity}
					/>
				</SidebarDrawer>
			)}

			<AppMain id="main-content">
				<AppHeader
					density="compact"
					className="rhino-header"
					leading={
						isMobile ? (
							<AppHeaderMenuButton
								ref={menuButton}
								label="打开导航"
								aria-expanded={mobileOpen}
								aria-haspopup="dialog"
								aria-controls={drawerId}
								onClick={() => {
									menuButton.current?.focus();
									setMobileOpen(true);
								}}
							/>
						) : undefined
					}
					breadcrumbs={headerBreadcrumbs}
					breadcrumbsLabel="面包屑导航"
					title={title ?? pageLabels[page]}
					actions={
						<>
							<EnvironmentSwitch />
							<ProjectLinks github="nocoo/rhino" hexly="rhino" name="Rhino" />
							<ThemeToggle aria-label="切换主题" />
						</>
					}
				/>
				<div className="island-wrap">
					<ContentIsland key={contentKey} className="rhino-island">
						{children}
					</ContentIsland>
				</div>
			</AppMain>
		</AppShell>
	);
}

export function Frame(props: Parameters<typeof FrameInner>[0]) {
	return (
		<MobileNavProvider>
			<FrameInner {...props} />
		</MobileNavProvider>
	);
}

// Re-export for tests and documentation.
export { ACCESS_LOGOUT_URL };
