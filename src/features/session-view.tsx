import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	LayerCard,
} from "@nocoo/basalt";
import {
	ArrowLeft,
	Bike,
	BookOpen,
	Check,
	ChevronRight,
	Dumbbell,
	Flag,
	Flame,
	Leaf,
	ListChecks,
	Play,
	Save,
	Timer,
	Wind,
} from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { Choice, Field } from "../components/fields";
import { NumberStepper } from "../components/number-stepper";
import { emphasisNames, exerciseNames } from "../components/workout-summary";
import { getExercise } from "../data/exercises";
import type { CardioIntensity, SessionRecord, StrengthExerciseId } from "../domain/contracts";
import { clockLabel, stepDone } from "../domain/workout";
import { useWorkoutChrome } from "../hooks/use-browser-chrome";
import { chineseCues, LazyExerciseViewer } from "./library-view";
import { cardioIntensityOptions, cardioNames, SessionPlan } from "./session-plan";
import type { RhinoModel } from "./use-rhino-model";
import { useWorkoutModel } from "./use-workout-model";

export function SessionView({
	model,
	session,
	close,
}: {
	model: RhinoModel;
	session: SessionRecord;
	close: () => void;
}) {
	const workout = useWorkoutModel(session, model);
	const { editor, step, entry } = workout;
	const [preview, setPreview] = useState<StrengthExerciseId | null>(null);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [ending, setEnding] = useState(false);
	const previewTrigger = useRef<HTMLElement | null>(null);
	const endingTrigger = useRef<HTMLElement | null>(null);
	const pageRoot = useRef<HTMLDivElement | null>(null);
	useEffect(() => {
		pageRoot.current?.closest("[data-basalt-island]")?.scrollTo({ top: 0 });
	}, []);
	const openPreview = (id: StrengthExerciseId, trigger: HTMLElement) => {
		previewTrigger.current = trigger;
		setPreview(id);
		setPreviewOpen(true);
	};
	const openEnding = (trigger: HTMLElement) => {
		endingTrigger.current = trigger;
		setEnding(true);
	};
	const prep = session.status === "draft";
	const finished = session.status === "completed" || session.status === "abandoned";
	const manual = session.status === "active" && !session.actual?.timing;
	const completed = workout.steps.filter((item) => stepDone(item, editor.actual)).length;
	const showPlan = prep || workout.overview || finished;
	const resting = workout.restSeconds > 0;
	const tone = showPlan
		? null
		: resting
			? "rest"
			: step?.kind === "cardio"
				? step.cardio.role
				: "strength";
	useWorkoutChrome(tone);
	const PhaseIcon = resting
		? Leaf
		: step?.kind === "strength"
			? Dumbbell
			: step?.kind === "cardio"
				? { preparation: Flame, main: Bike, recovery: Wind }[step.cardio.role]
				: Check;
	const title =
		step?.kind === "strength"
			? exerciseNames[step.exercise.exerciseId]
			: step
				? cardioNames[step.cardio.role]
				: "本次安排已走完";
	const leave = () => {
		if (!model.busy && (!workout.dirty || window.confirm("还有未保存的修改，确定离开吗？")))
			close();
	};
	return (
		<div
			ref={pageRoot}
			className={`workout-page${showPlan ? " workout-plan-page" : " workout-live"}`}
			data-workout-tone={tone ?? undefined}
		>
			<header className="workout-topbar">
				<Button variant="ghost" size="sm" disabled={model.busy} onClick={leave}>
					<ArrowLeft size={16} /> 离开
				</Button>
				<div>
					<strong>{prep ? "训练准备" : finished ? "训练回顾" : "训练进行中"}</strong>
					<span className="field-hint">{session.localDate}</span>
				</div>
				{session.status === "active" ? (
					<Button
						variant="secondary"
						size="sm"
						disabled={model.busy}
						onClick={(event) => openEnding(event.currentTarget)}
					>
						<Flag size={15} /> 结束训练
					</Button>
				) : (
					<span className="pill">
						{prep ? `${editor.target.timeBudgetMinutes} 分钟` : "已结束"}
					</span>
				)}
			</header>
			{model.error && (
				<div role="alert" className="error-message">
					{model.error} · 请检查后重试；已保存的记录会保留。
				</div>
			)}
			<div className="workout-content">
				{showPlan ? (
					<>
						<div className="workout-plan-heading">
							<h1>
								{prep
									? emphasisNames[editor.target.emphasis]
									: finished
										? "训练回顾"
										: "本场计划与记录"}
							</h1>
							<p className="field-hint">
								{prep
									? "按时间顺序，从热身到放松；确认后开始计时。"
									: finished
										? editor.actual.timing
											? `总用时 ${clockLabel(workout.totalSeconds)}`
											: "本场未计时，可回顾与修正实际记录。"
										: editor.actual.timing
											? "查看与调整记录期间，总用时继续累计。"
											: "补记实际训练：只填写真实完成量，不生成计时；填完后结束训练并保存。"}
							</p>
						</div>
						{finished && (
							<p role="status" className="status-message">
								{model.message || "训练已保存，可以回顾与修正实际记录。"}
							</p>
						)}
						<SessionPlan workout={workout} session={session} model={model} preview={openPreview} />
						{!prep && (
							<LayerCard className="stack">
								<Field
									disabled={model.busy}
									label="训练备注"
									value={editor.actual.notes}
									onChange={(notes) => editor.setActual({ ...editor.actual, notes })}
								/>
								<Choice
									disabled={model.busy}
									label="训练时有疼痛或明显不适吗？"
									value={editor.actual.painFlag ? "yes" : "no"}
									onChange={(value) =>
										editor.setActual({ ...editor.actual, painFlag: value === "yes" })
									}
									options={[
										{ value: "no", label: "没有" },
										{ value: "yes", label: "有，停止并复盘" },
									]}
								/>
							</LayerCard>
						)}
					</>
				) : (
					<div className="workout-stage-layout">
						<section className="workout-stage" aria-label="当前训练">
							<div className="workout-progress">
								<span>
									进度 {completed} / {workout.steps.length}
								</span>
								<span>
									<Timer size={14} aria-hidden="true" />
									总用时{" "}
									<strong className="mono" data-testid="total-timer">
										{editor.actual.timing ? clockLabel(workout.totalSeconds) : "未计时"}
									</strong>
								</span>
							</div>
							<div className="workout-progress-track">
								<div
									style={{ width: `${(completed / Math.max(1, workout.steps.length)) * 100}%` }}
								/>
							</div>
							<div className="current-heading">
								<span className="eyebrow">
									<PhaseIcon size={18} strokeWidth={1.5} aria-hidden="true" />
									{step?.kind === "strength"
										? `${resting ? "下一组" : "力量训练"} · 第 ${step.set.setIndex} / ${step.exercise.workingSets.length} 组`
										: step
											? cardioNames[step.cardio.role]
											: "训练完成"}
								</span>
								<h1>{resting ? "组间休息" : title}</h1>
								<p>
									{resting && `接下来 · ${title} · `}
									{step?.kind === "strength"
										? `${step.exercise.workingSets.length} 组 × 每组 ${step.set.repsLow === step.set.repsHigh ? step.set.repsHigh : `${step.set.repsLow}–${step.set.repsHigh}`} 次`
										: step
											? `目标 ${step.cardio.plannedMinutes} 分钟 · ${step.cardio.modality === "cycling" ? "骑行" : "轻松活动"}`
											: "按实际完成量结束，不补填未完成的训练。"}
								</p>
							</div>
							<div className={`workout-clock${entry && !entry.endedAt ? " running" : ""}`}>
								<svg viewBox="0 0 200 200" aria-hidden="true">
									<circle className="clock-track" cx="100" cy="100" r="92" />
									<circle
										className="clock-sweep"
										cx="100"
										cy="100"
										r="92"
										pathLength="60"
										strokeDasharray={`${workout.stepSeconds % 60 || (workout.stepSeconds > 0 ? 60 : 0)} 60`}
									/>
								</svg>
								<div>
									<span className="field-hint">
										{entry
											? step?.kind === "strength"
												? "当前组用时"
												: "当前段用时"
											: workout.restSeconds > 0
												? "组间恢复"
												: "准备开始"}
									</span>
									<strong className="mono" data-testid="step-timer">
										{clockLabel(entry ? workout.stepSeconds : workout.restSeconds)}
									</strong>
									<span className="field-hint">
										{entry
											? "专注动作，按自己的节奏"
											: workout.restSeconds > 0
												? "自然呼吸，恢复好即可继续"
												: "准备好后开始计时"}
									</span>
								</div>
							</div>
							{step?.kind === "strength" ? (
								<>
									<div className="stepper-pair workout-inputs">
										<NumberStepper
											label="本组次数"
											value={workout.reps}
											max={50}
											unit="次"
											disabled={model.busy}
											onChange={workout.setReps}
										/>
										<NumberStepper
											label="本组负重"
											value={workout.loadKg ?? 15}
											max={500}
											step={5}
											unit={step.exercise.loadConvention === "per-hand" ? "kg/只" : "kg 总重"}
											disabled={model.busy}
											onChange={workout.setLoadKg}
										/>
									</div>
									<div className="load-confirmation">
										{workout.loadKg === null ? (
											<Button
												size="sm"
												variant="ghost"
												disabled={model.busy}
												onClick={() => workout.setLoadKg(15)}
											>
												选用 15 kg
											</Button>
										) : (
											<Button
												size="sm"
												variant="ghost"
												disabled={model.busy}
												onClick={() => workout.setLoadKg(null)}
											>
												清除负重
											</Button>
										)}
										<span className="field-hint">
											{workout.loadKg === null
												? "未选负重不写入；15 kg 是快捷预设，非安全建议"
												: "每档 5 kg，按实际器械与自身状态选择"}
										</span>
									</div>
									<Button
										className="workout-cues-button"
										variant="ghost"
										onClick={(event) => openPreview(step.exercise.exerciseId, event.currentTarget)}
									>
										<BookOpen size={16} /> 回顾动作要领
									</Button>
								</>
							) : step ? (
								<div className="cardio-controls">
									<NumberStepper
										label="实际分钟"
										value={workout.minutes ?? Math.min(180, Math.floor(workout.stepSeconds / 60))}
										max={180}
										unit="分钟"
										disabled={model.busy}
										onChange={workout.setMinutes}
									/>
									<Choice
										disabled={model.busy}
										label="实际强度"
										value={workout.intensity}
										onChange={(value) => workout.setIntensity(value as CardioIntensity)}
										options={cardioIntensityOptions}
									/>
									<p className="field-hint">
										{workout.minutes === null
											? "完成后自动记录精确用时；左右键可修正分钟。"
											: "保存调整后的分钟数，原始计时仍保留。"}
									</p>
								</div>
							) : null}
						</section>
						<aside className="workout-context">
							{step?.kind === "strength" && (
								<>
									<img
										src={getExercise(step.exercise.exerciseId).asset.posterPath}
										alt={`${title}静态动作预览（未审核示意）`}
									/>
									<ol className="cue-list">
										{chineseCues[step.exercise.exerciseId].map((cue) => (
											<li key={cue}>{cue}</li>
										))}
									</ol>
									<p className="field-hint">
										动作预览尚未经专业审核。疼痛或不确定时停止并咨询专业人员。
									</p>
								</>
							)}
							<h2 className="card-title">本场时间轴</h2>
							<div className="workout-mini-timeline">
								{editor.target.blocks.map((block, i) => (
									<span key={block.cardio?.id ?? i}>
										{block.cardio
											? cardioNames[block.cardio.role]
											: `力量 · ${block.exercises.length} 个动作`}
										<small>{block.durationMinutes} 分钟</small>
									</span>
								))}
							</div>
						</aside>
					</div>
				)}
			</div>
			<footer className="workout-actions">
				<div className="workout-save-state" role="status">
					{model.busy
						? "正在保存，请稍候…"
						: workout.dirty
							? "有未保存的调整"
							: `已保存 · v${session.version}`}
				</div>
				<div className="workout-action-row">
					{prep ? (
						<>
							<Button
								variant="secondary"
								disabled={model.busy}
								onClick={() => void workout.saveDraft()}
							>
								<Save size={16} /> 保存准备
							</Button>
							<Button loading={model.busy} onClick={() => void workout.begin()}>
								<Play size={16} /> 确认并开始
							</Button>
						</>
					) : showPlan ? (
						<>
							<Button
								variant="secondary"
								disabled={model.busy}
								onClick={(event) =>
									finished
										? leave()
										: manual
											? openEnding(event.currentTarget)
											: workout.setOverview(false)
								}
							>
								{finished ? "返回上一页" : manual ? "结束并保存" : "继续训练"}
							</Button>
							<Button loading={model.busy} onClick={() => void workout.saveEdits()}>
								<Save size={16} /> 保存调整
							</Button>
						</>
					) : (
						<>
							<Button
								variant="secondary"
								disabled={model.busy}
								onClick={() => workout.setOverview(true)}
							>
								<ListChecks size={16} /> 计划 / 记录
							</Button>
							{step ? (
								<Button
									loading={model.busy}
									onClick={() => void (entry ? workout.record() : workout.startCurrent())}
								>
									{entry ? <Check size={18} /> : <Play size={18} />}
									{entry
										? step.kind === "strength"
											? "完成本组并保存"
											: "完成本段并保存"
										: "开始下一组 / 段"}
								</Button>
							) : (
								<Button onClick={(event) => openEnding(event.currentTarget)}>
									<Flag size={16} /> 结束训练
								</Button>
							)}
						</>
					)}
				</div>
				{!showPlan && step && (
					<Button
						variant="ghost"
						size="sm"
						disabled={model.busy}
						onClick={() => {
							if (window.confirm("跳过当前组 / 段？不会记为完成。")) void workout.record(true);
						}}
					>
						跳过本组 / 段 <ChevronRight size={13} />
					</Button>
				)}
			</footer>
			<Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
				<DialogContent
					className="workout-preview"
					size="lg"
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						previewTrigger.current?.focus();
					}}
				>
					<DialogTitle>{preview ? exerciseNames[preview] : "动作预览"}</DialogTitle>
					<DialogDescription>未审核示意，不是专业指导。查看期间训练计时继续。</DialogDescription>
					{preview && (
						<>
							<Suspense fallback={<LayerCard.Loading label="加载动作预览" />}>
								<LazyExerciseViewer key={preview} exerciseId={preview} compact />
							</Suspense>
							<ol className="cue-list">
								{chineseCues[preview].map((cue) => (
									<li key={cue}>{cue}</li>
								))}
							</ol>
						</>
					)}
					<Button onClick={() => setPreviewOpen(false)}>回到训练</Button>
				</DialogContent>
			</Dialog>
			<Dialog open={ending} onOpenChange={setEnding}>
				<DialogContent
					className="workout-ending"
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						endingTrigger.current?.focus();
					}}
				>
					<DialogHeader>
						<DialogTitle>结束这场训练？</DialogTitle>
						<DialogDescription className="workout-ending-description">
							已记录 {completed} / {workout.steps.length}{" "}
							组或段。正在进行但尚未保存的这一组不会自动计入，已保存记录会保留。
						</DialogDescription>
					</DialogHeader>
					<div className="workout-ending-time">
						<span className="field-hint">
							<Timer size={16} aria-hidden="true" /> 总用时
						</span>
						<strong className="metric-value">
							{editor.actual.timing ? clockLabel(workout.totalSeconds) : "未计时"}
						</strong>
					</div>
					{model.error && (
						<p role="alert" className="error-message">
							{model.error}
						</p>
					)}
					<div className="form-stack">
						<Field
							disabled={model.busy}
							label="训练备注"
							value={editor.actual.notes}
							onChange={(notes) => editor.setActual({ ...editor.actual, notes })}
						/>
						<Choice
							disabled={model.busy}
							label="有疼痛或明显不适吗？"
							value={editor.actual.painFlag ? "yes" : "no"}
							onChange={(value) =>
								editor.setActual({ ...editor.actual, painFlag: value === "yes" })
							}
							options={[
								{ value: "no", label: "没有" },
								{ value: "yes", label: "有，停止并复盘" },
							]}
						/>
					</div>
					<DialogFooter className="workout-ending-actions">
						<Button variant="ghost" disabled={model.busy} onClick={() => setEnding(false)}>
							继续训练
						</Button>
						<Button
							loading={model.busy}
							onClick={async () => {
								if (await workout.finish()) setEnding(false);
							}}
						>
							<Flag size={16} /> 确认结束并保存
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
