import { Button, Input, LayerCard } from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { SectionRule } from "@nocoo/basalt/components/section-rule";
import {
	CalendarDays,
	Check,
	ChevronLeft,
	ChevronRight,
	ClipboardPen,
	Clock3,
	Leaf,
	Play,
} from "lucide-react";
import type { Page } from "../components/frame";
import { emphasisNames, WorkoutSummary } from "../components/workout-summary";
import { WEEKDAY_LABELS, weekdayOf } from "../domain/dates";
import { SessionRecordList } from "./session-record-list";
import { useCalendarModel } from "./use-calendar-model";
import type { RhinoModel } from "./use-rhino-model";

export function CalendarView({
	model,
	navigate,
	date,
	selectDate,
}: {
	model: RhinoModel;
	navigate: (page: Page) => void;
	date: string;
	selectDate: (date: string) => void;
}) {
	const calendar = useCalendarModel(model, date, selectDate);
	const day = calendar.days.find((item) => item.date === calendar.selected);
	const slot = day?.slot;
	const plan = day?.plan;
	const records = calendar.sessions.filter((item) => item.localDate === calendar.selected);
	const completed = calendar.activity.completed;
	return (
		<div className="page-body calendar-page">
			<PageHeader
				title="训练日历"
				description="从安排到完成，在日历里串起你的训练。"
				actions={
					<Button variant="secondary" onClick={() => navigate("plans")}>
						<CalendarDays size={16} /> 管理计划
					</Button>
				}
			/>
			<div className="calendar-layout">
				<section aria-label="训练月历" className="calendar-month">
					<div className="calendar-toolbar">
						<Button
							variant="ghost"
							size="icon"
							aria-label="上个月"
							disabled={calendar.month === "1000-01"}
							onClick={() => calendar.move(-1)}
						>
							<ChevronLeft size={20} />
						</Button>
						<Input
							type="month"
							aria-label="日历月份"
							value={calendar.month}
							min="1000-01"
							max="9998-12"
							onChange={(event) => calendar.selectMonth(event.target.value)}
						/>
						<Button
							variant="ghost"
							size="icon"
							aria-label="下个月"
							disabled={calendar.month === "9998-12"}
							onClick={() => calendar.move(1)}
						>
							<ChevronRight size={20} />
						</Button>
						<Button variant="secondary" onClick={calendar.today}>
							今天
						</Button>
					</div>
					<div className="calendar-weekdays" aria-hidden="true">
						{["一", "二", "三", "四", "五", "六", "日"].map((label) => (
							<span key={label}>{label}</span>
						))}
					</div>
					<section className="calendar-grid" aria-label={`${calendar.month} 的训练日期`}>
						{calendar.days.map((item) => {
							const sessions = calendar.sessions.filter(
								(session) => session.localDate === item.date,
							);
							const done = sessions.some((session) => session.status === "completed");
							const pending = sessions.some(
								(session) => session.status === "active" || session.status === "draft",
							);
							return (
								<Button
									key={item.date}
									variant="ghost"
									className="calendar-day"
									data-outside={!item.date.startsWith(calendar.month)}
									data-today={item.date === model.today}
									data-completed={done}
									aria-pressed={item.date === calendar.selected}
									aria-current={item.date === model.today ? "date" : undefined}
									aria-label={`${item.date}${item.slot ? `，计划${emphasisNames[item.slot.emphasis]}` : ""}${done ? "，已完成" : ""}${pending ? "，待继续" : ""}`}
									onClick={() => calendar.select(item.date)}
								>
									<span className="calendar-number">{Number(item.date.slice(8))}</span>
									<span className="calendar-markers" aria-hidden="true">
										{item.slot && <span className="calendar-plan-dot" />}
										{done && <Check size={14} />}
										{pending && <Clock3 size={12} />}
									</span>
								</Button>
							);
						})}
					</section>
					<div className="calendar-legend">
						<span>
							<i className="calendar-plan-dot" /> 计划
						</span>
						<span>
							<Check size={14} /> 已完成
						</span>
						<span>
							<Clock3 size={14} /> 待继续
						</span>
					</div>
					<p className="calendar-caption" role="status">
						{calendar.loading
							? "正在读取本月记录…"
							: calendar.error
								? "本月记录暂不可用"
								: `本月已完成 ${completed} 场训练`}
					</p>
					<p className="field-hint">计划按采用日期与每周安排展开；未来安排是预期，不代表完成。</p>
				</section>
				<section className="stack calendar-agenda" aria-label="所选日期详情">
					<SectionRule
						title={
							<span className="section-label">
								<CalendarDays size={15} /> {calendar.selected} ·{" "}
								{WEEKDAY_LABELS[weekdayOf(calendar.selected)]}
							</span>
						}
						actions={
							calendar.selected === model.today ? <span className="pill">今天</span> : undefined
						}
					/>
					{calendar.loading ? (
						<LayerCard.Loading label="正在加载当天记录" />
					) : calendar.error ? (
						<LayerCard>
							<LayerCard.Body className="stack">
								<p role="alert" className="error-message">
									{calendar.error}
								</p>
								<div className="form-actions">
									<Button variant="secondary" onClick={calendar.retry}>
										重试日历
									</Button>
								</div>
							</LayerCard.Body>
						</LayerCard>
					) : records.length ? (
						<SessionRecordList records={records} model={model} calendar={calendar} />
					) : (
						<div className="coach-callout">
							<p className="field-hint">当天尚无训练记录；计划不会自动计入完成量。</p>
						</div>
					)}
					{slot && plan ? (
						<>
							<WorkoutSummary target={slot.target} subtitle={`当日计划 · v${plan.revision}`} />
							{calendar.selected <= model.today && (
								<div className="calendar-start-actions">
									{calendar.selected === model.today && (
										<Button
											disabled={model.busy || calendar.loading || !!calendar.error}
											onClick={() =>
												void model.start(slot.target, {
													localDate: calendar.selected,
													sourcePlanRevision: plan.revision,
												})
											}
										>
											<Play size={16} /> 开始这场训练
										</Button>
									)}
									<Button
										variant="secondary"
										disabled={model.busy || calendar.loading || !!calendar.error}
										onClick={() =>
											void model.start(slot.target, {
												localDate: calendar.selected,
												sourcePlanRevision: plan.revision,
												recordOnly: true,
											})
										}
									>
										<ClipboardPen size={16} /> 补记实际训练
									</Button>
								</div>
							)}
						</>
					) : (
						<LayerCard>
							<LayerCard.Empty
								icon={<Leaf size={24} />}
								title={day?.plan ? "留一点恢复时间" : "这一天没有可用计划"}
								description={
									day?.plan
										? "当时采用的计划没有安排训练，已有记录仍会展示。"
										: "计划从采用当天开始展示，不把新计划套用到过去。"
								}
								action={
									<Button variant="secondary" onClick={() => navigate("plans")}>
										查看训练计划
									</Button>
								}
							/>
						</LayerCard>
					)}
				</section>
			</div>
		</div>
	);
}
