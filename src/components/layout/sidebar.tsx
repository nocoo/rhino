import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	Sidebar as BasaltSidebar,
	SidebarBrand,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarIconItem,
	SidebarItem,
	SidebarNav,
	SidebarProvider,
	SidebarToggle,
	SidebarUser,
} from "@nocoo/basalt";
import { useSidebar } from "@nocoo/basalt/components/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@nocoo/basalt/components/tooltip";
import {
	Activity,
	BookOpen,
	CalendarDays,
	ChartNoAxesCombined,
	type LucideIcon,
	UserRound,
} from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { version } from "../../../package.json";
import type { IdentityProfile } from "../../domain/contracts";
import { type Page, pageLabels } from "../../domain/routes";
import { getDisplayName } from "../../lib/identity-display";

export const ACCESS_LOGOUT_URL = "/cdn-cgi/access/logout";

const SIDEBAR_COLLAPSED_KEY = "rhino:sidebar-collapsed";
type SidebarCollapsedPreference = "false" | "true";

const navigation: { id: Page; label: string; icon: LucideIcon }[] = [
	{ id: "calendar", label: pageLabels.calendar, icon: CalendarDays },
	{ id: "today", label: pageLabels.today, icon: Activity },
	{ id: "plans", label: pageLabels.plans, icon: CalendarDays },
	{ id: "library", label: pageLabels.library, icon: BookOpen },
	{ id: "progress", label: pageLabels.progress, icon: ChartNoAxesCombined },
	{ id: "profile", label: pageLabels.profile, icon: UserRound },
];

function usePersistedSidebarCollapsed(
	key: string,
	defaultValue: SidebarCollapsedPreference,
): [SidebarCollapsedPreference, (value: SidebarCollapsedPreference) => void] {
	const [stored, setStored] = useState<SidebarCollapsedPreference>(() => {
		if (typeof window === "undefined") return defaultValue;
		const value = localStorage.getItem(key);
		return value === "true" || value === "false" ? value : defaultValue;
	});

	const setValue = useCallback(
		(next: SidebarCollapsedPreference) => {
			setStored(next);
			localStorage.setItem(key, next);
		},
		[key],
	);

	return [stored, setValue];
}

export function PersistedSidebarProvider({ children }: { children: ReactNode }) {
	const [stored, setStored] = usePersistedSidebarCollapsed(SIDEBAR_COLLAPSED_KEY, "false");
	const collapsed = stored === "true";
	const onCollapsedChange = useCallback(
		(next: boolean) => {
			setStored(next ? "true" : "false");
		},
		[setStored],
	);

	return (
		<SidebarProvider collapsed={collapsed} onCollapsedChange={onCollapsedChange} defaultWidth={260}>
			{children}
		</SidebarProvider>
	);
}

interface SidebarProps {
	ariaLabel: string;
	variant?: "desktop" | "mobile";
	activePage: Page;
	onNavigate: (page: Page) => void;
	onDismiss?: () => void;
	identity?: IdentityProfile;
}

function RhinoSidebarBody({ variant, activePage, onNavigate, onDismiss, identity }: SidebarProps) {
	const { collapsed, peek, peeking } = useSidebar();
	const railCollapsed = collapsed && !(peek && peeking);
	const { name, initial, email, avatar: avatarUrl } = getDisplayName(identity);

	const avatar = (
		<Avatar>
			{avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
			<AvatarFallback className="text-basalt-sm">{initial}</AvatarFallback>
		</Avatar>
	);

	const go = (page: Page) => onNavigate(page);

	return (
		<>
			<SidebarHeader>
				<SidebarBrand
					logo={
						<img
							src="/logo-24.png"
							srcSet="/logo-24.png 24w, /logo-80.png 80w"
							sizes="24px"
							width={24}
							height={24}
							alt="Rhino"
						/>
					}
					name="Rhino"
					version={`v${version}`}
					action={
						variant === "mobile" ? (
							<SidebarToggle
								mode="dismiss"
								dismissLabel="关闭导航"
								{...(onDismiss ? { onDismiss } : {})}
							/>
						) : (
							<SidebarToggle expandLabel="展开侧栏" collapseLabel="收起侧栏" />
						)
					}
				/>
			</SidebarHeader>
			<SidebarNav aria-label="主要页面">
				{railCollapsed ? (
					navigation.map(({ id, label, icon: Icon }) => (
						<Tooltip key={id} delayDuration={0}>
							<TooltipTrigger asChild>
								<SidebarIconItem
									active={activePage === id}
									aria-label={label}
									onClick={() => go(id)}
								>
									<Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
								</SidebarIconItem>
							</TooltipTrigger>
							<TooltipContent side="right" sideOffset={8}>
								{label}
							</TooltipContent>
						</Tooltip>
					))
				) : (
					<SidebarGroup label="训练空间" defaultOpen>
						{navigation.map(({ id, label, icon: Icon }) => (
							<SidebarItem key={id} active={activePage === id} onClick={() => go(id)}>
								<Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
								<span className="flex-1 truncate text-left">{label}</span>
							</SidebarItem>
						))}
					</SidebarGroup>
				)}
			</SidebarNav>
			<SidebarFooter>
				<SidebarUser
					name={name}
					email={email ?? undefined}
					avatar={avatar}
					tooltip={name}
					signOutHref={ACCESS_LOGOUT_URL}
					signOutLabel="退出登录"
				/>
			</SidebarFooter>
		</>
	);
}

export function Sidebar({ ariaLabel, variant = "desktop", onDismiss, ...body }: SidebarProps) {
	return (
		<TooltipProvider delayDuration={0}>
			<BasaltSidebar aria-label={ariaLabel} resizable={false} className="rhino-sidebar">
				<RhinoSidebarBody
					variant={variant}
					ariaLabel={ariaLabel}
					{...body}
					{...(onDismiss ? { onDismiss } : {})}
				/>
			</BasaltSidebar>
		</TooltipProvider>
	);
}
