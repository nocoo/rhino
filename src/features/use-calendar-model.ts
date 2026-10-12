import { useEffect, useState } from "react";
import { calendarDays, monthlyActivity, shiftMonth } from "../domain/calendar";
import type { GetSessionsResponse, SessionRecord } from "../domain/contracts";
import { isValidMonth } from "../domain/dates";
import { api } from "../lib/api";
import type { RhinoModel } from "./use-rhino-model";

export function useCalendarModel(
	model: RhinoModel,
	selected: string,
	setSelected: (date: string) => void,
) {
	const month = selected.slice(0, 7);
	const [attempt, setAttempt] = useState(0);
	const [deleting, updateDeleting] = useState<SessionRecord | null>(null);
	const [deleteFailed, setDeleteFailed] = useState(false);
	const [result, setResult] = useState<{
		range: string;
		attempt: number;
		sessions: SessionRecord[];
		error: string;
	} | null>(null);
	const revisions = model.plans.current
		? [model.plans.current, ...model.plans.history]
		: model.plans.history;
	const days = calendarDays(month, revisions);
	const range = `from=${days[0].date}&to=${days[41].date}`;
	useEffect(() => {
		const controller = new AbortController();
		setResult(null);
		void api<GetSessionsResponse>(`/sessions?${range}`, { signal: controller.signal })
			.then(({ sessions }) => {
				if (!controller.signal.aborted) setResult({ range, attempt, sessions, error: "" });
			})
			.catch((reason: unknown) => {
				if (!controller.signal.aborted)
					setResult({
						range,
						attempt,
						sessions: [],
						error: reason instanceof Error ? reason.message : "日历记录加载失败，请重试。",
					});
			});
		return () => controller.abort();
	}, [range, attempt]);
	const current = result?.range === range && result.attempt === attempt ? result : null;
	function selectMonth(value: string) {
		if (!isValidMonth(value) || value < "1000-01" || value > "9998-12") return;
		setSelected(`${value}-01`);
	}
	async function confirmDelete() {
		if (!deleting || model.busy) return;
		setDeleteFailed(false);
		if (await model.deleteSession(deleting)) {
			updateDeleting(null);
			setAttempt((value) => value + 1);
		} else setDeleteFailed(true);
	}
	return {
		month,
		selected,
		days,
		loading: !current,
		error: current?.error ?? "",
		sessions: current?.sessions ?? [],
		activity: monthlyActivity(month, current?.sessions ?? []),
		deleting,
		deleteFailed,
		setDeleting: (session: SessionRecord | null) => {
			updateDeleting(session);
			setDeleteFailed(false);
		},
		confirmDelete,
		select: setSelected,
		selectMonth,
		move: (offset: number) => selectMonth(shiftMonth(month, offset)),
		today: () => {
			setSelected(model.today);
		},
		retry: () => setAttempt((value) => value + 1),
	};
}
