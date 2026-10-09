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
	SidebarItem,
	SidebarNav,
	SidebarPartition,
	ThemeToggle,
} from "@nocoo/basalt";
import { AppHeader } from "@nocoo/basalt/components/app-header";
import { AppMain, AppShell, AppSkipLink } from "@nocoo/basalt/components/app-shell";
import {
	Activity,
	ArrowUpRight,
	BookOpen,
	CalendarDays,
	ChartNoAxesCombined,
	Code2,
	Dumbbell,
	Menu,
	ShieldCheck,
	UserRound,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { version } from "../../package.json";

export type Page = "today" | "plans" | "library" | "progress" | "profile";
const navigation = [
	{ id: "today", label: "今日训练", en: "TRAIN", icon: Activity },
	{ id: "plans", label: "训练计划", en: "PLAN", icon: CalendarDays },
	{ id: "library", label: "动作实验室", en: "LEARN", icon: BookOpen },
	{ id: "progress", label: "我的进展", en: "REFLECT", icon: ChartNoAxesCombined },
	{ id: "profile", label: "个人档案", en: "PROFILE", icon: UserRound },
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
	const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 800px)").matches);
	const [open, setOpen] = useState(false);
	useEffect(() => {
		const query = window.matchMedia("(max-width: 800px)");
		const change = () => setMobile(query.matches);
		query.addEventListener("change", change);
		return () => query.removeEventListener("change", change);
	}, []);
	const rail = (
		<Sidebar className="rhino-sidebar">
			<SidebarHeader>
				<div className="brand">
					<span className="brand-symbol">
						<Dumbbell size={23} strokeWidth={1.6} />
					</span>
					<span className="brand-name">
						rhino<span className="brand-caption">PERSONAL TRAINING</span>
					</span>
					<span className="version-pill">v{version}</span>
				</div>
			</SidebarHeader>
			<SidebarNav>
				<SidebarPartition>你的训练空间</SidebarPartition>
				{navigation.map(({ id, label, icon: Icon, en }) => (
					<SidebarItem
						key={id}
						active={page === id}
						onClick={() => {
							navigate(id);
							setOpen(false);
						}}
					>
						<Icon size={16} strokeWidth={1.5} />
						<span>{label}</span>
						<span className="nav-en">{en}</span>
					</SidebarItem>
				))}
			</SidebarNav>
			<div className="rail-note">
				<span className="eyebrow">A LITTLE, OFTEN.</span>
				<p>
					不是每次都要突破。
					<br />
					持续，就是进步。
				</p>
				<div className="rail-stripes" />
			</div>
			<SidebarFooter>
				<div className="owner-block">
					<div className="owner-avatar">R</div>
					<div>
						<strong>我的训练日志</strong>
						<span>
							<ShieldCheck size={12} /> 私人空间 · Access 保护
						</span>
					</div>
					<ArrowUpRight size={16} />
				</div>
			</SidebarFooter>
		</Sidebar>
	);
	return (
		<AppShell className="rhino-app">
			<AppSkipLink />
			{!mobile && rail}
			<AppMain id="main-content">
				<AppHeader
					title={navigation.find((item) => item.id === page)?.label}
					breadcrumbs={[{ label: "WORKSPACE" }]}
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
							<span className="header-date">
								{new Intl.DateTimeFormat("zh-CN", {
									month: "long",
									day: "numeric",
									weekday: "short",
								}).format(new Date())}
							</span>
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
