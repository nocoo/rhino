import { Button, LayerCard } from "@nocoo/basalt";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { CalendarDays, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Choice, Field } from "../components/fields";
import { WorkoutSummary } from "../components/workout-summary";
import { defaultPreferences, type GoalPreference, type PlanInput } from "../domain/contracts";
import type { RhinoModel } from "./use-rhino-model";

export function PlansView({ model }: { model: RhinoModel }) {
	const preferences = model.profile?.profile?.preferences ?? defaultPreferences;
	const [frequency, setFrequency] = useState(preferences.weeklyFrequency);
	const [minutes, setMinutes] = useState(preferences.sessionTimeBudgetMinutes);
	const [goal, setGoal] = useState<GoalPreference>(preferences.goalPreference);
	const [cardioOnly, setCardioOnly] = useState(false);
	const weekdays = [
		"monday",
		"wednesday",
		"friday",
		"sunday",
		"tuesday",
		"thursday",
		"saturday",
	] as const;
	const input: PlanInput = {
		timezone: model.profile?.profile?.timezone ?? "Asia/Shanghai",
		reviewMonth: model.today.slice(0, 7),
		weeklyFrequency: frequency,
		preferredWeekdays: [...weekdays.slice(0, frequency)],
		cardioOnlyWeekdays: cardioOnly ? [...weekdays.slice(0, frequency)] : [],
		sessionTimeBudgetMinutes: minutes,
		goalPreference: goal,
		experience: preferences.experience,
		equipmentIds: preferences.equipmentIds,
	};
	const slots = model.preview?.template.slots ?? model.plans.current?.template.slots ?? [];
	return (
		<div className="page-body">
			<PageHeader
				title="给一周留一点训练时间。"
				description="频次由你决定。每月复盘，保留有效的动作，而不是为了变化而变化。"
				actions={
					model.plans.current ? (
						<span className="pill">
							计划 v{model.plans.current.revision} · {model.plans.current.reviewMonth}
						</span>
					) : undefined
				}
			/>
			<LayerCard>
				<LayerCard.Header>
					<h2 className="card-title">计划偏好</h2>
				</LayerCard.Header>
				<LayerCard.Body>
					<form
						className="form-stack"
						onSubmit={(event) => {
							event.preventDefault();
							void model.generate(input);
						}}
					>
						<div className="form-grid">
							<Field
								label="每周训练次数"
								type="number"
								min={1}
								max={7}
								value={frequency}
								onChange={(value) => setFrequency(Number(value))}
							/>
							<Field
								label="每次可用时间（分钟）"
								type="number"
								min={20}
								max={180}
								value={minutes}
								onChange={(value) => setMinutes(Number(value))}
							/>
							<Choice
								label="训练重点"
								value={goal}
								onChange={(value) => setGoal(value as GoalPreference)}
								options={[
									{ value: "strength-first", label: "优先力量与全身健康" },
									{ value: "endurance-first", label: "优先有氧耐力" },
								]}
							/>
							<Choice
								label="训练组成"
								value={cardioOnly ? "cardio" : "mixed"}
								onChange={(value) => setCardioOnly(value === "cardio")}
								options={[
									{ value: "mixed", label: "力量与有氧结合" },
									{ value: "cardio", label: "本周全部有氧骑行" },
								]}
							/>
						</div>
						<div className="form-actions">
							<Button type="submit" loading={model.busy}>
								<Sparkles size={15} /> 生成计划
							</Button>
							<span className="field-hint">预览不会覆盖现有计划</span>
						</div>
					</form>
				</LayerCard.Body>
			</LayerCard>
			{!!model.limitations.length && (
				<LayerCard>
					<div className="coach-note">
						<CalendarDays size={18} />
						<div>
							{model.limitations.map((item) => (
								<p key={item}>{item}</p>
							))}
						</div>
					</div>
				</LayerCard>
			)}
			{model.preview && (
				<LayerCard className="stack">
					<div className="card-footer">
						<div>
							<strong>计划预览</strong>
							<p className="field-hint">采用后会创建新版本，历史训练保持不变。</p>
						</div>
						<Button onClick={() => void model.adopt()} loading={model.busy}>
							采用这个计划
						</Button>
					</div>
					{model.preview.rationale.compromises.map((item) => (
						<p className="field-hint" key={item}>
							{item}
						</p>
					))}
				</LayerCard>
			)}
			<div className="plan-grid">
				{slots.map((slot, index) => (
					<WorkoutSummary
						key={slot.weekday}
						target={slot.target}
						subtitle={`SESSION ${String(index + 1).padStart(2, "0")} / ${slot.weekday.toUpperCase()}`}
						onStart={!model.preview ? () => void model.start(slot.target) : undefined}
						busy={model.busy}
					/>
				))}
			</div>
			{!slots.length && (
				<LayerCard>
					<LayerCard.Empty
						icon={<RefreshCw size={24} />}
						title="从一个可持续的计划开始。"
						description="选择真实可用的时间，而不是理想中的时间。少一点也没关系。"
					/>
				</LayerCard>
			)}
			{!!model.plans.history.length && (
				<LayerCard>
					<LayerCard.Header>
						<h2 className="card-title">计划版本</h2>
					</LayerCard.Header>
					<LayerCard.Body className="workout-meta">
						{model.plans.history.map((plan) => (
							<span key={plan.revision}>
								v{plan.revision} · {plan.reviewMonth} · 每周 {plan.input.weeklyFrequency} 次
							</span>
						))}
					</LayerCard.Body>
				</LayerCard>
			)}
		</div>
	);
}
