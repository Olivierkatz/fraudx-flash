import { describe, expect, it, vi } from "vitest";

import { prepareFileUploaderFile } from "./fileUploaderPreparationService";
import { GroundXUploadService } from "./groundxUploadService";

function uploadService() {
  return new GroundXUploadService(
    { uploadBaseUrl: "https://api.eyelevel.ai/upload" },
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ URL: "https://uploads.groundx.test/part.pdf?sig=1", Header: {}, Method: "PUT" })
        )
      )
      .mockResolvedValueOnce(new Response("", { status: 200, headers: { "GX-HOSTED-URL": "https://cdn.groundx.test/part.pdf" } }))
  );
}

const config = {
  pdf: {
    recommendedMaxFileSizeBytes: 25 * 1024 * 1024,
    hardMaxFileSizeBytes: 50 * 1024 * 1024,
    recommendedMaxPdfPages: 200,
    hardMaxPdfPages: 750,
  },
  office: { enabled: true, command: "soffice", timeoutMs: 1000 },
};

describe("fileUploaderPreparationService", () => {
  it("converts Office files to PDF, uploads server-prepared bytes, and preserves attribution", async () => {
    const result = await prepareFileUploaderFile({
      uploadId: "u1",
      groundxUsername: "user@example.com",
      metadata: { bucketId: 7, fileName: "deck.pptx", fileType: "pptx", fileSize: 3 },
      bytes: new Uint8Array([1, 2, 3]),
      config,
      dependencies: {
        uploadService: uploadService(),
        countPdfPages: vi.fn().mockResolvedValue(10),
        splitPdfBytes: vi.fn(),
        convertOffice: vi.fn().mockResolvedValue({ fileName: "deck.pdf", bytes: Buffer.from("pdf") }),
      },
    });

    expect(result.parts[0]).toMatchObject({ fileName: "deck.pdf", fileType: "pdf", uploaded: true });
    expect(result.session).toMatchObject({
      metadata: { fileName: "deck.pdf", fileType: "pdf" },
      originalFileName: "deck.pptx",
      originalFileType: "pptx",
      parts: [{ hostedUrl: "https://cdn.groundx.test/part.pdf", uploaded: true }],
    });
  });

  it("splits large PDFs before upload and stores split metadata on the session", async () => {
    const service = new GroundXUploadService(
      { uploadBaseUrl: "https://api.eyelevel.ai/upload" },
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ URL: "https://uploads.groundx.test/1.pdf", Header: {}, Method: "PUT" })))
        .mockResolvedValueOnce(new Response("", { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ URL: "https://uploads.groundx.test/2.pdf", Header: {}, Method: "PUT" })))
        .mockResolvedValueOnce(new Response("", { status: 200 }))
    );

    const result = await prepareFileUploaderFile({
      uploadId: "u2",
      groundxUsername: "user@example.com",
      metadata: { bucketId: 7, fileName: "manual.pdf", fileType: "pdf", fileSize: 3 },
      bytes: new Uint8Array([1, 2, 3]),
      config,
      dependencies: {
        uploadService: service,
        countPdfPages: vi.fn().mockResolvedValue(250),
        splitPdfBytes: vi.fn().mockResolvedValue([
          { fileName: "manual-part-1.pdf", fileType: "pdf", bytes: new Uint8Array([1]) },
          { fileName: "manual-part-2.pdf", fileType: "pdf", bytes: new Uint8Array([2]) },
        ]),
      },
    });

    expect(result.parts).toHaveLength(2);
    expect(result.session.splitPlan).toMatchObject({ total: 2 });
    expect(result.session.parts.every((part) => part.uploaded)).toBe(true);
  });

  it("rejects unsupported prepare-route file types and files above hard upload limits", async () => {
    const dependencies = {
      uploadService: uploadService(),
      countPdfPages: vi.fn().mockResolvedValue(1),
      splitPdfBytes: vi.fn(),
    };

    await expect(
      prepareFileUploaderFile({
        uploadId: "u3",
        groundxUsername: "user@example.com",
        metadata: { bucketId: 7, fileName: "claims.csv", fileType: "csv", fileSize: 3 },
        bytes: new Uint8Array([1, 2, 3]),
        config,
        dependencies,
      })
    ).rejects.toThrow(/Only PDF, DOCX, and PPTX/);

    await expect(
      prepareFileUploaderFile({
        uploadId: "u4",
        groundxUsername: "user@example.com",
        metadata: { bucketId: 7, fileName: "huge.pdf", fileType: "pdf", fileSize: 51 * 1024 * 1024 },
        bytes: new Uint8Array([1, 2, 3]),
        config,
        dependencies,
      })
    ).rejects.toThrow(/hard upload size limit/);
  });
});
