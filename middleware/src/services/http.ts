export async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

export class UpstreamHttpError extends Error {
  readonly status: number;
  readonly upstreamStatus: number;

  constructor(label: string, status: number, detail?: string) {
    super(detail ? `${label}: ${detail}` : `${label}: HTTP ${status}`);
    this.name = "UpstreamHttpError";
    this.status = status;
    this.upstreamStatus = status;
  }
}

export async function upstreamError(response: Response, label: string): Promise<UpstreamHttpError> {
  const data = await readJson(response);
  let detail: string | undefined;
  if (data && typeof data === "object") {
    const body = data as Record<string, unknown>;
    if (typeof body.error === "string") detail = body.error;
    else if (typeof body.message === "string") detail = body.message;
    else if (typeof body.raw === "string") detail = body.raw.slice(0, 240);
  }
  return new UpstreamHttpError(label, response.status, detail);
}

export async function sendUpstreamResponse(response: Response, res: import("express").Response): Promise<void> {
  const data = await readJson(response);
  res.status(response.status).json(data);
}

export function basicAuth(email: string, password: string): string {
  return `Basic ${Buffer.from(`${email}:${password}`).toString("base64")}`;
}

export function ensureJsonHeaders(init: RequestInit = {}): Headers {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  return headers;
}
