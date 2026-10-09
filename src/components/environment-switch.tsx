import { ConfirmDialog, SegmentControl, useConfirm } from "@nocoo/basalt";
import { useEnvironment } from "../features/use-environment";

export function EnvironmentSwitch() {
	const { confirm, dialogProps } = useConfirm();
	const model = useEnvironment(() =>
		confirm({
			title: "切换数据环境？",
			description:
				"未保存的修改将丢失，并返回今日训练。Local 保留本机记录；E2E 是独立临时数据库；Prod 会读写真实线上数据。",
			confirmLabel: "确认切换",
			cancelLabel: "取消",
			variant: "destructive",
		}),
	);
	if (!model.environment) return null;
	return (
		<div className="environment-switch">
			<SegmentControl
				legend="数据环境"
				value={model.environment.mode}
				disabled={model.busy}
				onValueChange={(mode) => void model.select(mode)}
				options={[
					{ value: "local", label: "Local", disabled: model.environment.locked },
					{ value: "e2e", label: "E2E" },
					{ value: "prod", label: "Prod", disabled: model.environment.locked },
				]}
			/>
			{model.error && (
				<p role="alert" className="environment-error">
					{model.error}
				</p>
			)}
			<ConfirmDialog {...dialogProps} />
		</div>
	);
}
