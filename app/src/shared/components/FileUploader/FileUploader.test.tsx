import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

import { renderWithAppProviders } from "@/test/renderWithAppProviders";

import FileUploader from "./FileUploader";

function makeFile(name: string, size = 1024, type = "application/pdf") {
  return new File(["x".repeat(size)], name, { type });
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error("File input not found");
  return input;
}

function selectFiles(files: File | File[]) {
  fireEvent.change(fileInput(), { target: { files: Array.isArray(files) ? files : [files] } });
}

describe("FileUploader", () => {
  it("renders the GroundX upload surface and educational tooltip", async () => {
    renderWithAppProviders(<FileUploader bucketId={7} bucketName="Claims" onUploadFiles={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "UPLOAD FILES" })).toBeInTheDocument();
    expect(screen.getByText("Claims")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "About file uploads" })).toBeInTheDocument();
  });

  it("adds accepted files and uploads queued items", async () => {
    const onUploadFiles = vi.fn().mockResolvedValue({ processIds: ["process-1"] });
    const onIngestStarted = vi.fn();
    const onUploadComplete = vi.fn();

    renderWithAppProviders(
      <FileUploader
        bucketId={7}
        onUploadFiles={onUploadFiles}
        onIngestStarted={onIngestStarted}
        onUploadComplete={onUploadComplete}
      />
    );

    selectFiles(makeFile("guide.pdf"));
    expect(screen.getByText("guide.pdf")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() => expect(onUploadFiles).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("COMPLETE")).toBeInTheDocument();
    expect(onIngestStarted).toHaveBeenCalledWith(["process-1"]);
    expect(onUploadComplete.mock.calls[0][0][0]).toMatchObject({ file: expect.objectContaining({ name: "guide.pdf" }), processId: "process-1" });
  });

  it("uploads queued items in conservative batches below GroundX's recommended ingest limit", async () => {
    const onUploadFiles = vi
      .fn()
      .mockResolvedValueOnce({ processIds: ["process-1", "process-2"] })
      .mockResolvedValueOnce({ processIds: ["process-3", "process-4"] })
      .mockResolvedValueOnce({ processIds: ["process-5"] });
    const onIngestStarted = vi.fn();
    const files = Array.from({ length: 5 }, (_, index) => makeFile(`guide-${index}.csv`, 10, "text/csv"));

    renderWithAppProviders(
      <FileUploader
        bucketId={7}
        config={{ limits: { acceptedExtensions: ["csv"], maxFiles: 5, batchSize: 2 } }}
        onUploadFiles={onUploadFiles}
        onIngestStarted={onIngestStarted}
      />
    );

    selectFiles(files);
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() => expect(onUploadFiles).toHaveBeenCalledTimes(3));
    expect(onUploadFiles.mock.calls.map(([items]) => items.map((item: { file: File }) => item.file.name))).toEqual([
      ["guide-0.csv", "guide-1.csv"],
      ["guide-2.csv", "guide-3.csv"],
      ["guide-4.csv"],
    ]);
    expect(onIngestStarted).toHaveBeenCalledWith(["process-1", "process-2", "process-3", "process-4", "process-5"]);
  });

  it("marks DOCX files for conversion and unsupported files as errors", async () => {
    renderWithAppProviders(<FileUploader bucketId={7} onUploadFiles={vi.fn()} />);

    selectFiles(
      makeFile("brief.docx", 1024, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    );
    fireEvent.drop(screen.getByRole("button", { name: "Select files" }), {
      dataTransfer: { files: [makeFile("app.exe", 1024, "application/octet-stream")] },
    });

    expect(screen.getByText("brief.docx")).toBeInTheDocument();
    expect(screen.getByText(/Converting to PDF/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/not supported/i);
  });

  it("exposes retry for failed uploads and removes completed items", async () => {
    const onUploadFiles = vi.fn().mockRejectedValueOnce(new Error("Network unavailable")).mockResolvedValueOnce(undefined);

    renderWithAppProviders(<FileUploader bucketId={7} onUploadFiles={onUploadFiles} />);

    selectFiles(makeFile("guide.pdf"));
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Network unavailable/i);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    expect(await screen.findByText("COMPLETE")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear completed" }));
    expect(screen.queryByText("guide.pdf")).not.toBeInTheDocument();
  });
});
