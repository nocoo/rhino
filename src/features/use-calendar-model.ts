import { useEffect, useState } from "react";
import { calendarDays, shiftMonth } from "../domain/calendar";
import type { GetSessionsResponse, SessionRecord } from "../domain/contracts";
import { isValidMonth } from "../domain/dates";
import { api } from "../lib/api";
import type { RhinoModel } from "./use-rhino-model";

export function useCalendarModel(
	model: RhinoModel,
	selected: string,
	setSelected: (date: string) => void,
) {
	const [month, setMonth] = useState(selected.slice(0, 7));
	const [attempt, setAttempt] = useState(0);
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
		setMonth(value);
		setSelected(`${value}-01`);
	}
	return {
		month,
		selected,
		days,
		loading: !current,
		error: current?.error ?? "",
		sessions: current?.sessions ?? [],
		select: setSelected,
		selectMonth,
		move: (offset: number) => selectMonth(shiftMonth(month, offset)),
		today: () => {
			setMonth(model.today.slice(0, 7));
			setSelected(model.today);
		},
		retry: () => setAttempt((value) => value + 1),
	};
}
