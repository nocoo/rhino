import { Button, DescriptionList, LayerCard } from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { SectionRule } from "@nocoo/basalt/components/section-rule";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@nocoo/basalt/components/table";
import { ArrowLeft, Pencil, Play } from "lucide-react";
import { emphasisNames, exerciseNames, WorkoutSummary } from "../components/workout-summary";
import { recordedWork } from "../domain/calendar";
import type { SessionRecord } from "../domain/contracts";
import { clockLabel, elapsedSeconds } from "../domain/workout";
import { cardioIntensityOptions, cardioNames } from "./session-plan";
import type { RhinoModel } from "./use-rhino-model";

export const sessionStatusNames = {
	draft: "准备中",
	active: "进行中",
	completed: "已完成",
	abandoned: "已结束",
};

export function SessionReview({
	session,
	model,
	close,
}: {
	session: SessionRecord;
	model: RhinoModel;
	close: () => void;
}) {
	const actual = recordedWork(session);
	return (
		<div className="page-body session-review">
			<PageHeader
				title={emphasisNames[session.target.emphasis]}
				description={`${session.localDate} · ${sessionStatusNames[session.status]} · ${session.sourcePlanRevision ? `计划 v${session.sourcePlanRevision}` : "独立训练"}`}
				actions={
					<>
						<Button variant="ghost" onClick={close}>
							<ArrowLeft size={16} /> 返回日历
						</Button>
						<Button variant="secondary" onClick={() => model.openSession(session, "edit")}>
							<Pencil size={16} /> 修改记录
						</Button>
						{(session.status === "draft" || session.status === "active") && (
							<Button onClick={() => model.openSession(session)}>
								<Play size={16} /> 继续训练
							</Button>
						)}
					</>
				}
			/>
			<LayerCard>
				<DescriptionList columns={2}>
					<DescriptionList.Item term="实际力量">
						{session.actual ? `${actual.sets} 组` : "未记录"}
					</DescriptionList.Item>
					<DescriptionList.Item term="实际有氧">
						{session.actual ? `${Math.round(actual.minutes * 10) / 10} 分钟` : "未记录"}
					</DescriptionList.Item>
					<DescriptionList.Item term="累计计时">
						{session.actual?.timing
							? clockLabel(
									elapsedSeconds(
										session.actual.timing.startedAt,
										session.actual.timing.endedAt,
										Date.now(),
									),
								)
							: "未计时"}
					</DescriptionList.Item>
					<DescriptionList.Item term="主观强度">
						{session.actual?.perceivedEffort ?? "未记录"}
					</DescriptionList.Item>
					<DescriptionList.Item term="疼痛或不适">
						{session.actual ? (session.actual.painFlag ? "有" : "没有") : "未记录"}
					</DescriptionList.Item>
					<DescriptionList.Item term="训练备注">
						{session.actual?.notes || "未填写"}
					</DescriptionList.Item>
				</DescriptionList>
			</LayerCard>
			<SectionRule title="实际训练明细" />
			{session.actual ? (
				<Table aria-label="实际训练明细">
					<TableHeader>
						<TableRow>
							<TableHead>动作 / 段</TableHead>
							<TableHead>实际记录</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{session.target.blocks
							.flatMap((block) => block.exercises)
							.flatMap((exercise) =>
								session.actual?.exercises
									.find((item) => item.id === exercise.id)
									?.sets.map((set, index) => (
										<TableRow key={set.id}>
											<TableCell>
												{exerciseNames[exercise.exerciseId]} · 第 {index + 1} 组
											</TableCell>
											<TableCell>
												{set.status === "performed"
													? `${set.reps ?? "未记录"} 次 · ${set.loadKg ?? "未记录"} ${exercise.loadConvention === "per-hand" ? "kg/只" : "kg"} · 余力 ${set.rir ?? "未记录"}`
													: set.status === "skipped"
														? "已跳过"
														: "未记录"}
											</TableCell>
										</TableRow>
									)),
							)}
						{session.actual.cardioSegments.map((segment) => (
							<TableRow key={segment.id}>
								<TableCell>{cardioNames[segment.role]}</TableCell>
								<TableCell>
									{segment.actualMinutes} 分钟 ·{" "}
									{cardioIntensityOptions.find((item) => item.value === segment.intensity)?.label}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			) : (
				<p className="field-hint">尚未记录实际训练量。</p>
			)}
			<SectionRule title="当时的计划" />
			<WorkoutSummary target={session.target} subtitle="计划目标，不代表实际完成量" />
		</div>
	);
}
