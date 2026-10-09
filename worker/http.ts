import { ApiError, errorBody, MAX_BODY_BYTES, ok } from "../src/domain/contracts";

export const JSON_HEADERS = {
	"Cache-Control": "no-store",
	"Content-Type": "application/json; charset=utf-8",
};

export function jsonOk<T>(data: T, status = 200): Response {
	return new Response(JSON.stringify(ok(data)), { status, headers: JSON_HEADERS });
}

export function jsonError(error: ApiError): Response {
	return new Response(JSON.stringify(errorBody(error)), {
		status: error.status,
		headers: JSON_HEADERS,
	});
}

export async function readJsonBody(request: Request, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
	const declared = request.headers.get("content-length");
	if (declared) {
		const length = Number(declared);
		if (Number.isFinite(length) && length > maxBytes) {
			throw new ApiError(413, "payload_too_large", "Request body exceeds 256 KiB");
		}
	}
	const contentType = request.headers.get("content-type") ?? "";
	if (contentType.split(";")[0].trim().toLowerCase() !== "application/json") {
		throw new ApiError(400, "invalid_request", "JSON content type is required");
	}
	const reader = request.body?.getReader();
	if (!reader) {
		throw new ApiError(400, "invalid_request", "Request body is required");
	}
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		size += value.byteLength;
		if (size > maxBytes) {
			await reader.cancel();
			throw new ApiError(413, "payload_too_large", "Request body exceeds 256 KiB");
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	const text = new TextDecoder().decode(bytes);
	try {
		return JSON.parse(text) as unknown;
	} catch {
		throw new ApiError(400, "invalid_request", "Request body is not valid JSON");
	}
}

export function requireOrigin(request: Request, origin: string): void {
	if (
		request.headers.get("origin") !== origin ||
		request.headers.get("sec-fetch-site") === "cross-site"
	) {
		throw new ApiError(403, "origin_rejected", "Request origin is not allowed");
	}
}

export function queryValue(url: URL, key: string): string | undefined {
	const value = url.searchParams.get(key);
	return value === null ? undefined : value;
}

export function logSafe(entry: {
	requestId: string;
	method: string;
	route: string;
	status: number;
	ms: number;
	code?: string;
}): void {
	console.log(JSON.stringify(entry));
}
