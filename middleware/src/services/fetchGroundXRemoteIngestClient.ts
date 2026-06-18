import type { GroundXRemoteIngestClient } from "./fileUploaderIngestService.js";

export class FetchGroundXRemoteIngestClient implements GroundXRemoteIngestClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor({ groundxBaseUrl, groundxApiKey }: { groundxBaseUrl: string; groundxApiKey: string }) {
    this.baseUrl = groundxBaseUrl.replace(/\/$/, "");
    this.apiKey = groundxApiKey;
  }

  async ingestRemote(input: { documents: Array<Record<string, unknown>> }): Promise<{ ingest: { processId: string; status: string } }> {
    const res = await fetch(`${this.baseUrl}/ingest/documents/remote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
      },
      body: JSON.stringify({ documents: input.documents }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw Object.assign(new Error(`GroundX ingest error ${res.status}: ${body.slice(0, 200)}`), { status: res.status });
    }
    return res.json() as Promise<{ ingest: { processId: string; status: string } }>;
  }
}
