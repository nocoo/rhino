import { Button, LayerCard } from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { ArrowRight, CalendarDays, CheckCheck, Clock3, HeartPulse, Leaf, Play } from "lucide-react";
import { Suspense } from "react";
import type { Page } from "../components/frame";
import { WorkoutSummary } from "../components/workout-summary";
import type { StrengthExerciseId } from "../domain/contracts";
import { addDays, mondayOfWeek, weekdayOf } from "../domain/dates";
import { LazyExerciseViewer } from "./library-view";
import type { RhinoModel } from "./use-rhino-model";

export function TodayView({
	model,
	navigate,
	selectExercise,
}: {
	model: RhinoModel;
	navigate: (page: Page) => void;
	selectExercise: (id: StrengthExerciseId) => void;
}) {
	const start = mondayOfWeek(model.today);
	const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
	const current = model.plans.current;
	const slot =
		current?.template.slots.find((item) => item.weekday === weekdayOf(model.today)) ??
		current?.template.slots[0];
	const totals = model.progress?.weeklyTotals.find((item) => item.weekStart === start);
	const strength = totals?.strengthSessions ?? 0;
	const completed = totals?.completedSessions ?? 0;
	const minutes = totals?.moderateEquivalentMinutes ?? 0;
	const pending = model.sessions.find(
		(item) => item.status === "draft" || item.status === "active",
	);
	const focus =
		slot?.target.blocks.flatMap((block) => block.exercises)[0]?.exerciseId ?? "goblet-squat";
	return (
		<div className="page-body">
			<PageHeader
				title="今天，也为自己留一点时间。"
				description="训练有计划，进步有记录。按自己的节奏，扎实地向前。"
				actions={
					<Button variant="secondary" onClick={() => navigate("plans")}>
						<CalendarDays size={15} /> 管理计划
					</Button>
				}
			/>
			{current && current.reviewMonth !== model.today.slice(0, 7) && (
				<LayerCard>
					<div className="card-footer" style={{ marginTop: 0 }}>
						<p className="coach-note">新的一月到了。复盘一下，保留有效的训练习惯。</p>
						<Button variant="secondary" onClick={() => navigate("plans")}>
							月度复盘
						</Button>
					</div>
				</LayerCard>
			)}
			<div className="today-layout">
				<div className="stack">
					<div>
						<div className="section-caption">
							<span className="eyebrow">THIS WEEK</span>
							<span>
								{start.slice(5).replace("-", ".")} — {days[6].slice(5).replace("-", ".")}
							</span>
						</div>
						<div className="week-strip">
							{days.map((day, index) => (
								<div key={day} className={`week-day ${day === model.today ? "current" : ""}`}>
									<span>{["一", "二", "三", "四", "五", "六", "日"][index]}</span>
									<strong className="mono">{day.slice(8)}</strong>
									<span
										className="day-dot"
										style={{
											opacity: current?.template.slots.some(
												(item) => item.weekday === weekdayOf(day),
											)
												? 1
												: 0.15,
										}}
									/>
								</div>
							))}
						</div>
					</div>
					{pending && (
						<LayerCard>
							<div className="card-footer" style={{ marginTop: 0 }}>
								<div>
									<strong style={{ fontSize: 14 }}>有一场训练等待继续</strong>
									<p className="field-hint">{pending.localDate} · 已保存的训练草稿</p>
								</div>
								<Button variant="secondary" onClick={() => model.setActive(pending)}>
									<Play size={14} /> 继续训练
								</Button>
							</div>
						</LayerCard>
					)}
					{slot ? (
						<WorkoutSummary
							target={slot.target}
							onStart={() => void model.start(slot.target)}
							onExercise={selectExercise}
							busy={model.busy}
						/>
					) : (
						<LayerCard padding="lg">
							<div className="empty-state">
								<span className="pill">FIRST THINGS FIRST</span>
								<h2>
									你的第一场训练，
									<br />
									从一个小计划开始。
								</h2>
								<p>完善个人档案，选择每周可用的时间。Rhino 会帮你安排力量、有氧和恢复。</p>
								<Button onClick={() => navigate(model.profile?.profile ? "plans" : "profile")}>
									{model.profile?.profile ? "制定第一个计划" : "完善个人档案"}
									<ArrowRight size={15} />
								</Button>
							</div>
						</LayerCard>
					)}
					<LayerCard>
						<div className="coach-note">
							<Leaf size={19} />
							<div>
								<strong style={{ color: "var(--rhino-ink)" }}>一致性，比完美更重要。</strong>
								<p>热身轻松一点，力量训练留有余力。今天不必练到力竭，也不必弥补昨天。</p>
							</div>
						</div>
					</LayerCard>
				</div>
				<div className="stack">
					<Suspense fallback={<LayerCard.Loading label="正在准备三维动作" />}>
						<LazyExerciseViewer exerciseId={focus} compact />
					</Suspense>
					<div className="stats-grid">
						<LayerCard>
							<span className="stat-label">
								<CheckCheck size={14} /> 本周训练
							</span>
							<div className="metric-value">
								{completed}
								<small>/ {current?.input.weeklyFrequency ?? "—"}</small>
							</div>
							<p className="stat-caption">完成的真实记录</p>
						</LayerCard>
						<LayerCard>
							<span className="stat-label">
								<Clock3 size={14} /> 有氧累积
							</span>
							<div className="metric-value">
								{Math.round(minutes)}
								<small>min</small>
							</div>
							<p className="stat-caption">中等强度等效分钟</p>
						</LayerCard>
						<LayerCard>
							<span className="stat-label">
								<HeartPulse size={14} /> 力量训练
							</span>
							<div className="metric-value">
								{strength}
								<small>次</small>
							</div>
							<p className="stat-caption">目标每周 ≥ 2 次</p>
						</LayerCard>
					</div>
				</div>
			</div>
			<div className="section-caption">
				<span className="eyebrow">BUILT AROUND YOU. NOT THE OTHER WAY AROUND.</span>
				<Button variant="ghost" size="sm" onClick={() => navigate("progress")}>
					查看我的进展 <ArrowRight size={14} />
				</Button>
			</div>
		</div>
	);
}
