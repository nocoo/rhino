import { Button, LayerCard } from "@nocoo/basalt";
import { ArrowRight, Bike, Clock3, Dumbbell, Play } from "lucide-react";
import type { SessionTarget, StrengthExerciseId } from "../domain/contracts";

export const exerciseNames: Record<StrengthExerciseId, string> = {
	"goblet-squat": "高脚杯深蹲",
	"romanian-deadlift": "哑铃罗马尼亚硬拉",
	"chest-press": "器械推胸",
	"cable-row": "坐姿绳索划船",
	"lat-pulldown": "高位下拉",
	"shoulder-press": "哑铃肩推",
};
export const emphasisNames: Record<SessionTarget["emphasis"], string> = {
	"full-body": "全身力量",
	"full-body-a": "全身力量 · A",
	"full-body-b": "全身力量 · B",
	cardio: "有氧骑行",
	recovery: "轻松恢复",
};
const blockNames = { preparation: "热身", strength: "力量", cardio: "有氧", recovery: "放松" };

export function WorkoutSummary({
	target,
	onStart,
	onExercise,
	busy,
	subtitle,
}: {
	target: SessionTarget;
	onStart?: () => void;
	onExercise?: (id: StrengthExerciseId) => void;
	busy?: boolean;
	subtitle?: string;
}) {
	const exercises = target.blocks.flatMap((block) => block.exercises);
	return (
		<LayerCard className="workout-card">
			<LayerCard.Header className="workout-heading">
				<div>
					<span className="eyebrow muted">{subtitle ?? "YOUR NEXT SESSION"}</span>
					<h2>{emphasisNames[target.emphasis]}</h2>
				</div>
				<span className="pill">
					{exercises.length ? <Dumbbell size={12} /> : <Bike size={12} />}
					{exercises.length ? "力量 + 有氧" : "纯有氧"}
				</span>
			</LayerCard.Header>
			<LayerCard.Body>
				<div className="workout-meta">
					<span>
						<Clock3 size={14} /> 约 {target.timeBudgetMinutes} 分钟
					</span>
					<span>
						<Dumbbell size={14} /> {exercises.length} 个力量动作
					</span>
					<span>按状态微调</span>
				</div>
				<div className="allocation" role="img" aria-label="训练时间分配">
					{target.blocks.map((block) => (
						<span key={block.kind} style={{ flex: block.durationMinutes }} />
					))}
				</div>
				<div className="allocation-legend">
					{target.blocks.map((block) => (
						<span key={block.kind}>
							{blockNames[block.kind]} {block.durationMinutes}′
						</span>
					))}
				</div>
				<div className="exercise-list">
					{exercises.map((exercise, index) => (
						<div className="exercise-row" key={exercise.id}>
							<span className="exercise-index mono">{String(index + 1).padStart(2, "0")}</span>
							<div>
								<h3>{exerciseNames[exercise.exerciseId]}</h3>
								<p>组间休息 {exercise.restSeconds} 秒 · 留有余力</p>
							</div>
							<span className="prescription mono">
								{exercise.workingSets.length} × {exercise.workingSets[0]?.repsLow}-
								{exercise.workingSets[0]?.repsHigh}
							</span>
							{onExercise && (
								<Button
									size="icon"
									variant="ghost"
									aria-label={`查看${exerciseNames[exercise.exerciseId]}`}
									onClick={() => onExercise(exercise.exerciseId)}
								>
									<ArrowRight size={15} />
								</Button>
							)}
						</div>
					))}
				</div>
				{!exercises.length && (
					<p className="coach-note">
						舒适起步，逐渐进入目标强度。今天没有力量动作，也可以是一次完整的训练。
					</p>
				)}
			</LayerCard.Body>
			{onStart && (
				<LayerCard.Footer className="card-footer">
					<span className="field-hint">开始前可修改动作和组数</span>
					<Button onClick={onStart} loading={busy}>
						<Play size={14} /> 开始训练
					</Button>
				</LayerCard.Footer>
			)}
		</LayerCard>
	);
}
