import { z } from "zod";

const modeSchema = z.enum(["local", "e2e", "prod"]);
const environmentSchema = z
	.object({
		local: z.literal(true),
		mode: modeSchema,
		locked: z.boolean(),
		automated: z.boolean(),
		instanceId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
		csrfToken: z.string().min(1),
	})
	.refine((value) => !value.locked || value.mode === "e2e")
	.refine((value) => !value.automated || value.locked);

export type Environment = z.infer<typeof environmentSchema>;
export type EnvironmentMode = z.infer<typeof modeSchema>;
let environment: Readonly<Environment> | null = null;
let switching = false;

async function descriptor(path: string, init?: RequestInit) {
	const response = await fetch(path, { credentials: "same-origin", ...init });
	if (!response.ok) {
		throw new Error(
			response.status === 409
				? "环境已在其他页面切换，请刷新页面。"
				: "环境切换失败。Prod 请先运行 bun run login:prod；当前页面未切换。",
		);
	}
	const parsed = environmentSchema.safeParse(await response.json());
	if (!parsed.success) throw new Error("环境配置无效，请重新启动开发服务。");
	return Object.freeze(parsed.data);
}

export async function initializeEnvironment(): Promise<void> {
	if (window.__RHINO_LOCAL__ === true) {
		environment = await descriptor("/__local/environment");
	}
}

export function getEnvironment() {
	return environment;
}

export function apiPath(path: string): string {
	if (environment) {
		return environment.automated ? path : `/__local/instances/${environment.instanceId}${path}`;
	}
	if (typeof window !== "undefined" && window.__RHINO_LOCAL__ === true) {
		throw new Error("本地环境尚未初始化，已阻止数据请求。");
	}
	return path;
}

export async function selectEnvironment(
	mode: string,
	confirm: () => Promise<boolean>,
): Promise<boolean> {
	const current = environment;
	if (!current || current.locked || switching || !modeSchema.safeParse(mode).success) return false;
	if (mode === current.mode) return false;
	switching = true;
	try {
		if (!(await confirm())) return false;
		const selected = await descriptor("/__local/environment/select", {
			method: "POST",
			headers: { "Content-Type": "application/json", "X-Rhino-Local-Csrf": current.csrfToken },
			body: JSON.stringify({ mode, instanceId: current.instanceId }),
		});
		if (selected.mode !== mode) throw new Error("服务未确认目标环境，已停止切换。");
		window.location.assign("/");
		return true;
	} finally {
		switching = false;
	}
}
