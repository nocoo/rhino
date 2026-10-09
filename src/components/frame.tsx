import {
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
	Code2,
	Dumbbell,
	Menu,
	PanelLeftClose,
	PanelLeftOpen,
	ShieldCheck,
	UserRound,
	X,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { version } from "../../package.json";

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
}: {
	page: Page;
	navigate: (page: Page) => void;
	children: ReactNode;
}) {
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
						name="我的训练日志"
						email="单用户 · Access 保护"
						avatar={<ShieldCheck size={20} strokeWidth={1.5} />}
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
							<Button asChild variant="ghost" size="icon">
								<a
									href="https://github.com/nocoo/rhino"
									target="_blank"
									rel="noreferrer"
									aria-label="GitHub 仓库"
								>
									<Code2 size={17} />
								</a>
							</Button>
							<ThemeToggle aria-label="切换主题" />
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
