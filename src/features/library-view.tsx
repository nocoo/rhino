import { Button, LayerCard } from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { SectionRule } from "@nocoo/basalt/components/section-rule";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@nocoo/basalt/components/tabs";
import { ArrowUpRight, BookOpen, Info, Play } from "lucide-react";
import { lazy, Suspense, useState } from "react";
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
		"双脚约与髋同宽，膝盖微屈，双臂伸长但不强行锁死，哑铃靠近大腿前侧。",
		"从髋部向后折叠，保持膝屈幅度相对稳定，脊柱与颈部保持自然中立；哑铃沿腿部下放。",
		"只下放到能保持姿势且无痛的位置，不追求触地或统一深度。伸髋站直，避免顶髋后仰；不确定时先请教练指导。",
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
	"dumbbell-curl": [
		"双手各握一只哑铃，站稳，手臂自然垂在身体两侧。",
		"屈肘将哑铃弯向肩部，再有控制地放下，尽量保持上臂稳定。",
		"弯举时呼气，放下时吸气。避免身体摆动借力。",
	],
	"triceps-kickback": [
		"髋部后移并保持躯干稳定，双手各握一只哑铃，上臂靠近身体。",
		"伸直手肘将哑铃向后送，再屈肘回位，尽量不移动上臂。",
		"伸肘时呼气，回位时吸气。避免弓背或甩动哑铃。",
	],
	"lateral-raise": [
		"双手各握一只较轻的哑铃，手臂在身体两侧，手肘微屈。",
		"双臂向两侧抬至舒适高度，再缓慢放下。",
		"抬起时呼气，放下时吸气。避免耸肩、摆动或在疼痛范围内继续。",
	],
	"bent-over-row": [
		"双手各握一只哑铃，屈髋俯身、膝盖微屈，背部保持舒适稳定。",
		"手肘向髋部方向拉，再有控制地放下，躯干保持不动。",
		"拉起时呼气，放下时吸气。避免弓背、扭转或耸肩。",
	],
	"calf-raise": [
		"双手各握一只哑铃，双脚约与髋同宽；如需平衡可轻扶稳固支撑。",
		"双脚跟抬起，短暂停留，再有控制地落下。",
		"抬起时呼气，落下时吸气。避免弹震或把重量压向脚外侧。",
	],
};

function RomanianDeadliftVideo() {
	const [loaded, setLoaded] = useState(false);
	return (
		<LayerCard className="reference-video">
			<LayerCard.Header>
				<h2>真人动作参考 · 哑铃罗马尼亚硬拉</h2>
			</LayerCard.Header>
			<LayerCard.Body className="stack">
				{loaded ? (
					<iframe
						src="https://www.youtube-nocookie.com/embed/aa57T45iFSE?hl=zh-CN&cc_lang_pref=zh-Hans"
						title="NASM 官方：哑铃罗马尼亚硬拉真人示范"
						allow="encrypted-media; picture-in-picture; fullscreen"
						referrerPolicy="strict-origin-when-cross-origin"
						allowFullScreen
					/>
				) : (
					<div className="video-consent">
						<Play size={32} aria-hidden="true" />
						<p>由美国国家运动医学学会（NASM）发布</p>
						<p className="field-hint">
							点击后连接 YouTube，并向其发送网络信息。视频为英文，不会自动播放。
						</p>
						<Button onClick={() => setLoaded(true)}>加载 YouTube 视频</Button>
					</div>
				)}
				<p className="field-hint">
					无法播放？网络、地区或发布方限制可能影响嵌入；可打开原视频查看。视频不是个人训练处方，三维模型也未获
					NASM 认证。
				</p>
				<Button asChild variant="secondary">
					<a
						href="https://www.youtube.com/watch?v=aa57T45iFSE"
						target="_blank"
						rel="noopener noreferrer"
					>
						在 YouTube 查看原视频 <ArrowUpRight size={15} />
					</a>
				</Button>
			</LayerCard.Body>
		</LayerCard>
	);
}

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
						<BookOpen size={13} /> {EXERCISES.length} 个动作预览
					</span>
				}
			/>
			<div className="library-layout">
				<nav className="stack library-nav" aria-label="选择训练动作">
					{EXERCISES.map((item, index) => (
						<Button
							key={item.id}
							variant={selected === item.id ? "secondary" : "ghost"}
							className="library-item"
							aria-pressed={selected === item.id}
							onClick={() => select(item.id)}
						>
							<span className="mono muted">{String(index + 1).padStart(2, "0")}</span>
							<span>
								{exerciseNames[item.id]}
								<small>
									{item.muscles
										.filter((muscle) => muscle.role === "primary")
										.map((muscle) => muscle.name)
										.join(" · ")}
								</small>
							</span>
							{selected === item.id && <ArrowUpRight size={15} />}
						</Button>
					))}
				</nav>
				<div className="stack">
					<Tabs key={selected} defaultValue="model">
						<TabsList aria-label="动作参考方式">
							<TabsTrigger value="model">三维示意</TabsTrigger>
							{selected === "romanian-deadlift" && (
								<TabsTrigger value="video">真人视频</TabsTrigger>
							)}
						</TabsList>
						<TabsContent value="model">
							<Suspense fallback={<LayerCard.Loading label="正在准备三维视图" />}>
								<LazyExerciseViewer exerciseId={selected} />
							</Suspense>
						</TabsContent>
						{selected === "romanian-deadlift" && (
							<TabsContent value="video">
								<RomanianDeadliftVideo />
							</TabsContent>
						)}
					</Tabs>
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
								<span className="eyebrow muted">动作要点</span>
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
