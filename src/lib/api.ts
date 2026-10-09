export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
	) {
		super(message);
	}
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
	const response = await fetch(`/api${path}`, {
		...options,
		headers: { "Content-Type": "application/json", ...options.headers },
	});
	if (!response.headers.get("content-type")?.includes("application/json")) {
		throw new ApiError(response.status, "AUTH_REQUIRED", "登录已过期，请刷新页面重新登录。");
	}
	const body = (await response.json()) as {
		data?: unknown;
		error?: { code?: string; message?: string };
	};
	if (!response.ok) {
		throw new ApiError(
			response.status,
			body.error?.code ?? "REQUEST_FAILED",
			response.status === 409
				? "记录已在其他页面更新。请重新加载后再保存；当前修改尚未提交。"
				: (body.error?.message ?? "保存失败，请稍后重试。"),
		);
	}
	return body.data as T;
}

export function put<T>(path: string, body: unknown): Promise<T> {
	return api<T>(path, { method: "PUT", body: JSON.stringify(body) });
}
