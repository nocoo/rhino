import { Button } from "@nocoo/basalt";
import { Slider } from "@nocoo/basalt/components/slider";
import { Focus, Layers3, Pause, Play, RotateCcw, RotateCw, View } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { StrengthExerciseId } from "../domain/contracts";
import { createExerciseScene, type SceneController } from "../three/exercise-scene";

export function ExerciseViewer({
	exerciseId,
	compact = false,
}: {
	exerciseId: StrengthExerciseId;
	compact?: boolean;
}) {
	const host = useRef<HTMLDivElement>(null);
	const controller = useRef<SceneController | null>(null);
	const [playing, setPlaying] = useState(false);
	const [progress, setProgress] = useState(0);
	const [muscles, setMuscles] = useState(true);
	const [loading, setLoading] = useState(true);
	const [failed, setFailed] = useState(false);
	const initialId = useRef(exerciseId);
	initialId.current = exerciseId;
	useEffect(() => {
		if (!host.current) return;
		let cancelled = false;
		createExerciseScene(host.current, initialId.current, setProgress, () => setFailed(true))
			.then((scene) => {
				if (cancelled) {
					scene.dispose();
					return;
				}
				controller.current = scene;
				scene.setExercise(initialId.current);
				setLoading(false);
			})
			.catch(() => {
				if (!cancelled) {
					setFailed(true);
					setLoading(false);
				}
			});
		return () => {
			cancelled = true;
			controller.current?.dispose();
			controller.current = null;
		};
	}, []);
	useEffect(() => {
		controller.current?.setExercise(exerciseId);
		setPlaying(false);
		controller.current?.setPlaying(false);
	}, [exerciseId]);
	return (
		<section className={`movement-viewer ${compact ? "compact" : ""}`} aria-label="三维动作演示">
			<div className="stage-top">
				<span className="eyebrow">MOVEMENT LAB</span>
				<span className="stage-status">
					<span /> 3D · 交互演示
				</span>
			</div>
			<div className="stage-controls">
				<div className="stage-legend">
					<span className="muscle-dot" /> 目标肌群区域{" "}
					<span className="muted">· 非肌肉激活测量</span>
				</div>
				<div className="camera-tools">
					<Button
						variant="ghost"
						size="icon"
						aria-label="正面视角"
						disabled={loading || failed}
						onClick={() => controller.current?.setCamera("front")}
					>
						<View size={17} />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						aria-label="侧面视角"
						disabled={loading || failed}
						onClick={() => controller.current?.setCamera("side")}
					>
						<RotateCcw size={17} />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						aria-label="背面视角"
						disabled={loading || failed}
						onClick={() => controller.current?.setCamera("rear")}
					>
						<RotateCw size={17} />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						aria-label="局部细节"
						disabled={loading || failed}
						onClick={() => controller.current?.setCamera("detail")}
					>
						<Focus size={17} />
					</Button>
					<Button
						variant={muscles ? "secondary" : "ghost"}
						size="icon"
						aria-label="切换肌群高亮"
						aria-pressed={muscles}
						disabled={loading || failed}
						onClick={() => {
							setMuscles(!muscles);
							controller.current?.setMuscles(!muscles);
						}}
					>
						<Layers3 size={17} />
					</Button>
				</div>
			</div>
			<div className="stage-viewport">
				<div className="anatomy-stage" ref={host} />
				{failed && (
					<img
						className="stage-poster"
						src={`/models/exercises/${exerciseId}.png`}
						alt="动作起始与中间阶段的静态示意，尚未经专业审核"
					/>
				)}
				{(loading || failed) && (
					<div className="stage-message" role="status">
						{failed ? "三维视图暂不可用，请阅读下方动作说明。" : "正在加载人体模型…"}
					</div>
				)}
			</div>
			<div className="playback-bar">
				<Button
					size="icon"
					aria-label={playing ? "暂停演示" : "播放演示"}
					disabled={loading || failed}
					onClick={() => {
						controller.current?.setPlaying(!playing);
						setPlaying(!playing);
					}}
				>
					{playing ? <Pause size={17} /> : <Play size={17} />}
				</Button>
				<Slider
					aria-label="动作进度"
					value={[progress * 100]}
					onValueChange={([value]) => {
						controller.current?.setProgress(value / 100);
						controller.current?.setPlaying(false);
						setPlaying(false);
					}}
					max={100}
					disabled={loading || failed}
				/>
				<span className="mono">{progress < 0.5 ? "去程" : "回程"} / 0.65×</span>
			</div>
			<p className="instruction-notice">
				动作与肌群为示意，尚未经专业教练审核。不要据此强求活动范围；不适时停止。
			</p>
		</section>
	);
}
