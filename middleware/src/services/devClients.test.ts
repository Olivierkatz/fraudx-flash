import { describe, expect, it } from "vitest";

import { DevGroundXClient, DevGroundXPartnerClient, DevLlmClient } from "./devClients.js";

describe("development upstream clients", () => {
  it("returns deterministic Partner API project, bucket, group, and key data", async () => {
    const client = new DevGroundXPartnerClient();

    await expect(responseJson(client.forward("/project", { method: "GET", customerKey: "dev-user" }))).resolves.toMatchObject({
      mode: "development",
      customerKey: "dev-user",
      projects: expect.arrayContaining([expect.objectContaining({ projectId: "demo-project" })]),
    });
    await expect(responseJson(client.forward("/bucket", { method: "GET", customerKey: "dev-user" }))).resolves.toMatchObject({
      buckets: expect.arrayContaining([expect.objectContaining({ bucketId: "demo-bucket" })]),
    });
    await expect(responseJson(client.forward("/group", { method: "GET", customerKey: "dev-user" }))).resolves.toMatchObject({
      groups: expect.arrayContaining([expect.objectContaining({ groupId: "demo-group" })]),
    });
    await expect(responseJson(client.forward("/apikey", { method: "GET", customerKey: "dev-user" }))).resolves.toMatchObject({
      apiKeys: expect.arrayContaining([expect.objectContaining({ apiKey: "dev-groundx-api-key" })]),
    });
  });

  it("returns deterministic GroundX search, X-Ray, ingest, and workflow data", async () => {
    const client = new DevGroundXClient();

    await expect(
      responseJson(
        client.forward("/search/demo-bucket", {
          method: "POST",
          apiKey: "dev-key",
          body: JSON.stringify({ query: "workspace preview" }),
        }),
      ),
    ).resolves.toMatchObject({
      mode: "development",
      query: "workspace preview",
      hasApiKey: true,
      search: {
        results: expect.arrayContaining([expect.objectContaining({ documentId: "demo-doc-1", pageNumber: 2 })]),
      },
    });
    await expect(responseJson(client.forward("/document/demo-doc-1/xray", { method: "GET", apiKey: "dev-key" }))).resolves.toMatchObject({
      document: {
        documentId: "demo-doc-1",
        pages: expect.arrayContaining([
          expect.objectContaining({
            elements: expect.arrayContaining([expect.objectContaining({ type: "heading" })]),
          }),
        ]),
      },
    });
    await expect(responseJson(client.forward("/ingest/demo-bucket", { method: "POST", apiKey: "dev-key" }))).resolves.toMatchObject({
      ingest: { processId: "mock-process-1", status: "complete" },
    });
    await expect(responseJson(client.forward("/workflow", { method: "GET", apiKey: "dev-key" }))).resolves.toMatchObject({
      workflows: expect.arrayContaining([expect.objectContaining({ workflowId: "extract-invoice-fields" })]),
    });
  });

  it("returns a deterministic LLM chat-completion-shaped response", async () => {
    const client = new DevLlmClient();

    await expect(
      responseJson(
        client.forward("/chat/completions", {
          method: "POST",
          body: JSON.stringify({ messages: [{ role: "user", content: "Summarize this." }] }),
        }),
      ),
    ).resolves.toMatchObject({
      mode: "development",
      object: "chat.completion",
      requestMessageCount: 1,
      choices: [
        {
          message: expect.objectContaining({
            role: "assistant",
            content: expect.stringContaining("deterministic development response"),
          }),
        },
      ],
    });
  });
});

async function responseJson(responsePromise: Promise<Response>): Promise<unknown> {
  return (await responsePromise).json();
}
