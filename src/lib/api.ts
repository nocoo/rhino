import { apiPath } from "../models/environment";

export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
	) {
		super(message);
	}
}

const errorMessages: Record<string, string> = {
	unauthorized: "登录已过期，请刷新页面重新登录。",
	forbidden: "当前账号没有访问此训练空间的权限。",
	owner_not_configured: "训练空间尚未配置所有者，请联系管理员。",
	invalid_request: "请求格式有误，请检查填写内容后重试。",
	validation_failed: "填写内容不符合要求，请检查日期、数量和必填项。",
	not_found: "记录不存在，请重新加载。",
	conflict: "记录已在其他页面更新，请重新加载后再保存。",
	payload_too_large: "提交内容过多，请减少内容后重试。",
	origin_rejected: "当前访问地址不允许保存，请从正确的网站地址打开。",
	auth_configuration_error: "登录服务配置有误，请联系管理员。",
	internal_error: "服务暂时不可用，请稍后重试。",
};

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
	const response = await fetch(apiPath(`/api${path}`), {
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
				: (errorMessages[body.error?.code ?? ""] ?? "请求失败，请稍后重试。"),
		);
	}
	return body.data as T;
}

export function put<T>(path: string, body: unknown): Promise<T> {
	return api<T>(path, { method: "PUT", body: JSON.stringify(body) });
}
