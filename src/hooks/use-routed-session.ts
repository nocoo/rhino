import { useEffect, useState } from "react";
import type { SessionRecord } from "../domain/contracts";
import { api } from "../lib/api";

export function useRoutedSession(
	id: string | undefined,
	active: SessionRecord | null,
	setActive: (session: SessionRecord | null) => void,
) {
	const [failure, setFailure] = useState<{ id: string; attempt: number; message: string } | null>(
		null,
	);
	const [attempt, setAttempt] = useState(0);
	const activeId = active?.id;
	useEffect(() => {
		if (!id) {
			setActive(null);
			return;
		}
		if (id === activeId) return;
		const controller = new AbortController();
		setFailure(null);
		void api<{ session: SessionRecord }>(`/sessions/${id}`, { signal: controller.signal })
			.then(({ session }) => {
				if (!controller.signal.aborted) setActive(session);
			})
			.catch((error: unknown) => {
				if (!controller.signal.aborted)
					setFailure({
						id,
						attempt,
						message: error instanceof Error ? error.message : "训练记录加载失败，请重试。",
					});
			});
		return () => controller.abort();
	}, [id, activeId, attempt, setActive]);
	return {
		error: failure && failure.id === id && failure.attempt === attempt ? failure.message : "",
		retry: () => setAttempt((value) => value + 1),
	};
}
