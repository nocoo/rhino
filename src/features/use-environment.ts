import { useState } from "react";
import { getEnvironment, selectEnvironment } from "../models/environment";

export function useEnvironment(confirm: () => Promise<boolean>) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	return {
		environment: getEnvironment(),
		busy,
		error,
		async select(mode: string) {
			setBusy(true);
			setError(null);
			try {
				await selectEnvironment(mode, confirm);
			} catch (cause) {
				setError(cause instanceof Error ? cause.message : "环境切换失败，请重试。");
			} finally {
				setBusy(false);
			}
		},
	};
}
