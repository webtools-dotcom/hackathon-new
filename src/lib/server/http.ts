export const MAX_BODY_BYTES = 32_768;

export type ApiErrorCode =
  | "invalid_request"
  | "payload_too_large"
  | "rate_limited"
  | "internal_error";

export function jsonError(
  code: ApiErrorCode,
  status: number,
  headers?: HeadersInit
): Response {
  const resHeaders = new Headers(headers);
  if (!resHeaders.has("Cache-Control")) {
    resHeaders.set("Cache-Control", "no-store");
  }
  return Response.json({ error: code }, { status, headers: resHeaders });
}

export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0].trim();
    if (first) {
      return first.slice(0, 64);
    }
  }

  const xri = request.headers.get("x-real-ip");
  if (xri) {
    const trimmed = xri.trim();
    if (trimmed) {
      return trimmed.slice(0, 64);
    }
  }

  return "unknown";
}

export async function readJsonBody(
  request: Request
): Promise<
  | { ok: true; body: unknown; bytes: number }
  | { ok: false; code: "invalid_request" | "payload_too_large" }
> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const len = Number.parseInt(contentLength, 10);
    if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
      return { ok: false, code: "payload_too_large" };
    }
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, code: "invalid_request" };
  }

  const bytes = new TextEncoder().encode(text).length;
  if (bytes > MAX_BODY_BYTES) {
    return { ok: false, code: "payload_too_large" };
  }

  try {
    const body: unknown = JSON.parse(text);
    return { ok: true, body, bytes };
  } catch {
    return { ok: false, code: "invalid_request" };
  }
}
