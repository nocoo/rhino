import { Button, LayerCard } from "@nocoo/basalt";
import { LineChart } from "@nocoo/basalt/charts/line";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { HeartPulse, Plus, Scale, TrendingUp } from "lucide-react";
import type { RhinoModel } from "./use-rhino-model";

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
			<div className="stats-grid">
				<LayerCard padding="lg">
					<span className="stat-label">
						<Scale size={16} /> 最近体重
					</span>
					<div className="metric-value">
						{latest?.value ?? "—"}
						<small>kg</small>
					</div>
					<p className="stat-caption">{latest?.effectiveDate ?? "等待第一条记录"}</p>
				</LayerCard>
				<LayerCard padding="lg">
					<span className="stat-label">
						<TrendingUp size={16} /> 身体质量指数
					</span>
					<div className="metric-value">
						{latest?.displayedBmi ?? "—"}
						<small>BMI</small>
					</div>
					<p className="stat-caption">不等于体脂率，不直接决定训练强度</p>
				</LayerCard>
				<LayerCard padding="lg">
					<span className="stat-label">
						<HeartPulse size={16} /> 中等强度心率参考
					</span>
					<div className="metric-value">
						{guidance?.status === "available"
							? guidance.estimate.displayedModerateBpm.join("–")
							: guidance?.status === "clinician-override" && clinician
								? `${clinician.minBpm}–${clinician.maxBpm}`
								: "—"}
						<small>bpm</small>
					</div>
					<p className="stat-caption">
						{guidance?.status === "available"
							? "年龄估算，仅供参考，不是安全上限"
							: guidance?.status === "clinician-override"
								? "手动录入的专业建议，不叠加通用估算"
								: "通用估算未启用，或年龄不在 18–64 岁建议范围内"}
					</p>
				</LayerCard>
			</div>
			<div className="plan-grid">
				<LayerCard padding="lg" className="chart-card">
					<h2 className="card-title">
						体重趋势 <span className="eyebrow muted">WEIGHT / KG</span>
					</h2>
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
				</LayerCard>
				<LayerCard padding="lg" className="chart-card">
					<h2 className="card-title">
						BMI 趋势 <span className="eyebrow muted">BODY MASS INDEX</span>
					</h2>
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
				</LayerCard>
			</div>
			<LayerCard padding="lg">
				<h2 className="card-title">原始测量数据</h2>
				<table className="small-table">
					<thead>
						<tr>
							<th>日期</th>
							<th>体重 / kg</th>
							<th>BMI</th>
						</tr>
					</thead>
					<tbody>
						{points.map((point) => (
							<tr key={point.id}>
								<td className="mono">{point.effectiveDate}</td>
								<td className="mono">{point.value}</td>
								<td className="mono">{point.displayedBmi ?? "无有效身高"}</td>
							</tr>
						))}
					</tbody>
				</table>
			</LayerCard>
			<LayerCard padding="lg">
				<h2 className="card-title">训练记录</h2>
				{model.sessions.length ? (
					<table className="small-table">
						<thead>
							<tr>
								<th>日期</th>
								<th>训练</th>
								<th>状态</th>
								<th>操作</th>
							</tr>
						</thead>
						<tbody>
							{model.sessions.map((session) => (
								<tr key={session.id}>
									<td className="mono">{session.localDate}</td>
									<td>{session.target.emphasis === "cardio" ? "有氧骑行" : "力量与有氧"}</td>
									<td>
										{
											{
												draft: "准备中",
												active: "训练中",
												completed: "已完成",
												abandoned: "已放弃",
											}[session.status]
										}
									</td>
									<td>
										<Button size="sm" variant="ghost" onClick={() => model.setActive(session)}>
											查看记录
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				) : (
					<p className="coach-note">还没有训练记录。完成的训练会在这里留下痕迹。</p>
				)}
			</LayerCard>
			<p className="coach-note">
				<HeartPulse size={18} />{" "}
				有氧训练也可以用谈话测试：中等强度时能说话但难以唱歌。用药或健康状况可能让通用心率区间不适用，身体感受比追逐数字更重要。
			</p>
		</div>
	);
}
