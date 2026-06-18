import { ReactNode, useEffect } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

import {
  completeFileUploaderUpload,
  createFileUploaderUpload,
  ingestFileUploaderUpload,
  prepareFileUploaderUpload,
} from "@/api/entities/fileUploaderEntity";

import { FileUploaderProvider } from "./FileUploaderProvider";
import { useFileUploaderContext } from "./FileUploaderContext";

vi.mock("@/api/entities/fileUploaderEntity", () => ({
  createFileUploaderUpload: vi.fn(),
  prepareFileUploaderUpload: vi.fn(),
  completeFileUploaderUpload: vi.fn(),
  ingestFileUploaderUpload: vi.fn(),
}));

const mockCreate = vi.mocked(createFileUploaderUpload);
const mockPrepare = vi.mocked(prepareFileUploaderUpload);
const mockComplete = vi.mocked(completeFileUploaderUpload);
const mockIngest = vi.mocked(ingestFileUploaderUpload);

function Harness({ children }: { children: ReactNode }) {
  return <FileUploaderProvider>{children}</FileUploaderProvider>;
}

function Consumer({ file, onError }: { file: File; onError?: (error: unknown) => void }) {
  const { uploadFilesToGroundX } = useFileUploaderContext();
  useEffect(() => {
    void uploadFilesToGroundX({ bucketId: 7, files: [file], filter: { team: "claims" } }).catch(onError);
  }, [file, onError, uploadFilesToGroundX]);
  return null;
}

describe("FileUploaderProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads direct browser files, forwards hosted URLs to complete, and ingests remotely", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("", {
        status: 200,
        headers: { "GX-HOSTED-URL": "https://cdn.groundx.test/claims.csv" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    mockCreate.mockResolvedValue({
      uploadId: "u1",
      status: "ready",
      requiresPreparation: false,
      parts: [
        {
          uploadId: "u1",
          partId: "p1",
          fileName: "claims.csv",
          fileType: "csv",
          size: 3,
          upload: { url: "https://uploads.groundx.test/claims.csv", method: "PUT", headers: { "Content-Type": "text/csv" } },
        },
      ],
    });
    mockComplete.mockResolvedValue({ uploadId: "u1", status: "uploaded", sourceUrls: ["https://cdn.groundx.test/claims.csv"] });
    mockIngest.mockResolvedValue({ uploadId: "u1", status: "ingesting", ingest: { processId: "process-1", status: "queued" } });

    render(<Consumer file={new File(["csv"], "claims.csv", { type: "text/csv" })} />, { wrapper: Harness });

    await waitFor(() =>
      expect(mockComplete).toHaveBeenCalledWith("u1", {
        parts: [{ partId: "p1", hostedUrl: "https://cdn.groundx.test/claims.csv" }],
      })
    );
    expect(fetchMock).toHaveBeenCalledWith("https://uploads.groundx.test/claims.csv", {
      method: "PUT",
      headers: { "Content-Type": "text/csv" },
      body: expect.objectContaining({ name: "claims.csv" }),
    });
    expect(mockIngest).toHaveBeenCalledWith("u1");
  });

  it("uses prepare for Office/PDF files and skips browser PUTs for server-uploaded prepared parts", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockPrepare.mockResolvedValue({
      uploadId: "u2",
      status: "ready",
      requiresPreparation: true,
      parts: [
        {
          uploadId: "u2",
          partId: "p1",
          fileName: "deck.pdf",
          fileType: "pdf",
          size: 4,
          uploaded: true,
          upload: { url: "https://uploads.groundx.test/deck.pdf", method: "PUT", headers: {} },
        },
      ],
    });
    mockComplete.mockResolvedValue({ uploadId: "u2", status: "uploaded", sourceUrls: ["https://cdn.groundx.test/deck.pdf"] });
    mockIngest.mockResolvedValue({ uploadId: "u2", status: "ingesting", ingest: { processId: "process-2", status: "queued" } });

    render(<Consumer file={new File(["ppt"], "deck.pptx", { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" })} />, {
      wrapper: Harness,
    });

    await waitFor(() => expect(mockPrepare).toHaveBeenCalled());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockComplete).toHaveBeenCalledWith("u2", { parts: [] });
  });

  it("stops before complete and ingest when direct browser upload fails", async () => {
    const onError = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(new Response("blocked", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    mockCreate.mockResolvedValue({
      uploadId: "u3",
      status: "ready",
      requiresPreparation: false,
      parts: [
        {
          uploadId: "u3",
          partId: "p1",
          fileName: "claims.csv",
          fileType: "csv",
          size: 3,
          upload: { url: "https://uploads.groundx.test/claims.csv", method: "PUT", headers: {} },
        },
      ],
    });

    render(<Consumer file={new File(["csv"], "claims.csv", { type: "text/csv" })} onError={onError} />, { wrapper: Harness });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "Upload failed for claims.csv" })));
    await waitFor(() => expect(mockComplete).not.toHaveBeenCalled());
    expect(mockIngest).not.toHaveBeenCalled();
  });
});
