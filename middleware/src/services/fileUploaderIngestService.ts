import { cleanHostedUrl, GroundXUploadService } from "./groundxUploadService.js";
import { mergeSplitSearchData, PdfSplitPlan } from "./pdfPreparationService.js";
import type { FileUploaderDocumentMetadata } from "./fileUploaderTypes.js";

export interface GroundXRemoteIngestClient {
  ingestRemote(input: { documents: Array<Record<string, unknown>> }): Promise<{ ingest: { processId: string; status: string } }>;
}

export function buildGroundXDocuments(input: {
  metadata: FileUploaderDocumentMetadata;
  sourceUrls: string[];
  sourceParts?: Array<{ sourceUrl: string; fileName?: string; fileType?: string }>;
  originalFileName?: string;
  originalFileType?: string;
  splitPlan?: PdfSplitPlan;
}): Array<Record<string, unknown>> {
  const splitPlan = input.splitPlan;
  const fileType = input.originalFileType ? "pdf" : input.metadata.fileType;
  const sources: Array<{ sourceUrl: string; fileName?: string; fileType?: string }> = input.sourceParts?.length
    ? input.sourceParts
    : input.sourceUrls.map((sourceUrl) => ({ sourceUrl }));

  return sources.map((source, index) => {
    const splitPart = splitPlan?.parts[index];
    const searchData = splitPart
      ? mergeSplitSearchData({
          searchData: input.metadata.searchData,
          originalFileName: input.originalFileName ?? input.metadata.fileName,
          originalFileType: input.originalFileType ?? input.metadata.fileType,
          splitSourceId: splitPlan.splitSourceId,
          splitPart: splitPart.part,
          splitTotal: splitPlan.total,
        })
      : {
          ...(input.metadata.searchData ?? {}),
          ...(input.originalFileName ? { originalFileName: input.originalFileName } : {}),
          ...(input.originalFileType ? { originalFileType: input.originalFileType } : {}),
        };

    return {
      bucketId: input.metadata.bucketId,
      sourceUrl: source.sourceUrl,
      fileName: source.fileName ?? input.metadata.fileName,
      fileType: source.fileType ?? fileType,
      processLevel: input.metadata.processLevel ?? "full",
      ...(input.metadata.filter ? { filter: input.metadata.filter } : {}),
      searchData,
    };
  });
}

export async function createSingleGroundXUploadPart(input: {
  uploadId: string;
  partId: string;
  fileName: string;
  fileType: string;
  size: number;
  uploadService: GroundXUploadService;
}) {
  const upload = await input.uploadService.createUploadParameters(input.fileName, input.fileType);
  return {
    uploadId: input.uploadId,
    partId: input.partId,
    fileName: input.fileName,
    fileType: input.fileType,
    size: input.size,
    upload,
    hostedUrl: cleanHostedUrl(upload.url),
  };
}
