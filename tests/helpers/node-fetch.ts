import { request as httpRequest } from "node:http";
import { URL } from "node:url";

/** Node http client for L2; Bun's fetch breaks Miniflare dispatch in newer @cloudflare/vite-plugin. */
export function nodeFetch(url: string, init: RequestInit = {}): Promise<Response> {
	return new Promise((resolve, reject) => {
		const parsed = new URL(url);
		const method = init.method ?? "GET";
		const headers =
			init.headers instanceof Headers
				? Object.fromEntries(init.headers.entries())
				: (init.headers as Record<string, string> | undefined);
		const body =
			init.body === undefined || init.body === null
				? undefined
				: typeof init.body === "string"
					? init.body
					: Buffer.from(init.body as ArrayBuffer);
		const headerRecord: Record<string, string> = { ...headers, connection: "close" };
		if (body !== undefined) {
			headerRecord["content-length"] = String(Buffer.byteLength(body));
		}
		const req = httpRequest(
			{
				hostname: parsed.hostname,
				port: parsed.port,
				path: `${parsed.pathname}${parsed.search}`,
				method,
				headers: headerRecord,
			},
			(res) => {
				const chunks: Buffer[] = [];
				res.on("data", (chunk) => chunks.push(chunk));
				res.on("end", () => {
					const responseBody = Buffer.concat(chunks);
					const responseHeaders = new Headers();
					for (const [key, value] of Object.entries(res.headers)) {
						if (value === undefined) continue;
						responseHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
					}
					resolve(
						new Response(responseBody, {
							status: res.statusCode ?? 500,
							headers: responseHeaders,
						}),
					);
				});
			},
		);
		req.on("error", reject);
		if (body !== undefined) req.write(body);
		req.end();
	});
}
