import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	Button,
	ContentIsland,
	Sheet,
	SheetContent,
	SheetDescription,
	SheetTitle,
	SheetTrigger,
	Sidebar,
	SidebarFooter,
	SidebarHeader,
	SidebarIconItem,
	SidebarItem,
	SidebarNav,
	SidebarPartition,
	SidebarUser,
	ThemeToggle,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@nocoo/basalt";
import { AppHeader } from "@nocoo/basalt/components/app-header";
import { AppMain, AppShell, AppSkipLink } from "@nocoo/basalt/components/app-shell";
import {
	Activity,
	BookOpen,
	CalendarDays,
	ChartNoAxesCombined,
	createLucideIcon,
	Dumbbell,
	Menu,
	PanelLeftClose,
	PanelLeftOpen,
	ShieldCheck,
	UserRound,
	X,
} from "lucide-react";
import { type ReactElement, type ReactNode, useEffect, useState } from "react";
import { version } from "../../package.json";

const Github = createLucideIcon("Github", [
	[
		"path",
		{
			d: "M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4",
			key: "tonef",
		},
	],
	["path", { d: "M9 18c-4.51 2-5-2-7-2", key: "9comsn" }],
]);

function HeaderIconLink({
	href,
	label,
	children,
}: {
	href: string;
	label: string;
	children: ReactElement;
}) {
	return (
		<Tooltip delayDuration={0}>
			<TooltipTrigger asChild>
				<Button variant="ghost" size="icon" asChild>
					<a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
						{children}
						<span className="sr-only">{label}</span>
					</a>
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom" sideOffset={6}>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}

export type Page = "today" | "plans" | "library" | "progress" | "profile";
const navigation = [
	{ id: "today", label: "今日训练", icon: Activity },
	{ id: "plans", label: "训练计划", icon: CalendarDays },
	{ id: "library", label: "动作实验室", icon: BookOpen },
	{ id: "progress", label: "我的进展", icon: ChartNoAxesCombined },
	{ id: "profile", label: "个人档案", icon: UserRound },
] as const;

export function Frame({
	page,
	navigate,
	children,
	identity,
}: {
	page: Page;
	navigate: (page: Page) => void;
	children: ReactNode;
	identity?: { name: string | null; avatar: string | null };
}) {
	const profileName = identity?.name?.trim() || "我的训练日志";
	const profileAvatar = identity?.avatar?.trim() || null;
	const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 767px)").matches);
	const [open, setOpen] = useState(false);
	const [collapsed, setCollapsed] = useState(false);
	useEffect(() => {
		const query = window.matchMedia("(max-width: 767px)");
		const change = () => {
			setMobile(query.matches);
			setOpen(false);
		};
		query.addEventListener("change", change);
		return () => query.removeEventListener("change", change);
	}, []);
	const compact = !mobile && collapsed;
	const collapseControl = (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					aria-label={compact ? "展开侧栏" : "收起侧栏"}
					aria-expanded={!compact}
					onClick={() => setCollapsed(!collapsed)}
				>
					{compact ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
				</Button>
			</TooltipTrigger>
			<TooltipContent side="right">{compact ? "展开侧栏" : "收起侧栏"}</TooltipContent>
		</Tooltip>
	);
	const rail = (
		<Sidebar collapsed={compact} className="rhino-sidebar" aria-label="主导航侧栏">
			<SidebarHeader>
				<div className="brand">
					<Dumbbell className="brand-symbol" size={24} strokeWidth={1.5} aria-label="Rhino" />
					{!compact && (
						<>
							<span className="brand-name">rhino</span>
							<span className="version-pill">v{version}</span>
						</>
					)}
					{mobile && (
						<Button
							variant="ghost"
							size="icon"
							aria-label="关闭导航"
							onClick={() => setOpen(false)}
						>
							<X size={16} />
						</Button>
					)}
				</div>
			</SidebarHeader>
			<SidebarNav aria-label="主要页面">
				{!compact && <SidebarPartition>训练空间</SidebarPartition>}
				<div className={`navigation-items${compact ? " navigation-icons" : ""}`}>
					{navigation.map(({ id, label, icon: Icon }) => {
						const props = {
							active: page === id,
							onClick: () => {
								navigate(id);
								setOpen(false);
							},
						};
						return compact ? (
							<Tooltip key={id}>
								<TooltipTrigger asChild>
									<SidebarIconItem {...props} aria-label={label}>
										<Icon size={16} strokeWidth={1.5} />
									</SidebarIconItem>
								</TooltipTrigger>
								<TooltipContent side="right">{label}</TooltipContent>
							</Tooltip>
						) : (
							<SidebarItem key={id} {...props}>
								<Icon size={16} strokeWidth={1.5} />
								<span>{label}</span>
							</SidebarItem>
						);
					})}
				</div>
			</SidebarNav>
			<SidebarFooter className="rail-footer">
				{!compact && (
					<SidebarUser
						className="rail-user"
						name={profileName}
						email="私人训练空间"
						avatar={
							<Avatar className="h-9 w-9 shrink-0">
								{profileAvatar ? <AvatarImage src={profileAvatar} alt={profileName} /> : null}
								<AvatarFallback>
									{profileName.trim().slice(0, 1) || <ShieldCheck size={18} strokeWidth={1.5} />}
								</AvatarFallback>
							</Avatar>
						}
					/>
				)}
				{!mobile && collapseControl}
			</SidebarFooter>
		</Sidebar>
	);
	return (
		<AppShell className="rhino-app">
			<AppSkipLink>跳到主要内容</AppSkipLink>
			{!mobile && rail}
			<AppMain id="main-content">
				<AppHeader
					title={navigation.find((item) => item.id === page)?.label}
					leading={
						mobile ? (
							<Sheet open={open} onOpenChange={setOpen}>
								<SheetTrigger asChild>
									<Button variant="ghost" size="icon" aria-label="打开导航">
										<Menu size={19} />
									</Button>
								</SheetTrigger>
								<SheetContent side="left" className="navigation-sheet">
									<SheetTitle className="sr-only">Rhino 导航</SheetTitle>
									<SheetDescription className="sr-only">
										切换训练、计划、动作和个人档案
									</SheetDescription>
									{rail}
								</SheetContent>
							</Sheet>
						) : undefined
					}
					actions={
						<>
							<HeaderIconLink href="https://github.com/nocoo/rhino" label="Rhino 的 GitHub 仓库">
								<Github size={18} strokeWidth={1.5} aria-hidden="true" />
							</HeaderIconLink>
							<HeaderIconLink
								href="https://hexly.ai/projects/rhino"
								label="在 Hexly 项目页查看 Rhino"
							>
								<svg
									className="h-[18px] w-[18px]"
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth={1.5}
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<path d="m12 2 8.66 5v10L12 22l-8.66-5V7Z" />
									<path d="M12 2v20M3.34 7l17.32 10m0-10L3.34 17" />
								</svg>
							</HeaderIconLink>
							<Tooltip delayDuration={0}>
								<TooltipTrigger asChild>
									<ThemeToggle aria-label="切换主题" />
								</TooltipTrigger>
								<TooltipContent side="bottom" sideOffset={6}>
									切换主题
								</TooltipContent>
							</Tooltip>
						</>
					}
				/>
				<div className="island-wrap">
					<ContentIsland className="rhino-island">{children}</ContentIsland>
				</div>
			</AppMain>
		</AppShell>
	);
}
