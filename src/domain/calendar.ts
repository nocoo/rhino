import type { PlanRevisionRecord, SessionRecord } from "./contracts";
import { addDays, localDateInTimeZone, mondayOfWeek, parseDateOnly, weekdayOf } from "./dates";

export function shiftMonth(month: string, offset: number): string {
	const { year, month: index } = parseDateOnly(`${month}-01`);
	const date = new Date(Date.UTC(year, index - 1 + offset, 1));
	return date.toISOString().slice(0, 7);
}

export function calendarDays(month: string, revisions: PlanRevisionRecord[]) {
	const start = mondayOfWeek(`${month}-01`);
	const plans = revisions
		.map((plan) => ({
			plan,
			date: localDateInTimeZone(new Date(plan.acceptedAt), plan.input.timezone),
		}))
		.sort((a, b) => b.plan.revision - a.plan.revision);
	return Array.from({ length: 42 }, (_, index) => {
		const date = addDays(start, index);
		const plan = plans.find((item) => item.date <= date)?.plan;
		const slot = plan?.template.slots.find((item) => item.weekday === weekdayOf(date));
		return { date, plan, slot };
	});
}

export function recordedWork(session: SessionRecord) {
	return {
		sets:
			session.actual?.exercises
				.flatMap((item) => item.sets)
				.filter((set) => set.status === "performed").length ?? 0,
		minutes:
			session.actual?.cardioSegments.reduce((sum, segment) => sum + segment.actualMinutes, 0) ?? 0,
	};
}
