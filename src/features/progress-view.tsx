import { Button, LayerCard } from "@nocoo/basalt";
import { LineChart } from "@nocoo/basalt/charts/line";
import { StatCard, StatGrid } from "@nocoo/basalt/charts/stat-card";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@nocoo/basalt/components/table";
import { Activity, ArrowUpRight, HeartPulse, Plus, Scale, TrendingUp } from "lucide-react";
import type { RhinoModel } from "./use-rhino-model";

const sessionStatusLabels = {
	draft: "准备中",
	active: "训练中",
	completed: "已完成",
	abandoned: "已放弃",
} as const;

const sessionStatusPills = {
	draft: "pill pill-warning",
	active: "pill pill-warning",
	completed: "pill pill-success",
	abandoned: "pill pill-muted",
} as const;

export function ProgressView({
	model,
	openProfile,
}: {
	model: RhinoModel;
	openProfile: () => void;
}) {
	const points = (model.progress?.measurements ?? [])
		.filter((item) => item.kind === "weight")
		.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
	const latest = points.at(-1);
	const data = points.map((point) => ({
		x: point.effectiveDate,
		weight: point.value,
		bmi: point.bmi,
	}));
	const guidance = model.cardioGuidance;
	const clinician = model.profile?.profile?.guidance.clinicianRange;
	return (
		<div className="page-body">
			<PageHeader
				title="变化，会留下痕迹。"
				description="看长期趋势，不被单日波动定义。这里的每个数字都来自你的真实记录。"
				actions={
					<Button onClick={openProfile}>
						<Plus size={15} /> 记录身体数据
					</Button>
				}
			/>
			<StatGrid columns={3}>
				<StatCard
					label="最近体重 · kg"
					value={String(latest?.value ?? "—")}
					subtitle={latest?.effectiveDate ?? "等待第一条记录"}
					icon={Scale}
					iconColor="text-basalt-primary"
				/>
				<StatCard
					label="身体质量指数 · BMI"
					value={String(latest?.displayedBmi ?? "—")}
					subtitle="不等于体脂率，不直接决定训练强度"
					icon={TrendingUp}
					iconColor="text-basalt-primary"
				/>
				<StatCard
					label="中等强度心率参考 · bpm"
					icon={HeartPulse}
					iconColor="text-basalt-primary"
					value={
						guidance?.status === "available"
							? guidance.estimate.displayedModerateBpm.join("–")
							: guidance?.status === "clinician-override" && clinician
								? `${clinician.minBpm}–${clinician.maxBpm}`
								: "—"
					}
					subtitle={
						guidance?.status === "available"
							? "年龄估算，仅供参考，不是安全上限"
							: guidance?.status === "clinician-override"
								? "手动录入的专业建议，不叠加通用估算"
								: "通用估算未启用，或年龄不在 18–64 岁建议范围内"
					}
				/>
			</StatGrid>
			<div className="plan-grid">
				<LayerCard className="chart-card">
					<LayerCard.Header className="card-footer">
						<h2 className="card-title">
							<Scale size={17} /> 体重趋势
						</h2>
						<span className="eyebrow muted">体重 / 千克</span>
					</LayerCard.Header>
					<LayerCard.Body>
						{data.length ? (
							<LineChart
								data={data}
								series={[{ key: "weight", label: "体重" }]}
								className="chart"
								ariaLabel="体重趋势"
								yDomain={["auto", "auto"]}
								valueFormatter={(value) => `${value} kg`}
								xValueFormatter={(value) => String(value).slice(5)}
								summary="按真实测量日期绘制，没有记录的日期不会补零。"
							/>
						) : (
							<LayerCard.Empty
								title="还没有体重记录"
								description="记录一次体重，让趋势从这里开始。"
							/>
						)}
					</LayerCard.Body>
				</LayerCard>
				<LayerCard className="chart-card">
					<LayerCard.Header className="card-footer">
						<h2 className="card-title">
							<TrendingUp size={17} /> BMI 趋势
						</h2>
						<span className="eyebrow muted">身体质量指数</span>
					</LayerCard.Header>
					<LayerCard.Body>
						{data.some((item) => item.bmi !== null) ? (
							<LineChart
								data={data}
								series={[{ key: "bmi", label: "BMI" }]}
								className="chart"
								ariaLabel="BMI 趋势"
								yDomain={["auto", "auto"]}
								valueFormatter={(value) => value.toFixed(1)}
								xValueFormatter={(value) => String(value).slice(5)}
								summary="BMI 由测量时有效身高与体重计算，不能区分脂肪与肌肉。"
							/>
						) : (
							<LayerCard.Empty
								title="需要身高与体重"
								description="先记录有效日期不晚于体重的身高，即可计算 BMI。"
							/>
						)}
					</LayerCard.Body>
				</LayerCard>
			</div>
			<LayerCard>
				<LayerCard.Header className="card-footer">
					<h2 className="card-title">
						<Scale size={17} /> 原始测量数据
					</h2>
					<span className="pill pill-muted mono">{points.length} 条</span>
				</LayerCard.Header>
				<LayerCard.Body>
					{points.length ? (
						<div className="table-scroll">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>日期</TableHead>
										<TableHead>体重 / kg</TableHead>
										<TableHead>BMI</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{points.map((point) => (
										<TableRow key={point.id}>
											<TableCell className="mono">{point.effectiveDate}</TableCell>
											<TableCell className="mono">{point.value}</TableCell>
											<TableCell className="mono">{point.displayedBmi ?? "无有效身高"}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					) : (
						<p className="coach-note">还没有体重记录。在个人档案添加第一条测量数据。</p>
					)}
				</LayerCard.Body>
			</LayerCard>
			<LayerCard>
				<LayerCard.Header className="card-footer">
					<h2 className="card-title">
						<Activity size={17} /> 训练记录
					</h2>
					<span className="pill pill-muted mono">{model.sessions.length} 场</span>
				</LayerCard.Header>
				<LayerCard.Body>
					{model.sessions.length ? (
						<div className="table-scroll">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>日期</TableHead>
										<TableHead>训练</TableHead>
										<TableHead>状态</TableHead>
										<TableHead>操作</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{model.sessions.map((session) => (
										<TableRow key={session.id}>
											<TableCell className="mono">{session.localDate}</TableCell>
											<TableCell>
												{session.target.emphasis === "cardio" ? "有氧骑行" : "力量与有氧"}
											</TableCell>
											<TableCell>
												<span className={sessionStatusPills[session.status]}>
													{sessionStatusLabels[session.status]}
												</span>
											</TableCell>
											<TableCell>
												<Button size="sm" variant="ghost" onClick={() => model.setActive(session)}>
													查看记录
													<ArrowUpRight size={13} />
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					) : (
						<p className="coach-note">还没有训练记录。完成的训练会在这里留下痕迹。</p>
					)}
				</LayerCard.Body>
			</LayerCard>
			<div className="coach-callout">
				<p className="coach-note">
					<HeartPulse size={18} />{" "}
					<span>
						有氧训练也可以用谈话测试：中等强度时能说话但难以唱歌。用药或健康状况可能让通用心率区间不适用，身体感受比追逐数字更重要。
					</span>
				</p>
			</div>
		</div>
	);
}
