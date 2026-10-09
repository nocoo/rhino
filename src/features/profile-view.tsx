import { Button, LayerCard } from "@nocoo/basalt";
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
import { HeartPulse, Ruler, Scale, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Choice, Field } from "../components/fields";
import { EQUIPMENT } from "../data/exercises";
import { useProfileModel } from "./use-profile-model";
import type { RhinoModel } from "./use-rhino-model";

export function ProfileView({ model }: { model: RhinoModel }) {
	const current = model.profile?.profile;
	const editor = useProfileModel(model);
	const [weight, setWeight] = useState("");
	const [height, setHeight] = useState("");
	const [date, setDate] = useState(model.today);
	return (
		<div className="page-body">
			<PageHeader
				title="了解自己，再出发。"
				description="身体数据只属于你。记录变化，不急着给自己下结论。"
			/>
			<div className="profile-layout">
				<LayerCard>
					<LayerCard.Header>
						<h2 className="card-title">
							<ShieldCheck size={18} /> 个人档案
						</h2>
					</LayerCard.Header>
					<LayerCard.Body>
						<form
							className="form-stack"
							onSubmit={(event) => {
								event.preventDefault();
								void editor.save();
							}}
						>
							<div className="form-grid">
								<Field
									label="生日"
									type="date"
									value={editor.birthday}
									onChange={editor.setBirthday}
									hint="用于估算年龄和心率；不会用年龄推算力量负重。"
								/>
								<Field
									label="时区"
									value={editor.timezone}
									onChange={editor.setTimezone}
									required
								/>
								<Choice
									label="有氧心率建议"
									value={editor.mode}
									onChange={(value) => editor.setMode(value as typeof editor.mode)}
									options={[
										{ value: "generic-estimates", label: "显示通用估算" },
										{ value: "disabled", label: "不使用通用估算" },
										{ value: "clinician-range", label: "使用专业人员给定区间" },
									]}
								/>
								<Field
									label="体重记录间隔（天）"
									type="number"
									min={1}
									max={90}
									value={editor.preferences.weighInCadenceDays ?? ""}
									onChange={(value) =>
										editor.preference("weighInCadenceDays", value === "" ? null : Number(value))
									}
									hint="留空可关闭提醒；提醒仅在站内显示。"
								/>
								<Choice
									label="训练经验"
									value={editor.preferences.experience}
									onChange={(value) =>
										editor.preference("experience", value as typeof editor.preferences.experience)
									}
									options={[
										{ value: "beginner", label: "刚开始规律训练" },
										{ value: "returning", label: "恢复训练" },
									]}
								/>
							</div>
							{editor.mode === "clinician-range" && (
								<div className="form-grid">
									<Field
										label="专业建议下限（bpm）"
										type="number"
										min={40}
										max={220}
										value={editor.range.minBpm}
										onChange={(value) =>
											editor.setRange({ ...editor.range, minBpm: Number(value) })
										}
										required
									/>
									<Field
										label="专业建议上限（bpm）"
										type="number"
										min={40}
										max={220}
										value={editor.range.maxBpm}
										onChange={(value) =>
											editor.setRange({ ...editor.range, maxBpm: Number(value) })
										}
										required
									/>
									<Field
										label="建议生效日期"
										type="date"
										value={editor.range.effectiveDate}
										onChange={(value) => editor.setRange({ ...editor.range, effectiveDate: value })}
										required
									/>
									<Field
										label="建议来源"
										value={editor.range.sourceNote}
										onChange={(value) => editor.setRange({ ...editor.range, sourceNote: value })}
										hint="仅记录已获得的专业建议，不是系统处方。"
									/>
								</div>
							)}
							<SectionRule title="可用器械">
								<div className="form-actions">
									{EQUIPMENT.map((item) => (
										<Button
											key={item.id}
											type="button"
											size="sm"
											variant={
												editor.preferences.equipmentIds.includes(item.id) ? "secondary" : "ghost"
											}
											aria-pressed={editor.preferences.equipmentIds.includes(item.id)}
											onClick={() => editor.toggleEquipment(item.id)}
										>
											{
												{
													dumbbell: "哑铃",
													bench: "训练凳",
													"cable-machine": "坐姿划船机",
													"lat-pulldown-machine": "高位下拉机",
													"chest-press-machine": "坐姿推胸机",
												}[item.id]
											}
										</Button>
									))}
								</div>
							</SectionRule>
							<p className="coach-note">
								<HeartPulse size={18} />{" "}
								若服用影响心率的药物，或已有医生的运动建议，请关闭通用估算。估算不是安全上限。
							</p>
							<div className="form-actions">
								<Button type="submit" loading={model.busy}>
									保存档案
								</Button>
								{current && <span className="field-hint">已建立私人档案</span>}
							</div>
						</form>
					</LayerCard.Body>
				</LayerCard>
				<LayerCard>
					<LayerCard.Header>
						<h2 className="card-title">
							<Scale size={18} /> 记录身体数据
						</h2>
					</LayerCard.Header>
					<LayerCard.Body className="stack">
						<Field label="测量日期" type="date" value={date} onChange={setDate} />
						<form
							onSubmit={(event) => {
								event.preventDefault();
								void model.recordMeasurement("weight", Number(weight), date);
							}}
						>
							<div className="measurement-row">
								<Field
									label="体重（kg）"
									value={weight}
									onChange={setWeight}
									type="number"
									min={1}
									step="any"
									required
								/>
								<div className="form-actions">
									<Button type="submit" variant="secondary" loading={model.busy}>
										记录体重
									</Button>
								</div>
							</div>
						</form>
						<form
							onSubmit={(event) => {
								event.preventDefault();
								void model.recordMeasurement("height", Number(height), date);
							}}
						>
							<div className="measurement-row">
								<Field
									label="身高（cm）"
									value={height}
									onChange={setHeight}
									type="number"
									min={1}
									step="any"
									required
								/>
								<div className="form-actions">
									<Button type="submit" variant="secondary" loading={model.busy}>
										<Ruler size={14} /> 记录身高
									</Button>
								</div>
							</div>
						</form>
						<p className="field-hint">
							同一天同类测量会更新。BMI 采用该日期之前最近一次身高；新增今天的身高不会改写过去。
						</p>
					</LayerCard.Body>
				</LayerCard>
			</div>
			<LayerCard>
				<LayerCard.Header>
					<h2 className="card-title">测量历史</h2>
				</LayerCard.Header>
				<LayerCard.Body>
					{model.measurements.length ? (
						<div className="table-scroll">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>日期</TableHead>
										<TableHead>类型</TableHead>
										<TableHead>测量值</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{[...model.measurements]
										.sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
										.map((item) => (
											<TableRow key={item.id}>
												<TableCell className="mono">{item.effectiveDate}</TableCell>
												<TableCell>{item.kind === "height" ? "身高" : "体重"}</TableCell>
												<TableCell className="mono">
													{item.value} {item.kind === "height" ? "cm" : "kg"}
												</TableCell>
											</TableRow>
										))}
								</TableBody>
							</Table>
						</div>
					) : (
						<p className="coach-note">还没有测量记录。从今天的一个数字开始。</p>
					)}
				</LayerCard.Body>
			</LayerCard>
		</div>
	);
}
