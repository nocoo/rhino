import { Button, LayerCard } from "@nocoo/basalt";
import { Component, type ReactNode, useState } from "react";
import { Frame, type Page } from "./components/frame";
import type { StrengthExerciseId } from "./domain/contracts";
import { LibraryView } from "./features/library-view";
import { PlansView } from "./features/plans-view";
import { ProfileView } from "./features/profile-view";
import { ProgressView } from "./features/progress-view";
import { SessionView } from "./features/session-view";
import { TodayView } from "./features/today-view";
import { useIdentity } from "./features/use-identity";
import { useRhinoModel } from "./features/use-rhino-model";

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
	state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	render() {
		return this.state.failed ? (
			<LayerCard>
				<h1>页面遇到问题</h1>
				<p>已保存的数据不受影响。未提交的修改可能无法恢复。</p>
				<Button onClick={() => window.location.reload()}>重新加载</Button>
			</LayerCard>
		) : (
			this.props.children
		);
	}
}

function Workspace() {
	const model = useRhinoModel();
	const identity = useIdentity();
	const [page, setPage] = useState<Page>("today");
	const [selected, setSelected] = useState<StrengthExerciseId>("goblet-squat");
	const navigate = (next: Page) => {
		if (model.active && !window.confirm("离开训练页面？请先保存未提交的修改。")) return;
		model.setActive(null);
		setPage(next);
	};
	return (
		<Frame page={page} navigate={navigate} identity={identity}>
			{model.error && (
				<div role="alert" className="error-message" style={{ marginBottom: 20 }}>
					{model.error}
					<Button size="sm" variant="ghost" onClick={() => void model.reload()}>
						重新加载
					</Button>
				</div>
			)}
			{model.message && (
				<p className="status-message" role="status" style={{ marginBottom: 16 }}>
					{model.message}
				</p>
			)}
			{model.loading ? (
				<LayerCard.Loading label="正在加载私人训练空间" />
			) : model.active ? (
				<SessionView
					key={`${model.active.id}-${model.active.version}`}
					model={model}
					session={model.active}
					close={() => model.setActive(null)}
				/>
			) : page === "today" ? (
				<TodayView
					model={model}
					navigate={navigate}
					selectExercise={(id) => {
						setSelected(id);
						setPage("library");
					}}
				/>
			) : page === "plans" ? (
				<PlansView model={model} />
			) : page === "library" ? (
				<LibraryView selected={selected} select={setSelected} />
			) : page === "progress" ? (
				<ProgressView model={model} openProfile={() => setPage("profile")} />
			) : (
				<ProfileView key={model.profile?.profile?.version ?? 0} model={model} />
			)}
		</Frame>
	);
}

export function App() {
	return (
		<ErrorBoundary>
			<Workspace />
		</ErrorBoundary>
	);
}
