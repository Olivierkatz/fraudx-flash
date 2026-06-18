export const FILE_UPLOADER_SUPPORTED_EXTENSIONS = [
  "pdf",
  "docx",
  "pptx",
  "xlsx",
  "csv",
  "tsv",
  "json",
  "txt",
  "hwp",
  "bmp",
  "gif",
  "heic",
  "heif",
  "ico",
  "jpg",
  "jpeg",
  "png",
  "svg",
  "tif",
  "tiff",
  "webp",
] as const;

export type FileUploaderSupportedExtension = (typeof FILE_UPLOADER_SUPPORTED_EXTENSIONS)[number];

export interface FileUploaderCopyConfig {
  title: string;
  emptyState: string;
  dropzoneLabel: string;
  dropzoneHint: string;
  selectFilesLabel: string;
  uploadLabel: string;
  retryLabel: string;
  cancelLabel: string;
  clearCompletedLabel: string;
  conversionLabel: string;
  splittingLabel: string;
  educationAriaLabel: string;
  educationCopy: string;
}

export interface FileUploaderLimitsConfig {
  acceptedExtensions: FileUploaderSupportedExtension[];
  maxFiles: number;
  recommendedMaxFileSizeBytes: number;
  hardMaxFileSizeBytes: number;
  jsonHardMaxFileSizeBytes: number;
  recommendedMaxPdfPages: number;
  hardMaxPdfPages: number;
  batchSize: number;
}

export interface FileUploaderConfig {
  copy: FileUploaderCopyConfig;
  limits: FileUploaderLimitsConfig;
}

export type FileUploaderConfigInput = {
  copy?: Partial<FileUploaderCopyConfig>;
  limits?: Partial<FileUploaderLimitsConfig>;
};

export const defaultFileUploaderConfig: FileUploaderConfig = {
  copy: {
    title: "UPLOAD FILES",
    emptyState: "Add supported files to upload them into the selected GroundX bucket.",
    dropzoneLabel: "Drop files here",
    dropzoneHint: "PDFs can be split before ingest. DOCX and PPTX files are converted to PDF when middleware conversion is available.",
    selectFilesLabel: "Select files",
    uploadLabel: "Upload",
    retryLabel: "Retry",
    cancelLabel: "Cancel",
    clearCompletedLabel: "Clear completed",
    conversionLabel: "Converting to PDF",
    splittingLabel: "Splitting PDF",
    educationAriaLabel: "About file uploads",
    educationCopy:
      "Files are uploaded through GroundX-hosted storage, then ingested into the selected bucket. Large PDFs may be split so search results stay focused.",
  },
  limits: {
    acceptedExtensions: [...FILE_UPLOADER_SUPPORTED_EXTENSIONS],
    maxFiles: 20,
    recommendedMaxFileSizeBytes: 25 * 1024 * 1024,
    hardMaxFileSizeBytes: 50 * 1024 * 1024,
    jsonHardMaxFileSizeBytes: 5 * 1024 * 1024,
    recommendedMaxPdfPages: 200,
    hardMaxPdfPages: 750,
    batchSize: 10,
  },
};

export const GROUNDX_RECOMMENDED_MAX_DOCUMENTS_PER_BATCH = 20;

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

export function getFileExtension(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension && extension !== fileName.toLowerCase() ? extension : "";
}

export function createFileUploaderConfig(input: FileUploaderConfigInput = {}): FileUploaderConfig {
  const config: FileUploaderConfig = {
    copy: { ...defaultFileUploaderConfig.copy, ...input.copy },
    limits: { ...defaultFileUploaderConfig.limits, ...input.limits },
  };

  if (!config.copy.title.trim()) throw new Error("title is required");
  if (!config.copy.educationAriaLabel.trim()) throw new Error("educationAriaLabel is required");
  if (!config.copy.educationCopy.trim()) throw new Error("educationCopy is required");

  assertPositiveInteger(config.limits.maxFiles, "maxFiles");
  assertPositiveInteger(config.limits.recommendedMaxFileSizeBytes, "recommendedMaxFileSizeBytes");
  assertPositiveInteger(config.limits.hardMaxFileSizeBytes, "hardMaxFileSizeBytes");
  assertPositiveInteger(config.limits.jsonHardMaxFileSizeBytes, "jsonHardMaxFileSizeBytes");
  assertPositiveInteger(config.limits.recommendedMaxPdfPages, "recommendedMaxPdfPages");
  assertPositiveInteger(config.limits.hardMaxPdfPages, "hardMaxPdfPages");
  assertPositiveInteger(config.limits.batchSize, "batchSize");

  if (config.limits.recommendedMaxFileSizeBytes > config.limits.hardMaxFileSizeBytes) {
    throw new Error("recommendedMaxFileSizeBytes cannot exceed hardMaxFileSizeBytes");
  }
  if (config.limits.jsonHardMaxFileSizeBytes > config.limits.hardMaxFileSizeBytes) {
    throw new Error("jsonHardMaxFileSizeBytes cannot exceed hardMaxFileSizeBytes");
  }
  if (config.limits.recommendedMaxPdfPages > config.limits.hardMaxPdfPages) {
    throw new Error("recommendedMaxPdfPages cannot exceed hardMaxPdfPages");
  }
  if (config.limits.batchSize > config.limits.maxFiles) {
    throw new Error("batchSize cannot exceed maxFiles");
  }
  if (config.limits.batchSize > GROUNDX_RECOMMENDED_MAX_DOCUMENTS_PER_BATCH) {
    throw new Error("batchSize cannot exceed the GroundX recommended documents-per-batch limit");
  }
  if (!config.limits.acceptedExtensions.length) {
    throw new Error("acceptedExtensions must include at least one extension");
  }

  for (const extension of config.limits.acceptedExtensions) {
    if (!FILE_UPLOADER_SUPPORTED_EXTENSIONS.includes(extension)) {
      throw new Error(`Unsupported extension: ${extension}`);
    }
  }

  return config;
}
