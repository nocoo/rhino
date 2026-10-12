import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@nocoo/basalt";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@nocoo/basalt/components/table";
import { ArrowUpRight, type LucideIcon, Pencil, Trash2 } from "lucide-react";
import { useRef } from "react";
import { emphasisNames } from "../components/workout-summary";
import { recordedWork } from "../domain/calendar";
import type { SessionRecord } from "../domain/contracts";
import { sessionStatusNames } from "./session-review";
import type { useCalendarModel } from "./use-calendar-model";
import type { RhinoModel } from "./use-rhino-model";

const createdTime = (session: SessionRecord) =>
	new Date(session.createdAt).toLocaleTimeString("zh-CN", {
		timeZone: session.timezone,
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

function RecordAction({
	label,
	icon: Icon,
	disabled,
	onClick,
	destructive = false,
}: {
	label: string;
	icon: LucideIcon;
	disabled: boolean;
	onClick: (element: HTMLButtonElement) => void;
	destructive?: boolean;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					size="icon"
					variant="ghost"
					aria-label={label}
					disabled={disabled}
					className={destructive ? "record-delete" : undefined}
					onClick={(event) => onClick(event.currentTarget)}
				>
					<Icon size={16} strokeWidth={1.5} aria-hidden="true" />
				</Button>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

export function SessionRecordList({
	records,
	model,
	calendar,
}: {
	records: SessionRecord[];
	model: RhinoModel;
	calendar: ReturnType<typeof useCalendarModel>;
}) {
	const trigger = useRef<HTMLElement | null>(null);
	return (
		<>
			<Table className="session-record-list" aria-label="当天训练记录">
				<TableHeader className="sr-only">
					<TableRow>
						<TableHead>训练记录</TableHead>
						<TableHead>操作</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{records.map((session) => {
						const actual = recordedWork(session);
						return (
							<TableRow key={session.id} className="calendar-record" data-session-id={session.id}>
								<TableCell>
									<div className="session-record-title">
										<span>{emphasisNames[session.target.emphasis]}</span>
										<span>{sessionStatusNames[session.status]}</span>
									</div>
									<p className="session-record-meta">
										<time dateTime={session.createdAt}>{createdTime(session)}</time>
										{session.actual ? (
											<>
												<span>{actual.sets} 组</span>
												<span>有氧 {Math.round(actual.minutes * 10) / 10} 分钟</span>
											</>
										) : (
											<span>尚无实际记录</span>
										)}
										<span>
											{session.sourcePlanRevision
												? `计划 v${session.sourcePlanRevision}`
												: "独立训练"}
										</span>
									</p>
								</TableCell>
								<TableCell className="session-record-action-cell">
									<div className="session-record-actions">
										<RecordAction
											label="打开训练记录"
											icon={ArrowUpRight}
											disabled={model.busy}
											onClick={() => model.openSession(session, "view")}
										/>
										<RecordAction
											label="修改训练记录"
											icon={Pencil}
											disabled={model.busy}
											onClick={() => model.openSession(session, "edit")}
										/>
										<RecordAction
											label="删除训练记录"
											icon={Trash2}
											disabled={model.busy}
											destructive
											onClick={(element) => {
												trigger.current = element;
												calendar.setDeleting(session);
											}}
										/>
									</div>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
			<AlertDialog
				open={calendar.deleting !== null}
				onOpenChange={(open) => {
					if (!open && !model.busy) calendar.setDeleting(null);
				}}
			>
				<AlertDialogContent
					onEscapeKeyDown={(event) => {
						if (model.busy) event.preventDefault();
					}}
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						const target = trigger.current?.isConnected
							? trigger.current
							: document.querySelector<HTMLElement>('.calendar-day[aria-pressed="true"]');
						target?.focus();
					}}
				>
					<AlertDialogHeader>
						<AlertDialogTitle>删除这条训练记录？</AlertDialogTitle>
						<AlertDialogDescription>
							{calendar.deleting &&
								`${calendar.deleting.localDate} · ${emphasisNames[calendar.deleting.target.emphasis]} · ${sessionStatusNames[calendar.deleting.status]} · 创建于 ${createdTime(calendar.deleting)}。`}
							全部组数、有氧、计时和备注会永久删除，无法恢复；训练计划不受影响。
						</AlertDialogDescription>
					</AlertDialogHeader>
					{calendar.deleteFailed && model.error && (
						<p role="alert" className="error-message">
							{model.error}
						</p>
					)}
					<AlertDialogFooter>
						{calendar.deleteFailed && (
							<Button
								variant="secondary"
								disabled={model.busy}
								onClick={() => {
									calendar.setDeleting(null);
									calendar.retry();
								}}
							>
								重新加载记录
							</Button>
						)}
						<AlertDialogCancel disabled={model.busy}>取消</AlertDialogCancel>
						<AlertDialogAction asChild>
							<Button
								variant="destructive"
								loading={model.busy}
								onClick={(event) => {
									event.preventDefault();
									void calendar.confirmDelete();
								}}
							>
								确认删除
							</Button>
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
