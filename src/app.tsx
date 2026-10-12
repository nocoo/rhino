import { Button, LayerCard } from "@nocoo/basalt";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Component, type ReactNode, useEffect } from "react";
import { Frame, type Page } from "./components/frame";
import { HistoryLinks } from "./components/history-links";
import { exerciseNames } from "./components/workout-summary";
import { calendarPath, pageLabels, parseRoute, sessionPath } from "./domain/routes";
import { CalendarView } from "./features/calendar-view";
import { LibraryView } from "./features/library-view";
import { PlansView } from "./features/plans-view";
import { ProfileView } from "./features/profile-view";
import { ProgressView } from "./features/progress-view";
import { SessionReview } from "./features/session-review";
import { SessionView } from "./features/session-view";
import { TodayView } from "./features/today-view";
import { useIdentity } from "./features/use-identity";
import { useRhinoModel } from "./features/use-rhino-model";
import { confirmNavigation, useHistory } from "./hooks/use-history";
import { useRoutedSession } from "./hooks/use-routed-session";

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
	state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	render() {
		return this.state.failed ? (
			<LayerCard>
				<LayerCard.Header>
					<h1 className="card-title">
						<AlertTriangle size={18} aria-hidden="true" /> 页面遇到问题
					</h1>
				</LayerCard.Header>
				<LayerCard.Body>
					<p className="field-hint">已保存的数据不受影响。未提交的修改可能无法恢复。</p>
				</LayerCard.Body>
				<LayerCard.Footer>
					<Button onClick={() => window.location.reload()}>
						<RefreshCw size={15} /> 重新加载
					</Button>
				</LayerCard.Footer>
			</LayerCard>
		) : (
			this.props.children
		);
	}
}

function Workspace() {
	const model = useRhinoModel((session, mode) =>
		router.navigate(sessionPath(session.id, route.sessionId ? route.parent : router.href, mode)),
	);
	const identity = useIdentity();
	const router = useHistory(() => confirmNavigation(Boolean(route.sessionId && model.busy)));
	const route = parseRoute(router.href);
	const page = route.page;
	const sessionRoute = useRoutedSession(route.sessionId, model.active, model.setActive);
	const active = model.active?.id === route.sessionId ? model.active : null;
	const navigate = (next: Page) => router.navigate(`/${next}`);
	const breadcrumbs =
		page === "calendar" ? [] : [{ href: "/calendar", label: pageLabels.calendar }];
	if (route.sessionId) breadcrumbs.push({ href: route.parent, label: pageLabels[page] });
	else if (route.exercise) breadcrumbs.push({ href: "/library", label: pageLabels.library });
	const title =
		route.kind === "missing"
			? "页面不存在"
			: route.sessionId
				? route.sessionMode === "view"
					? "训练详情"
					: route.sessionMode === "edit"
						? "修改训练"
						: "训练记录"
				: route.exercise
					? exerciseNames[route.exercise]
					: pageLabels[page];
	useEffect(() => {
		document.title = `${title} · Rhino`;
	}, [title]);
	return (
		<HistoryLinks navigate={router.navigate}>
			<Frame
				page={page}
				navigate={navigate}
				identity={identity}
				immersive={active?.status === "active" && route.sessionMode !== "view"}
				title={title}
				breadcrumbs={breadcrumbs}
				contentKey={`${page}/${route.sessionId ?? route.kind}/${route.sessionMode ?? ""}`}
			>
				{model.error && !active && (
					<div role="alert" className="error-message" style={{ marginBottom: 16 }}>
						<span className="banner-content">
							<AlertTriangle size={15} aria-hidden="true" />
							<span>{model.error}</span>
						</span>
						<Button size="sm" variant="ghost" onClick={() => void model.reload()}>
							<RefreshCw size={13} /> 重新加载
						</Button>
					</div>
				)}
				{model.message && !active && (
					<p className="status-message" role="status" style={{ marginBottom: 16 }}>
						<CheckCircle2 size={15} aria-hidden="true" />
						<span>{model.message}</span>
					</p>
				)}
				{route.kind === "missing" ? (
					<LayerCard>
						<h2>没有这个页面</h2>
						<p>地址可能已失效，请返回训练日历。</p>
						<Button onClick={() => navigate("calendar")}>返回训练日历</Button>
					</LayerCard>
				) : model.loading ? (
					<LayerCard.Loading label="正在加载私人训练空间" />
				) : route.sessionId && !active ? (
					sessionRoute.error ? (
						<LayerCard>
							<p role="alert">{sessionRoute.error}</p>
							<Button onClick={sessionRoute.retry}>重试加载训练</Button>
							<Button variant="secondary" onClick={() => router.navigate(route.parent)}>
								返回上一页
							</Button>
						</LayerCard>
					) : (
						<LayerCard.Loading label="正在加载训练记录" />
					)
				) : active && route.sessionMode === "view" ? (
					<SessionReview
						session={active}
						model={model}
						close={() => router.navigate(route.parent)}
					/>
				) : active ? (
					<SessionView
						key={`${active.id}/${route.sessionMode}`}
						model={model}
						session={active}
						editing={route.sessionMode === "edit"}
						close={() => router.navigate(route.parent)}
					/>
				) : page === "today" ? (
					<TodayView
						model={model}
						navigate={navigate}
						selectExercise={(id) => router.navigate(`/library/${id}`)}
					/>
				) : page === "calendar" ? (
					<CalendarView
						model={model}
						navigate={navigate}
						date={route.date ?? model.today}
						selectDate={(date) => router.navigate(calendarPath(date))}
					/>
				) : page === "plans" ? (
					<PlansView model={model} />
				) : page === "library" ? (
					<LibraryView
						selected={route.exercise ?? "goblet-squat"}
						select={(id) => router.navigate(`/library/${id}`)}
					/>
				) : page === "progress" ? (
					<ProgressView model={model} openProfile={() => navigate("profile")} />
				) : (
					<ProfileView key={model.profile?.profile?.version ?? 0} model={model} />
				)}
			</Frame>
		</HistoryLinks>
	);
}

export function App() {
	return (
		<ErrorBoundary>
			<Workspace />
		</ErrorBoundary>
	);
}
