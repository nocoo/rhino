import { Button, LayerCard } from "@nocoo/basalt";
import { Eye } from "lucide-react";
import { Choice } from "../components/fields";
import { NumberStepper } from "../components/number-stepper";
import { emphasisNames, exerciseNames } from "../components/workout-summary";
import { EXERCISES } from "../data/exercises";
import type { SessionRecord, StrengthExerciseId } from "../domain/contracts";
import type { RhinoModel } from "./use-rhino-model";
import type { WorkoutModel } from "./use-workout-model";

export const cardioNames = { preparation: "热身", main: "主要有氧", recovery: "放松恢复" };

export function SessionPlan({
	workout,
	session,
	model,
	preview,
}: {
	workout: WorkoutModel;
	session: SessionRecord;
	model: RhinoModel;
	preview: (id: StrengthExerciseId, trigger: HTMLElement) => void;
}) {
	const { editor } = workout;
	const prep = session.status === "draft";
	const plan = [model.plans.current, ...model.plans.history].find(
		(item) => item?.revision === session.sourcePlanRevision,
	);
	const exercises = editor.target.blocks.flatMap((block) => block.exercises);
	const selectedPlan =
		plan?.template.slots.findIndex(
			(slot) => JSON.stringify(slot.target) === JSON.stringify(editor.target),
		) ?? -1;
	let elapsed = 0;
	return (
		<div className="session-plan stack">
			{prep && plan && (
				<LayerCard>
					<Choice
						disabled={model.busy}
						label="切换本次训练计划"
						value={String(selectedPlan)}
						onChange={(value) => {
							if (Number(value) >= 0)
								editor.selectTarget(plan.template.slots[Number(value)].target);
						}}
						options={[
							...(selectedPlan === -1 ? [{ value: "-1", label: "当前自定义安排" }] : []),
							...plan.template.slots.map((slot, index) => ({
								value: String(index),
								label: `方案 ${index + 1} · ${emphasisNames[slot.emphasis]} · ${slot.timeBudgetMinutes} 分钟`,
							})),
						]}
					/>
					<p className="field-hint">默认采用推荐安排；切换只影响本次草稿，不修改周计划。</p>
				</LayerCard>
			)}
			{!prep && (
				<p className="field-hint">
					本场目标已锁定，可调整实际记录；若要换计划，请先结束本场，再创建新训练。
				</p>
			)}
			{editor.target.blocks.map((block, blockIndex) => {
				const offset = elapsed;
				elapsed += block.durationMinutes;
				return (
					<section key={block.cardio?.id ?? `strength-${blockIndex}`} className="timeline-block">
						<div className="timeline-label">
							<span className="mono">{String(offset).padStart(2, "0")}′</span>
							<span>
								{block.kind === "strength" ? "力量训练" : cardioNames[block.cardio?.role ?? "main"]}{" "}
								· 约 {block.durationMinutes} 分钟
							</span>
						</div>
						{block.cardio ? (
							<LayerCard className="timeline-card">
								<strong>
									{cardioNames[block.cardio.role]} ·{" "}
									{block.cardio.modality === "cycling" ? "骑行" : "轻松活动"}
								</strong>
								<p className="field-hint">
									目标 {block.cardio.plannedMinutes} 分钟 ·{" "}
									{block.cardio.plannedIntensity === "easy" ? "轻松强度" : "按状态控制强度"}
								</p>
								<NumberStepper
									label={prep ? "计划分钟" : "实际分钟"}
									value={
										prep
											? block.cardio.plannedMinutes
											: (editor.actual.cardioSegments.find((item) => item.id === block.cardio?.id)
													?.actualMinutes ?? 0)
									}
									unit="分钟"
									min={prep ? 1 : 0}
									max={180}
									disabled={model.busy}
									onChange={(value) => {
										if (block.cardio) {
											if (prep) editor.setCardioTarget(block.cardio.id, value);
											else editor.updateCardio(block.cardio.id, value);
										}
									}}
								/>
							</LayerCard>
						) : (
							block.exercises.map((exercise) => (
								<LayerCard key={exercise.id} className="timeline-card">
									<div className="card-footer">
										<h2 className="card-title">{exerciseNames[exercise.exerciseId]}</h2>
										<Button
											variant="ghost"
											size="sm"
											onClick={(event) => preview(exercise.exerciseId, event.currentTarget)}
										>
											<Eye size={15} /> 动作预览
										</Button>
									</div>
									<p className="field-hint">
										{exercise.workingSets.length} 组 × {exercise.workingSets[0].repsHigh} 次 ·
										组间休息 {exercise.restSeconds} 秒
										{exercise.warmUpSetCount > 0
											? ` · 另有 ${exercise.warmUpSetCount} 组轻负重适应`
											: ""}
									</p>
									{prep ? (
										<>
											<Choice
												disabled={model.busy}
												label="训练动作"
												value={exercise.exerciseId}
												onChange={(id) =>
													editor.updateExercise(
														exercises.indexOf(exercise),
														id as StrengthExerciseId,
													)
												}
												options={EXERCISES.filter(
													(item) =>
														item.id === exercise.exerciseId ||
														(model.profile?.profile?.preferences.equipmentIds ?? []).includes(
															item.equipmentId,
														),
												).map((item) => ({ value: item.id, label: exerciseNames[item.id] }))}
											/>
											<div className="stepper-pair">
												<NumberStepper
													label="工作组数"
													value={exercise.workingSets.length}
													min={1}
													max={8}
													unit="组"
													disabled={model.busy}
													onChange={(value) => editor.setCount(exercises.indexOf(exercise), value)}
												/>
												<NumberStepper
													label="每组次数"
													value={exercise.workingSets[0].repsHigh}
													min={1}
													max={30}
													unit="次"
													disabled={model.busy}
													onChange={(value) => editor.setReps(exercises.indexOf(exercise), value)}
												/>
											</div>
										</>
									) : (
										editor.actual.exercises
											.find((item) => item.id === exercise.id)
											?.sets.map((set, i) => (
												<div key={set.id} className="recorded-set">
													<div className="card-footer">
														<strong className="field-hint">
															第 {i + 1} 组 ·{" "}
															{set.status === "performed"
																? "已完成"
																: set.status === "skipped"
																	? "已跳过"
																	: "未记录"}
														</strong>
														<Button
															size="sm"
															variant="ghost"
															disabled={model.busy}
															onClick={() =>
																editor.updateSet(exercise.id, set.id, {
																	status: set.status === "skipped" ? "not-recorded" : "skipped",
																	reps: null,
																	loadKg: null,
																	rir: null,
																})
															}
														>
															{set.status === "skipped" ? "撤销跳过" : "跳过这组"}
														</Button>
													</div>
													<div className="stepper-pair">
														<NumberStepper
															label={`第${i + 1}组次数`}
															value={set.reps ?? 0}
															max={50}
															unit="次"
															disabled={model.busy}
															onChange={(value) =>
																editor.updateSet(exercise.id, set.id, {
																	reps: value,
																	status: "performed",
																})
															}
														/>
														<NumberStepper
															label={`第${i + 1}组负重`}
															value={set.loadKg ?? 0}
															max={500}
															step={5}
															unit={exercise.loadConvention === "per-hand" ? "kg/只" : "kg"}
															disabled={model.busy}
															onChange={(value) =>
																editor.updateSet(exercise.id, set.id, { loadKg: value })
															}
														/>
													</div>
													<NumberStepper
														label={`第${i + 1}组余力`}
														value={set.rir ?? 0}
														max={10}
														unit={set.rir === null ? "未记录" : "次"}
														disabled={model.busy}
														onChange={(value) =>
															editor.updateSet(exercise.id, set.id, { rir: value })
														}
													/>
													<span className="field-hint">
														{set.loadKg === null ? "未记录负重" : `实际 ${set.loadKg} kg`}
													</span>
												</div>
											))
									)}
								</LayerCard>
							))
						)}
					</section>
				);
			})}
		</div>
	);
}
