import express from "express";
import { createServer, Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MemoryFileUploaderRepository } from "../repositories/fileUploaderRepository.js";
import { FileUploaderSession } from "../services/fileUploaderTypes.js";
import { createFileUploaderRoute } from "./fileUploaderRoute.js";

let servers: Server[] = [];

async function startApp(options: { prepareFile?: any } = {}) {
  const repository = new MemoryFileUploaderRepository();
  const ingestClient = { ingestRemote: vi.fn().mockResolvedValue({ ingest: { processId: "process-1", status: "queued" } }) };
  const uploadService = {
    createUploadParameters: vi.fn().mockResolvedValue({
      url: "https://uploads.groundx.test/file.csv?signature=1",
      method: "PUT",
      headers: { "Content-Type": "text/csv" },
    }),
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api/widgets/file-uploader",
    createFileUploaderRoute({
      repository,
      uploadService: uploadService as any,
      ingestClient,
      requireSession: (req, res, next) => {
        const username = req.header("x-groundx-user");
        if (!username) {
          res.status(401).json({ error: "Authentication required" });
          return;
        }
        (req as any).session = { groundxUsername: username };
        next();
      },
      prepareFile: options.prepareFile,
    })
  );
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  });
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, repository, ingestClient, uploadService };
}

async function requestJson(url: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-groundx-user": "user@example.com",
      ...(init.headers ?? {}),
    },
  });
  return { response, body: await response.json() };
}

afterEach(async () => {
  const toClose = servers;
  servers = [];
  await Promise.all(toClose.map((server) => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))));
});

