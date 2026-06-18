export interface GroundXUploadServiceConfig {
  uploadBaseUrl: string;
  groundxApiKey?: string;
}

export interface GroundXUploadParameters {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
}

export interface GroundXUploadPart {
  uploadId: string;
  partId: string;
  fileName: string;
  fileType: string;
  size: number;
  upload: GroundXUploadParameters;
  hostedUrl?: string;
}

export interface GroundXUploadServiceFetch {
  (input: string | URL | Request, init?: RequestInit): Promise<Response>;
}

function firstHeaderValue(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? "");
  return String(value ?? "");
}

export function cleanHostedUrl(uploadUrl: string): string {
  const url = new URL(uploadUrl);
  url.search = "";
  return url.toString();
}

export function normalizeGroundXUploadResponse(input: unknown): GroundXUploadParameters {
  const data = input as { URL?: unknown; Method?: unknown; Header?: Record<string, unknown> };
  if (!data?.URL || typeof data.URL !== "string") throw new Error("GroundX upload response did not include URL");
  if (data.Method && data.Method !== "PUT") throw new Error("GroundX upload response method must be PUT");

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(data.Header ?? {})) {
    const normalized = firstHeaderValue(value);
    if (normalized) headers[key] = normalized;
  }

  return {
    url: data.URL,
    method: "PUT",
    headers,
  };
}

export class GroundXUploadService {
  constructor(
    private config: GroundXUploadServiceConfig,
    private fetchImpl: GroundXUploadServiceFetch = fetch
  ) {}

  async createUploadParameters(fileName: string, fileType: string): Promise<GroundXUploadParameters> {
    const requestUrl = new URL(`${this.config.uploadBaseUrl.replace(/\/$/, "")}/file`);
    requestUrl.searchParams.set("name", fileName);
    requestUrl.searchParams.set("type", fileType);

    const headers: Record<string, string> = {};
    if (this.config.groundxApiKey) headers["X-API-Key"] = this.config.groundxApiKey;
    const response = await this.fetchImpl(requestUrl, { headers });
    if (!response.ok) {
      throw new Error(`GroundX upload service failed with ${response.status}`);
    }

    return normalizeGroundXUploadResponse(await response.json());
  }

  async uploadBytes(upload: GroundXUploadParameters, bytes: Uint8Array): Promise<string> {
    const response = await this.fetchImpl(upload.url, {
      method: upload.method,
      headers: upload.headers,
      body: bytes,
    });
    if (!response.ok) {
      throw new Error(`GroundX hosted upload failed with ${response.status}`);
    }
    return response.headers.get("GX-HOSTED-URL") || cleanHostedUrl(upload.url);
  }
}
