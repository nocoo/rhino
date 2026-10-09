import { Button, LayerCard } from "@nocoo/basalt";
import { StatCard, StatGrid } from "@nocoo/basalt/charts/stat-card";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { SectionRule } from "@nocoo/basalt/components/section-rule";
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
					<div className="card-footer">
						<p className="coach-note">新的一月到了。复盘一下，保留有效的训练习惯。</p>
						<Button variant="secondary" onClick={() => navigate("plans")}>
							月度复盘
						</Button>
					</div>
				</LayerCard>
			)}
			<StatGrid columns={3} className="today-metrics">
				<StatCard
					label="本周训练"
					value={`${completed} / ${current?.input.weeklyFrequency ?? "—"}`}
					subtitle="完成的真实记录"
					icon={CheckCheck}
				/>
				<StatCard
					label="有氧累积 · min"
					value={Math.round(minutes)}
					subtitle="中等强度等效分钟"
					icon={Clock3}
				/>
				<StatCard
					label="力量训练 · 次"
					value={strength}
					subtitle="目标每周 ≥ 2 次"
					icon={HeartPulse}
				/>
			</StatGrid>
			<div className="today-layout">
				<div className="stack">
					<SectionRule
						title="本周安排"
						actions={
							<span className="field-hint">
								{start.slice(5).replace("-", ".")} — {days[6].slice(5).replace("-", ".")}
							</span>
						}
					>
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
					</SectionRule>
					{pending && (
						<LayerCard>
							<div className="card-footer">
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
						<LayerCard>
							<LayerCard.Empty
								icon={<CalendarDays size={24} />}
								title="从一个小计划开始"
								description="完善个人档案，选择每周可用的时间。Rhino 会帮你安排力量、有氧和恢复。"
								action={
									<Button onClick={() => navigate(model.profile?.profile ? "plans" : "profile")}>
										{model.profile?.profile ? "制定第一个计划" : "完善个人档案"}
										<ArrowRight size={15} />
									</Button>
								}
							/>
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
				</div>
			</div>
			<div className="page-links">
				<Button variant="ghost" size="sm" onClick={() => navigate("progress")}>
					查看我的进展 <ArrowRight size={14} />
				</Button>
			</div>
		</div>
	);
}