describe("fileUploaderRoute", () => {
  it("requires auth and creates upload sessions with GroundX upload-service instructions", async () => {
    const { url, uploadService } = await startApp();

    const unauthorized = await fetch(`${url}/api/widgets/file-uploader/uploads`, { method: "POST" });
    expect(unauthorized.status).toBe(401);

    const { body } = await requestJson(url, "/api/widgets/file-uploader/uploads", {
      method: "POST",
      body: JSON.stringify({ bucketId: 7, fileName: "file.csv", fileType: "csv", fileSize: 12 }),
    });

    expect(uploadService.createUploadParameters).toHaveBeenCalledWith("file.csv", "csv");
    expect(body).toMatchObject({
      status: "ready",
      requiresPreparation: false,
      parts: [{ fileName: "file.csv", fileType: "csv", upload: { method: "PUT" } }],
    });
  });

  it("rejects direct uploads that must be prepared or are outside GroundX widget limits", async () => {
    const { url, uploadService } = await startApp();

    await expect(
      requestJson(url, "/api/widgets/file-uploader/uploads", {
        method: "POST",
        body: JSON.stringify({ bucketId: 7, fileName: "file.exe", fileType: "csv", fileSize: 12 }),
      })
    ).resolves.toMatchObject({ response: expect.objectContaining({ status: 400 }) });

    await expect(
      requestJson(url, "/api/widgets/file-uploader/uploads", {
        method: "POST",
        body: JSON.stringify({ bucketId: 7, fileName: "deck.pptx", fileType: "pptx", fileSize: 12 }),
      })
    ).resolves.toMatchObject({ response: expect.objectContaining({ status: 400 }) });

    await expect(
      requestJson(url, "/api/widgets/file-uploader/uploads", {
        method: "POST",
        body: JSON.stringify({ bucketId: 7, fileName: "large.pdf", fileType: "pdf", fileSize: 26 * 1024 * 1024 }),
      })
    ).resolves.toMatchObject({ response: expect.objectContaining({ status: 400 }) });

    await expect(
      requestJson(url, "/api/widgets/file-uploader/uploads", {
        method: "POST",
        body: JSON.stringify({ bucketId: 7, fileName: "malware.exe", fileType: "exe", fileSize: 12 }),
      })
    ).resolves.toMatchObject({ response: expect.objectContaining({ status: 400 }) });

    await expect(
      requestJson(url, "/api/widgets/file-uploader/uploads", {
        method: "POST",
        body: JSON.stringify({ bucketId: 7, fileName: "payload.json", fileType: "json", fileSize: 6 * 1024 * 1024 }),
      })
    ).resolves.toMatchObject({ response: expect.objectContaining({ status: 400 }) });

    expect(uploadService.createUploadParameters).not.toHaveBeenCalled();
  });

  it("accepts browser-returned hosted URLs on complete and uses them for remote ingest", async () => {
    const { url, ingestClient } = await startApp();
    const created = await requestJson(url, "/api/widgets/file-uploader/uploads", {
      method: "POST",
      body: JSON.stringify({ bucketId: 7, fileName: "file.csv", fileType: "csv", fileSize: 12, searchData: { source: "portal" } }),
    });
    const uploadId = created.body.uploadId;
    const partId = created.body.parts[0].partId;

    await requestJson(url, `/api/widgets/file-uploader/uploads/${uploadId}/complete`, {
      method: "PUT",
      body: JSON.stringify({ parts: [{ partId, hostedUrl: "https://cdn.groundx.test/file.csv" }] }),
    });
    await requestJson(url, `/api/widgets/file-uploader/uploads/${uploadId}/ingest`, { method: "POST" });

    expect(ingestClient.ingestRemote).toHaveBeenCalledWith({
      documents: [
        expect.objectContaining({
          bucketId: 7,
          sourceUrl: "https://cdn.groundx.test/file.csv",
          fileName: "file.csv",
          fileType: "csv",
          searchData: { source: "portal" },
        }),
      ],
    });
  });

  it("requires direct browser uploads to complete every part before ingest", async () => {
    const { url, ingestClient } = await startApp();
    const created = await requestJson(url, "/api/widgets/file-uploader/uploads", {
      method: "POST",
      body: JSON.stringify({ bucketId: 7, fileName: "file.csv", fileType: "csv", fileSize: 12 }),
    });

    const earlyIngest = await requestJson(url, `/api/widgets/file-uploader/uploads/${created.body.uploadId}/ingest`, { method: "POST" });
    expect(earlyIngest.response.status).toBe(409);

    const incomplete = await requestJson(url, `/api/widgets/file-uploader/uploads/${created.body.uploadId}/complete`, {
      method: "PUT",
      body: JSON.stringify({ parts: [] }),
    });
    expect(incomplete.response.status).toBe(400);

    await requestJson(url, `/api/widgets/file-uploader/uploads/${created.body.uploadId}/complete`, {
      method: "PUT",
      body: JSON.stringify({ parts: [{ partId: created.body.parts[0].partId }] }),
    });
    const ingest = await requestJson(url, `/api/widgets/file-uploader/uploads/${created.body.uploadId}/ingest`, { method: "POST" });

    expect(ingest.response.status).toBe(200);
    expect(ingestClient.ingestRemote).toHaveBeenCalledWith({
      documents: [
        expect.objectContaining({
          sourceUrl: "https://uploads.groundx.test/file.csv",
          fileName: "file.csv",
          fileType: "csv",
        }),
      ],
    });
  });

  it("ingests prepared split parts with per-part file names and split attribution", async () => {
    const { url, ingestClient } = await startApp({
      prepareFile: async ({ uploadId, groundxUsername }: { uploadId: string; groundxUsername: string }) => ({
        status: "ready" as const,
        requiresPreparation: true as const,
        session: {
          uploadId,
          groundxUsername,
          status: "ready" as const,
          metadata: {
            bucketId: 7,
            fileName: "manual.pdf",
            fileType: "pdf",
            filter: { product: "claims" },
            searchData: { source: "portal" },
          },
          parts: [
            {
              partId: "part-1",
              fileName: "manual-part-1-of-2.pdf",
              fileType: "pdf",
              size: 10,
              uploadUrl: "https://uploads.groundx.test/manual-part-1-of-2.pdf?signature=1",
              hostedUrl: "https://cdn.groundx.test/manual-part-1-of-2.pdf",
              uploaded: true,
            },
            {
              partId: "part-2",
              fileName: "manual-part-2-of-2.pdf",
              fileType: "pdf",
              size: 10,
              uploadUrl: "https://uploads.groundx.test/manual-part-2-of-2.pdf?signature=1",
              hostedUrl: "https://cdn.groundx.test/manual-part-2-of-2.pdf",
              uploaded: true,
            },
          ],
          splitPlan: {
            splitSourceId: "split-1",
            total: 2,
            parts: [
              { part: 1, startPage: 1, endPage: 200 },
              { part: 2, startPage: 201, endPage: 250 },
            ],
          },
        },
        parts: [],
      }),
    });

    const prepared = await requestJson(url, "/api/widgets/file-uploader/prepare", { method: "POST", body: "{}" });
    await requestJson(url, `/api/widgets/file-uploader/uploads/${prepared.body.uploadId}/ingest`, { method: "POST" });

    expect(ingestClient.ingestRemote).toHaveBeenCalledWith({
      documents: [
        {
          bucketId: 7,
          sourceUrl: "https://cdn.groundx.test/manual-part-1-of-2.pdf",
          fileName: "manual-part-1-of-2.pdf",
          fileType: "pdf",
          processLevel: "full",
          filter: { product: "claims" },
          searchData: {
            source: "portal",
            originalFileName: "manual.pdf",
            originalFileType: "pdf",
            splitSourceId: "split-1",
            splitPart: 1,
            splitTotal: 2,
          },
        },
        {
          bucketId: 7,
          sourceUrl: "https://cdn.groundx.test/manual-part-2-of-2.pdf",
          fileName: "manual-part-2-of-2.pdf",
          fileType: "pdf",
          processLevel: "full",
          filter: { product: "claims" },
          searchData: {
            source: "portal",
            originalFileName: "manual.pdf",
            originalFileType: "pdf",
            splitSourceId: "split-1",
            splitPart: 2,
            splitTotal: 2,
          },
        },
      ],
    });
  });

  it("rejects prepared ingest sessions that exceed GroundX's recommended remote-ingest batch size", async () => {
    const oversizedParts = Array.from({ length: 21 }, (_, index) => ({
      partId: `part-${index + 1}`,
      fileName: `manual-part-${index + 1}.pdf`,
      fileType: "pdf",
      size: 10,
      uploadUrl: `https://uploads.groundx.test/manual-part-${index + 1}.pdf?signature=1`,
      hostedUrl: `https://cdn.groundx.test/manual-part-${index + 1}.pdf`,
      uploaded: true,
    }));
    const { url, ingestClient } = await startApp({
      prepareFile: async ({ uploadId, groundxUsername }: { uploadId: string; groundxUsername: string }) => ({
        status: "ready" as const,
        requiresPreparation: true as const,
        session: {
          uploadId,
          groundxUsername,
          status: "ready" as const,
          metadata: { bucketId: 7, fileName: "manual.pdf", fileType: "pdf" },
          parts: oversizedParts,
        },
        parts: [],
      }),
    });

    const prepared = await requestJson(url, "/api/widgets/file-uploader/prepare", { method: "POST", body: "{}" });
    const ingest = await requestJson(url, `/api/widgets/file-uploader/uploads/${prepared.body.uploadId}/ingest`, { method: "POST" });

    expect(ingest.response.status).toBe(400);
    expect(ingest.body.error).toMatch(/recommended remote-ingest batch size/i);
    expect(ingestClient.ingestRemote).not.toHaveBeenCalled();
  });

  it("does not allow one authenticated user to read or mutate another user's upload session", async () => {
    const { url, repository } = await startApp();
    const session: FileUploaderSession = {
      uploadId: "u-private",
      groundxUsername: "other@example.com",
      status: "ready",
      metadata: { bucketId: 7, fileName: "file.csv", fileType: "csv" },
      parts: [{ partId: "p1", fileName: "file.csv", fileType: "csv", size: 12, uploadUrl: "https://uploads.groundx.test/file.csv" }],
    };
    await repository.saveSession(session);

    const read = await requestJson(url, "/api/widgets/file-uploader/uploads/u-private");
    const complete = await requestJson(url, "/api/widgets/file-uploader/uploads/u-private/complete", { method: "PUT" });
    const remove = await requestJson(url, "/api/widgets/file-uploader/uploads/u-private", { method: "DELETE" });

    expect(read.response.status).toBe(404);
    expect(complete.response.status).toBe(404);
    expect(remove.response.status).toBe(404);
  });

  it("returns clear prepare-route configuration errors until multipart preparation is wired", async () => {
    const { url } = await startApp();

    const { response, body } = await requestJson(url, "/api/widgets/file-uploader/prepare", { method: "POST", body: "{}" });

    expect(response.status).toBe(503);
    expect(body.error).toMatch(/File preparation is not configured/);
  });
});
