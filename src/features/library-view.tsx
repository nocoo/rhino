import { Button, LayerCard } from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { SectionRule } from "@nocoo/basalt/components/section-rule";
import { ArrowUpRight, BookOpen, Info } from "lucide-react";
import { lazy, Suspense } from "react";
import { exerciseNames } from "../components/workout-summary";
import { EXERCISES } from "../data/exercises";
import type { StrengthExerciseId } from "../domain/contracts";

export const LazyExerciseViewer = lazy(() =>
	import("../components/exercise-viewer").then((module) => ({ default: module.ExerciseViewer })),
);
const chineseCues: Record<StrengthExerciseId, [string, string, string]> = {
	"goblet-squat": [
		"双手将哑铃贴近胸前，双脚约与肩同宽。",
		"髋部向后下方移动，膝盖沿脚尖方向，脚跟保持着地。",
		"下蹲时吸气，站起时呼气。不要为追求深度牺牲控制。",
	],
	"romanian-deadlift": [
		"双手各握一只哑铃，膝盖微屈，肋骨与骨盆保持稳定。",
		"髋部向后推，哑铃贴近腿部，下放至大腿后侧产生拉伸感。",
		"下降时吸气，伸髋时呼气。避免弓背和锁死膝盖。",
	],
	"chest-press": [
		"调节座椅，让把手与胸部中段对齐，背部贴稳靠垫。",
		"肩膀远离耳朵，平稳向前推至手肘接近伸直，再缓慢回位。",
		"推起时呼气，回位时吸气。不要让配重块撞击。",
	],
	"cable-row": [
		"坐稳，膝盖微屈，握住把手，背部保持自然中立。",
		"将把手拉向腹部，手肘向后移动，不用腰部前后摆动借力。",
		"拉回时呼气，伸臂时吸气。避免耸肩。",
	],
	"lat-pulldown": [
		"调整腿垫，双脚着地，握住横杆，握距略宽于肩。",
		"手肘向下靠近身体两侧，将横杆拉向上胸，再有控制地回放。",
		"下拉时呼气。不要将横杆拉到颈后或猛烈后仰。",
	],
	"shoulder-press": [
		"双手各握一只哑铃，保持躯干稳定，哑铃在肩部两侧。",
		"沿舒适路径向上推起，不锁死手肘，然后缓慢降低。",
		"推起时呼气。避免用过度腰椎后仰换取举起高度。",
	],
};

export function LibraryView({
	selected,
	select,
}: {
	selected: StrengthExerciseId;
	select: (id: StrengthExerciseId) => void;
}) {
	const exercise = EXERCISES.find((item) => item.id === selected) ?? EXERCISES[0];
	return (
		<div className="page-body">
			<PageHeader
				title="每一个动作，都值得做好。"
				description="观察动作路径，理解目标肌群。旋转视角，按自己的速度学习。"
				actions={
					<span className="pill">
						<BookOpen size={13} /> 6 个基础动作
					</span>
				}
			/>
			<div className="library-layout">
				<div className="stack library-nav">
					{EXERCISES.map((item, index) => (
						<Button
							key={item.id}
							variant={selected === item.id ? "secondary" : "ghost"}
							className="library-item"
							onClick={() => select(item.id)}
						>
							<span className="mono muted">{String(index + 1).padStart(2, "0")}</span>
							<span>
								{exerciseNames[item.id]}
								<small>{item.name}</small>
							</span>
							{selected === item.id && <ArrowUpRight size={15} />}
						</Button>
					))}
				</div>
				<div className="stack">
					<Suspense fallback={<LayerCard.Loading label="正在准备三维视图" />}>
						<LazyExerciseViewer key={selected} exerciseId={selected} />
					</Suspense>
					<details>
						<summary className="field-hint">查看静态动作阶段（未审核示意）</summary>
						<img
							src={exercise.asset.posterPath}
							alt={`${exerciseNames[selected]}的起始与中间阶段`}
							width={680}
							height={420}
							style={{ width: "100%", height: "auto", borderRadius: 12 }}
							loading="lazy"
						/>
					</details>
					<LayerCard>
						<LayerCard.Header className="workout-heading">
							<div>
								<span className="eyebrow muted">TECHNIQUE NOTES</span>
								<h2>{exerciseNames[selected]}</h2>
							</div>
							<span className="pill">
								{exercise.loadConvention === "per-hand" ? "负重按每只哑铃记录" : "负重按总重量记录"}
							</span>
						</LayerCard.Header>
						<LayerCard.Body className="technique-grid">
							<SectionRule title="动作要点">
								<ol className="cue-list">
									{chineseCues[selected].map((cue) => (
										<li key={cue}>{cue}</li>
									))}
								</ol>
							</SectionRule>
							<SectionRule title="肌群参与">
								<div>
									{exercise.muscles.map((muscle) => (
										<div key={muscle.id} className="exercise-row">
											<span className="muscle-dot" />
											<span style={{ fontSize: 12 }}>{muscle.name}</span>
											<span className="muted" style={{ marginLeft: "auto", fontSize: 11 }}>
												{muscle.role === "primary" ? "主要" : "辅助"}
											</span>
										</div>
									))}
								</div>
							</SectionRule>
						</LayerCard.Body>
					</LayerCard>
					<p className="coach-note">
						<Info size={17} />{" "}
						肌群高亮是区域示意，不是精确的组织分割或激活测量。动作不适合所有人；疼痛或动作不确定时应停止并咨询专业人员。
					</p>
				</div>
			</div>
		</div>
	);
}
