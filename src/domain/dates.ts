const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_ONLY = /^(\d{4})-(\d{2})$/;
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export const WEEKDAYS = [
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
	"sunday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type DateParts = {
	year: number;
	month: number;
	day: number;
};

const WEEKDAY_INDEX: Record<Weekday, number> = {
	monday: 0,
	tuesday: 1,
	wednesday: 2,
	thursday: 3,
	friday: 4,
	saturday: 5,
	sunday: 6,
};

export function isValidDateOnly(value: string): boolean {
	const match = DATE_ONLY.exec(value);
	if (!match) {
		return false;
	}
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const utc = new Date(Date.UTC(year, month - 1, day));
	return (
		utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
	);
}

export function isValidMonth(value: string): boolean {
	const match = MONTH_ONLY.exec(value);
	if (!match) {
		return false;
	}
	const month = Number(match[2]);
	return month >= 1 && month <= 12;
}

export function isUtcInstant(value: string): boolean {
	if (!UTC_INSTANT.test(value)) {
		return false;
	}
	const parsed = Date.parse(value);
	return Number.isFinite(parsed);
}

export function parseDateOnly(value: string): DateParts {
	if (!isValidDateOnly(value)) {
		throw new Error("invalid_date");
	}
	return {
		year: Number(value.slice(0, 4)),
		month: Number(value.slice(5, 7)),
		day: Number(value.slice(8, 10)),
	};
}

export function formatDateOnly(parts: DateParts): string {
	const year = String(parts.year).padStart(4, "0");
	const month = String(parts.month).padStart(2, "0");
	const day = String(parts.day).padStart(2, "0");
	const formatted = `${year}-${month}-${day}`;
	if (!isValidDateOnly(formatted)) {
		throw new Error("invalid_date");
	}
	return formatted;
}

export function compareDateOnly(left: string, right: string): number {
	if (left === right) {
		return 0;
	}
	return left < right ? -1 : 1;
}

export function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function anniversaryOnYear(birthday: DateParts, year: number): DateParts {
	if (birthday.month === 2 && birthday.day === 29 && !isLeapYear(year)) {
		return { year, month: 3, day: 1 };
	}
	return { year, month: birthday.month, day: birthday.day };
}

export function ageOnDate(birthday: string, onDate: string): number {
	const birth = parseDateOnly(birthday);
	const on = parseDateOnly(onDate);
	if (compareDateOnly(onDate, birthday) < 0) {
		throw new Error("future_birthday");
	}
	const anniversary = anniversaryOnYear(birth, on.year);
	const reached =
		on.month > anniversary.month || (on.month === anniversary.month && on.day >= anniversary.day);
	return reached ? on.year - birth.year : on.year - birth.year - 1;
}

export function localDateInTimeZone(instant: Date, timeZone: string): string {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(instant);
	const year = parts.find((part) => part.type === "year")?.value;
	const month = parts.find((part) => part.type === "month")?.value;
	const day = parts.find((part) => part.type === "day")?.value;
	if (!year || !month || !day) {
		throw new Error("invalid_timezone");
	}
	return `${year}-${month}-${day}`;
}

export function isIanaTimeZone(value: string): boolean {
	if (!value || value.length > 64) {
		return false;
	}
	try {
		Intl.DateTimeFormat("en-US", { timeZone: value });
		return true;
	} catch {
		return false;
	}
}

export function weekdayOf(date: string): Weekday {
	const parts = parseDateOnly(date);
	const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
	const jsDay = utc.getUTCDay();
	const mondayFirst = jsDay === 0 ? 6 : jsDay - 1;
	const weekday = WEEKDAYS[mondayFirst];
	if (!weekday) {
		throw new Error("invalid_date");
	}
	return weekday;
}

export function weekdayIndex(weekday: Weekday): number {
	return WEEKDAY_INDEX[weekday];
}

export function mondayOfWeek(date: string): string {
	const index = weekdayIndex(weekdayOf(date));
	return addDays(date, -index);
}

export function addDays(date: string, days: number): string {
	const parts = parseDateOnly(date);
	const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
	return formatDateOnly({
		year: utc.getUTCFullYear(),
		month: utc.getUTCMonth() + 1,
		day: utc.getUTCDate(),
	});
}

export function daysInclusive(from: string, to: string): number {
	const start = parseDateOnly(from);
	const end = parseDateOnly(to);
	const startUtc = Date.UTC(start.year, start.month - 1, start.day);
	const endUtc = Date.UTC(end.year, end.month - 1, end.day);
	return Math.floor((endUtc - startUtc) / 86_400_000) + 1;
}

export function monthOf(date: string): string {
	parseDateOnly(date);
	return date.slice(0, 7);
}

export function utcNow(): string {
	return new Date().toISOString();
}
