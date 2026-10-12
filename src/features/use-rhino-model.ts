import { useCallback, useEffect, useRef, useState } from "react";
import type {
	GetMeasurementsResponse,
	GetPlansResponse,
	GetProfileResponse,
	GetProgressResponse,
	GetSessionsResponse,
	MeasurementKind,
	PlanInput,
	PlanPreview,
	PlanPreviewResponse,
	PutMeasurementResponse,
	PutPlanResponse,
	PutProfileRequest,
	PutProfileResponse,
	PutSessionResponse,
	SessionActual,
	SessionRecord,
	SessionTarget,
} from "../domain/contracts";
import { addDays, localDateInTimeZone } from "../domain/dates";
import { heartRateGuidance } from "../domain/metrics";
import type { SessionMode } from "../domain/routes";
import { emptyActual } from "../domain/session";
import { api, put } from "../lib/api";

export function useRhinoModel(onOpenSession?: (session: SessionRecord, mode: SessionMode) => void) {
	const [profile, setProfile] = useState<GetProfileResponse | null>(null);
	const [plans, setPlans] = useState<GetPlansResponse>({ current: null, history: [] });
	const [measurements, setMeasurements] = useState<GetMeasurementsResponse["measurements"]>([]);
	const [sessions, setSessions] = useState<SessionRecord[]>([]);
	const [progress, setProgress] = useState<GetProgressResponse | null>(null);
	const [preview, setPreview] = useState<PlanPreview | null>(null);
	const [limitations, setLimitations] = useState<string[]>([]);
	const [active, setActive] = useState<SessionRecord | null>(null);
	const [busy, setBusy] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");
	const pending = useRef<{ fingerprint: string; mutationId: string; resourceId: string } | null>(
		null,
	);
	const running = useRef(false);
	const today = localDateInTimeZone(new Date(), profile?.profile?.timezone ?? "Asia/Shanghai");
	const cardioGuidance = profile?.profile
		? heartRateGuidance({
				birthday: profile.profile.birthday,
				onDate: today,
				mode: profile.profile.guidance.mode,
			})
		: null;

	const reload = useCallback(async () => {
		const result = await api<GetProfileResponse>("/profile");
		const date = localDateInTimeZone(new Date(), result.profile?.timezone ?? "Asia/Shanghai");
		const range = `from=${addDays(date, -365)}&to=${date}`;
		const [nextPlans, nextMeasurements, nextSessions, nextProgress] = await Promise.all([
			api<GetPlansResponse>("/plans"),
			api<GetMeasurementsResponse>(`/measurements?${range}`),
			api<GetSessionsResponse>(`/sessions?${range}`),
			api<GetProgressResponse>(`/progress?${range}`),
		]);
		setProfile(result);
		setPlans(nextPlans);
		setMeasurements(nextMeasurements.measurements);
		setSessions(nextSessions.sessions);
		setProgress(nextProgress);
	}, []);

	const run = useCallback(async (action: () => Promise<void>, success: string) => {
		if (running.current) return;
		running.current = true;
		setBusy(true);
		setError("");
		setMessage("");
		try {
			await action();
			setMessage(success);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "请求失败，请重试。");
		} finally {
			running.current = false;
			setBusy(false);
		}
	}, []);

	useEffect(() => {
		let cancelled = false;
		reload()
			.catch((reason) => {
				if (!cancelled) setError(reason instanceof Error ? reason.message : "加载失败");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [reload]);

	function mutation(value: unknown) {
		const fingerprint = JSON.stringify(value);
		if (pending.current?.fingerprint !== fingerprint)
			pending.current = {
				fingerprint,
				mutationId: crypto.randomUUID(),
				resourceId: crypto.randomUUID(),
			};
		return pending.current;
	}

	async function saveProfile(values: Omit<PutProfileRequest, "expectedVersion" | "mutationId">) {
		await run(async () => {
			const metadata = mutation(values);
			const result = await put<PutProfileResponse>("/profile", {
				...values,
				expectedVersion: profile?.profile?.version ?? 0,
				mutationId: metadata.mutationId,
			});
			setProfile((previous) => (previous ? { ...previous, ...result } : previous));
			pending.current = null;
			await reload();
		}, "档案已保存");
	}

	async function recordMeasurement(kind: MeasurementKind, value: number, effectiveDate: string) {
		await run(async () => {
			const existing = measurements.find(
				(item) => item.kind === kind && item.effectiveDate === effectiveDate,
			);
			const data = { kind, value, effectiveDate };
			const metadata = mutation(data);
			await put<PutMeasurementResponse>(`/measurements/${existing?.id ?? metadata.resourceId}`, {
				...data,
				expectedVersion: existing?.version ?? 0,
				mutationId: metadata.mutationId,
			});
			pending.current = null;
			await reload();
		}, "测量记录已保存，同日记录会更新而非重复新增");
	}

	async function generate(input: PlanInput) {
		await run(async () => {
			const result = await api<PlanPreviewResponse>("/plans/preview", {
				method: "POST",
				body: JSON.stringify(input),
			});
			setPreview(result.preview);
			setLimitations(result.limitations);
		}, "计划预览已生成，请确认后采用");
	}

	async function adopt() {
		if (!preview) return;
		await run(async () => {
			const metadata = mutation(preview.input);
			const result = await put<PutPlanResponse>(`/plans/${metadata.resourceId}`, {
				expectedRevision: plans.current?.revision ?? 0,
				input: preview.input,
			});
			setPlans((previous) => ({
				current: result.revision,
				history: [result.revision, ...previous.history],
			}));
			pending.current = null;
			setPreview(null);
		}, "新计划已采用，旧版本与训练记录已保留");
	}

	async function start(
		target: SessionTarget,
		options?: { localDate: string; sourcePlanRevision: number; recordOnly?: boolean },
	) {
		await run(
			async () => {
				const data = {
					sourcePlanRevision: options?.sourcePlanRevision ?? plans.current?.revision ?? null,
					localDate: options?.localDate ?? today,
					timezone: profile?.profile?.timezone ?? "Asia/Shanghai",
					status: options?.recordOnly ? "active" : "draft",
					target,
					actual: options?.recordOnly ? emptyActual(target) : null,
				};
				const metadata = mutation(data);
				const result = await put<PutSessionResponse>(`/sessions/${metadata.resourceId}`, {
					...data,
					expectedVersion: 0,
					mutationId: metadata.mutationId,
				});
				openSession(result.session);
				setSessions((previous) => [
					result.session,
					...previous.filter((item) => item.id !== result.session.id),
				]);
				pending.current = null;
			},
			options?.recordOnly
				? "请填写实际完成量，确认后结束保存；补记不生成计时。"
				: "训练准备已保存，开始前仍可调整",
		);
	}
	function openSession(session: SessionRecord, mode: SessionMode = "workout") {
		setActive(session);
		onOpenSession?.(session, mode);
	}

	async function deleteSession(session: SessionRecord): Promise<boolean> {
		let deleted = false;
		await run(async () => {
			await api(`/sessions/${session.id}`, {
				method: "DELETE",
				body: JSON.stringify({ expectedVersion: session.version }),
			});
			deleted = true;
			setSessions((previous) => previous.filter((item) => item.id !== session.id));
			setActive((previous) => (previous?.id === session.id ? null : previous));
			await reload().catch(() => setError("训练已删除，统计刷新失败，请重新加载。"));
		}, "训练记录已删除");
		return deleted;
	}

	async function saveSession(
		session: SessionRecord,
		status: SessionRecord["status"],
		target: SessionTarget,
		actual: SessionActual | null,
	): Promise<SessionRecord | null> {
		let saved: SessionRecord | null = null;
		await run(
			async () => {
				const data = {
					sourcePlanRevision: session.sourcePlanRevision,
					localDate: session.localDate,
					timezone: session.timezone,
					status,
					target,
					actual,
				};
				const metadata = mutation(data);
				const result = await put<PutSessionResponse>(`/sessions/${session.id}`, {
					...data,
					expectedVersion: session.version,
					mutationId: metadata.mutationId,
				});
				setActive(result.session);
				saved = result.session;
				setSessions((previous) => [
					result.session,
					...previous.filter((item) => item.id !== session.id),
				]);
				pending.current = null;
				if (status === "completed")
					await reload().catch(() => setError("训练已保存，统计刷新失败，请稍后刷新页面。"));
			},
			status === "completed" ? "训练已记录。下一次，继续。" : "训练已保存",
		);
		return saved;
	}

	return {
		profile,
		cardioGuidance,
		plans,
		measurements,
		sessions,
		progress,
		preview,
		limitations,
		active,
		setActive,
		openSession,
		deleteSession,
		busy,
		loading,
		error,
		message,
		today,
		reload: () => run(reload, "已重新加载"),
		saveProfile,
		recordMeasurement,
		generate,
		adopt,
		start,
		saveSession,
	};
}

export type RhinoModel = ReturnType<typeof useRhinoModel>;
