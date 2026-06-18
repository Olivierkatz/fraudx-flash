import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

import { FileUploaderContext } from "@/contexts/FileUploaderContext";
import { renderWithAppProviders } from "@/test/renderWithAppProviders";

import GroundXFileUploader from "./GroundXFileUploader";

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error("File input not found");
  return input;
}

describe("GroundXFileUploader", () => {
  it("connects the UI to FileUploaderProvider context with bucket metadata and callbacks once", async () => {
    const uploadFilesToGroundX = vi.fn().mockResolvedValue({ processIds: ["process-1"] });
    const onIngestStarted = vi.fn();

    renderWithAppProviders(
      <FileUploaderContext.Provider value={{ uploadFilesToGroundX }}>
        <GroundXFileUploader
          bucketId={7}
          bucketName="Claims"
          filter={{ workspace: "claims" }}
          searchData={{ source: "portal" }}
          processLevel="full"
          onIngestStarted={onIngestStarted}
        />
      </FileUploaderContext.Provider>
    );

    fireEvent.change(fileInput(), { target: { files: [new File(["hello"], "claim.csv", { type: "text/csv" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() =>
      expect(uploadFilesToGroundX).toHaveBeenCalledWith({
        bucketId: 7,
        files: [expect.objectContaining({ name: "claim.csv" })],
        filter: { workspace: "claims" },
        searchData: { source: "portal" },
        processLevel: "full",
      })
    );
    expect(onIngestStarted).toHaveBeenCalledWith(["process-1"]);
    expect(onIngestStarted).toHaveBeenCalledTimes(1);
  });
});
