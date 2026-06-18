import { randomUUID } from "node:crypto";

import { FileUploaderSession, FileUploaderDocumentMetadata } from "./fileUploaderTypes.js";
import { GroundXUploadParameters, GroundXUploadService } from "./groundxUploadService.js";
import { convertOfficeToPdf, OfficeConversionConfig } from "./officeConversionService.js";
import { createPdfSplitPlan, LlmSplitPlanner, PdfPreparationConfig, PdfSplitPlan } from "./pdfPreparationService.js";

export interface PreparedBinaryPart {
  fileName: string;
  fileType: string;
  bytes: Uint8Array;
}

export interface FileUploaderPreparationConfig {
  pdf: PdfPreparationConfig;
  office: OfficeConversionConfig;
}

export interface FileUploaderPreparationDependencies {
  uploadService: GroundXUploadService;
  countPdfPages: (bytes: Uint8Array) => Promise<number>;
  splitPdfBytes: (input: { bytes: Uint8Array; splitPlan: PdfSplitPlan; fileName: string }) => Promise<PreparedBinaryPart[]>;
  llmPlanner?: LlmSplitPlanner;
  convertOffice?: typeof convertOfficeToPdf;
}

export interface PrepareFileUploaderFileInput {
  uploadId: string;
  groundxUsername: string;
  metadata: FileUploaderDocumentMetadata & { fileSize: number };
  bytes: Uint8Array;
  config: FileUploaderPreparationConfig;
  dependencies: FileUploaderPreparationDependencies;
}

function isOffice(fileType: string): boolean {
  return fileType === "docx" || fileType === "pptx";
}

function pdfName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, ".pdf");
}

function assertSupportedPreparationInput(input: PrepareFileUploaderFileInput): void {
  const fileType = input.metadata.fileType.toLowerCase();
  if (fileType !== "pdf" && !isOffice(fileType)) {
    throw new Error("Only PDF, DOCX, and PPTX files can use the prepare route");
  }
  if (input.metadata.fileSize > input.config.pdf.hardMaxFileSizeBytes || input.bytes.byteLength > input.config.pdf.hardMaxFileSizeBytes) {
    throw new Error("File exceeds the hard upload size limit");
  }
}

async function uploadPreparedPart(input: {
  uploadId: string;
  part: PreparedBinaryPart;
  uploadService: GroundXUploadService;
}): Promise<{
  responsePart: {
    uploadId: string;
    partId: string;
    fileName: string;
    fileType: string;
    size: number;
    uploaded: true;
    upload: GroundXUploadParameters;
  };
  sessionPart: {
    partId: string;
    fileName: string;
    fileType: string;
    size: number;
    uploadUrl: string;
    hostedUrl: string;
    uploaded: true;
  };
}> {
  const partId = randomUUID();
  const upload = await input.uploadService.createUploadParameters(input.part.fileName, input.part.fileType);
  const hostedUrl = await input.uploadService.uploadBytes(upload, input.part.bytes);
  const size = input.part.bytes.byteLength;

  return {
    responsePart: {
      uploadId: input.uploadId,
      partId,
      fileName: input.part.fileName,
      fileType: input.part.fileType,
      size,
      uploaded: true,
      upload,
    },
    sessionPart: {
      partId,
      fileName: input.part.fileName,
      fileType: input.part.fileType,
      size,
      uploadUrl: upload.url,
      hostedUrl,
      uploaded: true,
    },
  };
}

export async function prepareFileUploaderFile(input: PrepareFileUploaderFileInput): Promise<{
  status: "ready";
  requiresPreparation: true;
  session: FileUploaderSession;
  parts: Array<{
    uploadId: string;
    partId: string;
    fileName: string;
    fileType: string;
    size: number;
    uploaded: true;
    upload: GroundXUploadParameters;
  }>;
}> {
  assertSupportedPreparationInput(input);
  const { uploadId, groundxUsername, config, dependencies } = input;
  const originalFileName = input.metadata.fileName;
  const originalFileType = input.metadata.fileType.toLowerCase();
  let workingBytes = input.bytes;
  let workingFileName = input.metadata.fileName;
  let workingFileType = originalFileType;
  let converted = false;

  if (isOffice(originalFileType)) {
    const conversion = await (dependencies.convertOffice ?? convertOfficeToPdf)({
      fileName: originalFileName,
      bytes: Buffer.from(input.bytes),
      config: config.office,
    });
    workingBytes = conversion.bytes;
    workingFileName = conversion.fileName || pdfName(originalFileName);
    workingFileType = "pdf";
    converted = true;
  }

  const preparedParts: PreparedBinaryPart[] = [];
  let splitPlan: PdfSplitPlan | undefined;
  if (workingFileType === "pdf") {
    const pageCount = await dependencies.countPdfPages(workingBytes);
    splitPlan = await createPdfSplitPlan({
      fileName: workingFileName,
      fileSize: workingBytes.byteLength,
      pageCount,
      config: config.pdf,
      llmPlanner: dependencies.llmPlanner,
    });
    if (splitPlan.total > 1) {
      preparedParts.push(...(await dependencies.splitPdfBytes({ bytes: workingBytes, splitPlan, fileName: workingFileName })));
    } else {
      preparedParts.push({ fileName: workingFileName, fileType: "pdf", bytes: workingBytes });
    }
  } else {
    preparedParts.push({ fileName: workingFileName, fileType: workingFileType, bytes: workingBytes });
  }

  const uploadedParts = [];
  for (const part of preparedParts) {
    uploadedParts.push(await uploadPreparedPart({ uploadId, part, uploadService: dependencies.uploadService }));
  }

  const metadata: FileUploaderDocumentMetadata = {
    ...input.metadata,
    fileName: workingFileName,
    fileType: workingFileType,
  };
  const session: FileUploaderSession = {
    uploadId,
    groundxUsername,
    status: "ready",
    metadata,
    parts: uploadedParts.map((part) => part.sessionPart),
    ...(converted ? { originalFileName, originalFileType } : {}),
    ...(splitPlan && splitPlan.total > 1 ? { splitPlan } : {}),
  };

  return {
    status: "ready",
    requiresPreparation: true,
    session,
    parts: uploadedParts.map((part) => part.responsePart),
  };
}
