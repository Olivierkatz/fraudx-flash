import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import axios from "@/api/axios";

import {
  cancelFileUploaderUpload,
  completeFileUploaderUpload,
  createFileUploaderUpload,
  getFileUploaderUpload,
  ingestFileUploaderUpload,
  prepareFileUploaderUpload,
} from "./fileUploaderEntity";

vi.mock("@/api/axios", () => ({
  default: {
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  },
}));

const mockAxios = axios as unknown as {
  post: Mock;
  put: Mock;
  delete: Mock;
  get: Mock;
};

describe("fileUploaderEntity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates upload sessions through the same-origin widget route", async () => {
    mockAxios.post.mockResolvedValue({ data: { uploadId: "u1", status: "ready", parts: [], requiresPreparation: false } });

    await createFileUploaderUpload({ bucketId: 7, fileName: "a.pdf", fileType: "pdf", fileSize: 12 });

    expect(mockAxios.post).toHaveBeenCalledWith(
      "/api/widgets/file-uploader/uploads",
      expect.objectContaining({ bucketId: 7, fileName: "a.pdf" })
    );
  });

  it("sends prepared PDF and Office uploads as FormData with JSON metadata and the original file", async () => {
    mockAxios.post.mockResolvedValue({ data: { uploadId: "u2", status: "ready", parts: [], requiresPreparation: true } });
    const file = new File(["deck"], "deck.pptx", {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });

    await prepareFileUploaderUpload(
      {
        bucketId: 7,
        fileName: "deck.pptx",
        fileType: "pptx",
        filter: { tenant: "claims" },
        searchData: { source: "portal" },
        processLevel: "none",
      },
      file
    );

    expect(mockAxios.post).toHaveBeenCalledWith("/api/widgets/file-uploader/prepare", expect.any(FormData));
    const body = mockAxios.post.mock.calls[0][1] as FormData;
    expect(JSON.parse(String(body.get("metadata")))).toEqual({
      bucketId: 7,
      fileName: "deck.pptx",
      fileType: "pptx",
      filter: { tenant: "claims" },
      searchData: { source: "portal" },
      processLevel: "none",
    });
    expect(body.get("file")).toBe(file);
  });

  it("completes, ingests, cancels, and reads uploads by encoded id", async () => {
    mockAxios.put.mockResolvedValue({ data: { uploadId: "u 1", status: "uploaded", sourceUrls: [] } });
    mockAxios.post.mockResolvedValue({ data: { uploadId: "u 1", status: "ingesting", ingest: { processId: "p1", status: "queued" } } });
    mockAxios.delete.mockResolvedValue({ data: { uploadId: "u 1", status: "cancelled" } });
    mockAxios.get.mockResolvedValue({ data: { uploadId: "u 1", status: "ready", fileName: "a.pdf", fileType: "pdf" } });

    await completeFileUploaderUpload("u 1", { parts: [{ partId: "p1", hostedUrl: "https://cdn.groundx.test/a.pdf" }] });
    await ingestFileUploaderUpload("u 1");
    await cancelFileUploaderUpload("u 1");
    await getFileUploaderUpload("u 1");

    expect(mockAxios.put).toHaveBeenCalledWith("/api/widgets/file-uploader/uploads/u%201/complete", {
      parts: [{ partId: "p1", hostedUrl: "https://cdn.groundx.test/a.pdf" }],
    });
    expect(mockAxios.post).toHaveBeenCalledWith("/api/widgets/file-uploader/uploads/u%201/ingest");
    expect(mockAxios.delete).toHaveBeenCalledWith("/api/widgets/file-uploader/uploads/u%201");
    expect(mockAxios.get).toHaveBeenCalledWith("/api/widgets/file-uploader/uploads/u%201");
  });
});
