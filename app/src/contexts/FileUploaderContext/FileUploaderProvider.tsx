import { ReactNode, useCallback, useMemo } from "react";

import {
  completeFileUploaderUpload,
  createFileUploaderUpload,
  ingestFileUploaderUpload,
  prepareFileUploaderUpload,
} from "@/api/entities/fileUploaderEntity";
import { Metadata } from "@/api/common";

import { FileUploaderContext } from "./FileUploaderContext";

function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

export function FileUploaderProvider({ children }: { children: ReactNode }) {
  const uploadFilesToGroundX = useCallback(
    async ({
      bucketId,
      files,
      filter,
      searchData,
      processLevel,
    }: {
      bucketId: number;
      files: File[];
      filter?: Metadata;
      searchData?: Metadata;
      processLevel?: "full" | "none";
    }) => {
      const processIds: string[] = [];

      for (const file of files) {
        const fileType = extensionOf(file.name);
        const createInput = { bucketId, fileName: file.name, fileType, fileSize: file.size, filter, searchData, processLevel };
        const session =
          fileType === "pdf" || fileType === "docx" || fileType === "pptx"
            ? await prepareFileUploaderUpload({ bucketId, fileName: file.name, fileType: fileType as "pdf" | "docx" | "pptx", filter, searchData, processLevel }, file)
            : await createFileUploaderUpload(createInput);

        const completedParts: Array<{ partId: string; hostedUrl?: string }> = [];
        for (const part of session.parts.filter((candidate) => !candidate.uploaded)) {
          const uploadResponse = await fetch(part.upload.url, {
            method: part.upload.method,
            headers: part.upload.headers,
            body: file,
          });
          if (!uploadResponse.ok) {
            throw new Error(`Upload failed for ${part.fileName}`);
          }
          completedParts.push({
            partId: part.partId,
            hostedUrl: uploadResponse.headers.get("GX-HOSTED-URL") ?? undefined,
          });
        }

        await completeFileUploaderUpload(session.uploadId, { parts: completedParts });
        const ingest = await ingestFileUploaderUpload(session.uploadId);
        processIds.push(ingest.ingest.processId);
      }

      return { processIds };
    },
    []
  );

  const value = useMemo(() => ({ uploadFilesToGroundX }), [uploadFilesToGroundX]);

  return <FileUploaderContext.Provider value={value}>{children}</FileUploaderContext.Provider>;
}

export default FileUploaderProvider;
