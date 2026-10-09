import { Button, Input, LayerCard } from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { ArrowLeft, Check, CheckCheck, Clock3, Play, Save } from "lucide-react";
import { Suspense, useState } from "react";
import { Choice, Field } from "../components/fields";
import { emphasisNames, exerciseNames } from "../components/workout-summary";
import { EXERCISES } from "../data/exercises";
import type { CardioIntensity, SessionRecord, StrengthExerciseId } from "../domain/contracts";
import { LazyExerciseViewer } from "./library-view";
import type { RhinoModel } from "./use-rhino-model";
import { useSessionModel } from "./use-session-model";

export function SessionView({
	model,
	session,
	close,
}: {
	model: RhinoModel;
	session: SessionRecord;
	close: () => void;
}) {
	const editor = useSessionModel(session);
	const exercises = editor.target.blocks.flatMap((block) => block.exercises);
	const [selected, setSelected] = useState<StrengthExerciseId>(
		exercises[0]?.exerciseId ?? "goblet-squat",
	);
	const prep = session.status === "draft";
	const save = (status: SessionRecord["status"]) =>
		void model.saveSession(session, status, editor.target, prep ? null : editor.actual);
	const cardio = editor.target.blocks.flatMap((block) => (block.cardio ? [block.cardio] : []));
	return (
		<div className="page-body">
			<PageHeader
				title={prep ? "准备好，再开始。" : emphasisNames[editor.target.emphasis]}
				description={`${session.localDate} · ${prep ? "本次调整不会修改周计划" : "只记录实际完成的训练，部分完成也有价值"}`}
				actions={
					<Button
						variant="ghost"
						onClick={() => {
							if (!editor.dirty || window.confirm("还有未保存的修改，确定离开吗？")) close();
						}}
					>
						<ArrowLeft size={15} /> 返回
					</Button>
				}
			/>
			<div className="session-layout">
				<div className="stack">
					{exercises.map((exercise, index) => (
						<LayerCard key={exercise.id} padding="lg">
							<div className="workout-heading">
								<h2 style={{ fontSize: 19 }}>
									{String(index + 1).padStart(2, "0")} · {exerciseNames[exercise.exerciseId]}
								</h2>
								<Button variant="ghost" size="sm" onClick={() => setSelected(exercise.exerciseId)}>
									查看动作
								</Button>
							</div>
							{prep ? (
								<div className="form-grid" style={{ marginTop: 20 }}>
									<Choice
										label="训练动作"
										value={exercise.exerciseId}
										onChange={(value) => editor.updateExercise(index, value as StrengthExerciseId)}
										options={EXERCISES.filter((item) =>
											(model.profile?.profile?.preferences.equipmentIds ?? []).includes(
												item.equipmentId,
											),
										).map((item) => ({ value: item.id, label: exerciseNames[item.id] }))}
									/>
									<Field
										label="工作组数"
										type="number"
										min={1}
										max={8}
										value={exercise.workingSets.length}
										onChange={(value) => editor.setCount(index, Number(value))}
									/>
									<Field
										label="每组次数"
										type="number"
										min={1}
										max={30}
										value={exercise.workingSets[0].repsHigh}
										onChange={(value) => editor.setReps(index, Number(value))}
									/>
								</div>
							) : (
								<>
									<div className="set-row set-labels">
										<span>组</span>
										<span>次数</span>
										<span>
											负重 / kg {exercise.loadConvention === "per-hand" ? "每只" : "总重"}
										</span>
										<span>完成</span>
									</div>
									{editor.actual.exercises
										.find((item) => item.id === exercise.id)
										?.sets.map((set, i) => (
											<div key={set.id}>
												<div className="set-row">
													<span className="mono muted">{i + 1}</span>
													<Input
														type="number"
														min={0}
														max={50}
														aria-label={`${exerciseNames[exercise.exerciseId]}第${i + 1}组次数`}
														value={set.reps ?? ""}
														placeholder={String(exercise.workingSets[i].repsHigh)}
														onChange={(event) =>
															editor.updateSet(exercise.id, set.id, {
																reps: event.target.value === "" ? null : Number(event.target.value),
															})
														}
													/>
													<Input
														type="number"
														min={0}
														step={0.5}
														aria-label={`${exerciseNames[exercise.exerciseId]}第${i + 1}组负重`}
														value={set.loadKg ?? ""}
														placeholder="未记录"
														onChange={(event) =>
															editor.updateSet(exercise.id, set.id, {
																loadKg:
																	event.target.value === "" ? null : Number(event.target.value),
															})
														}
													/>
													<Button
														size="icon"
														variant={set.status === "performed" ? "default" : "secondary"}
														aria-label={`标记${exerciseNames[exercise.exerciseId]}第${i + 1}组完成`}
														aria-pressed={set.status === "performed"}
														onClick={() => {
															editor.updateSet(exercise.id, set.id, {
																status: set.status === "performed" ? "not-recorded" : "performed",
																reps: set.reps ?? exercise.workingSets[i].repsHigh,
															});
															editor.startRest(exercise.restSeconds);
														}}
													>
														<Check size={16} />
													</Button>
												</div>
												<div className="set-extras">
													<Field
														label={`第${i + 1}组余力（RIR）`}
														type="number"
														min={0}
														max={10}
														value={set.rir ?? ""}
														onChange={(value) =>
															editor.updateSet(exercise.id, set.id, {
																rir: value === "" ? null : Number(value),
															})
														}
														hint="不确定可以不填"
													/>
													<Button
														variant="ghost"
														size="sm"
														aria-pressed={set.status === "skipped"}
														onClick={() =>
															editor.updateSet(exercise.id, set.id, {
																status: set.status === "skipped" ? "not-recorded" : "skipped",
																reps: null,
																loadKg: null,
																rir: null,
															})
														}
													>
														{set.status === "skipped" ? "已跳过，点击撤销" : "跳过这组"}
													</Button>
												</div>
											</div>
										))}
								</>
							)}
							<p className="field-hint" style={{ marginTop: 12 }}>
								组间休息 {exercise.restSeconds} 秒 · 目标保留 2–3 次余力
							</p>
						</LayerCard>
					))}
					<LayerCard padding="lg">
						<h2 className="card-title">有氧与热身</h2>
						<div className="stack">
							{cardio.map((segment) => (
								<div key={segment.id} className="form-grid">
									<div>
										<strong style={{ fontSize: 13 }}>
											{
												{ preparation: "轻松热身", main: "主要有氧", recovery: "放松恢复" }[
													segment.role
												]
											}
										</strong>
										<p className="field-hint">
											计划 {segment.plannedMinutes} 分钟 ·{" "}
											{segment.plannedIntensity === "moderate"
												? "中等强度"
												: segment.plannedIntensity === "vigorous"
													? "高强度"
													: "轻松强度"}
										</p>
									</div>
									{prep && (
										<Field
											label="计划分钟"
											type="number"
											min={1}
											max={150}
											value={segment.plannedMinutes}
											onChange={(value) => editor.setCardioTarget(segment.id, Number(value))}
										/>
									)}
									{!prep && (
										<Field
											label="实际分钟"
											type="number"
											min={0}
											max={180}
											step={1}
											value={
												editor.actual.cardioSegments.find((item) => item.id === segment.id)
													?.actualMinutes ?? 0
											}
											onChange={(value) => editor.updateCardio(segment.id, Number(value))}
										/>
									)}
									{!prep && (
										<Choice
											label="实际强度"
											value={
												editor.actual.cardioSegments.find((item) => item.id === segment.id)
													?.intensity ?? "unknown"
											}
											onChange={(value) =>
												editor.setCardioIntensity(segment.id, value as CardioIntensity)
											}
											options={[
												{ value: "unknown", label: "未记录" },
												{ value: "easy", label: "轻松" },
												{ value: "moderate", label: "中等（能说话，难唱歌）" },
												{ value: "vigorous", label: "较高（只能说短句）" },
											]}
										/>
									)}
								</div>
							))}
						</div>
					</LayerCard>
					{!prep && (
						<LayerCard>
							<Field
								label="训练备注"
								value={editor.actual.notes}
								onChange={(value) => editor.setActual({ ...editor.actual, notes: value })}
							/>
							<Choice
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
					<LayerCard>
						<div className="card-footer" style={{ marginTop: 0 }}>
							<span className="field-hint">
								{editor.dirty ? "有尚未保存的修改" : `已保存 · v${session.version}`}
							</span>
							{prep ? (
								<Button loading={model.busy} onClick={() => save("active")}>
									<Play size={14} /> 确认并开始
								</Button>
							) : (
								<div className="form-actions" style={{ marginTop: 0 }}>
									<Button variant="secondary" onClick={editor.performedAsPlanned}>
										<CheckCheck size={15} /> 按计划完成
									</Button>
									<Button
										loading={model.busy}
										disabled={session.status === "abandoned"}
										onClick={() => save("completed")}
									>
										<Save size={15} /> 保存训练
									</Button>
								</div>
							)}
						</div>
					</LayerCard>
				</div>
				<div className="stack">
					{!!exercises.length && (
						<Suspense fallback={<LayerCard.Loading label="加载动作" />}>
							<LazyExerciseViewer key={selected} exerciseId={selected} compact />
						</Suspense>
					)}
					<LayerCard padding="lg">
						<h2 className="card-title">
							<Clock3 size={17} /> 组间恢复
						</h2>
						<div className="metric-value">
							{String(Math.floor(editor.restSeconds / 60)).padStart(2, "0")}:
							{String(editor.restSeconds % 60).padStart(2, "0")}
						</div>
						<p className="coach-note">计时只是提示。呼吸和状态恢复后，再开始下一组。</p>
						<Button
							variant="secondary"
							onClick={() => editor.startRest(120)}
							style={{ marginTop: 16 }}
						>
							开始 2 分钟休息
						</Button>
					</LayerCard>
				</div>
			</div>
		</div>
	);
}
