import { FileUploaderConfig, getFileExtension } from "./fileUploaderConfig";

export interface FileValidationInput {
  file: Pick<File, "name" | "size">;
  config: FileUploaderConfig;
  existingNames?: string[];
  pdfPageCount?: number;
}

export interface FileValidationResult {
  valid: boolean;
  requiresPreparation: boolean;
  reasons: string[];
}

export function validateFileForGroundXUpload({
  file,
  config,
  existingNames = [],
  pdfPageCount,
}: FileValidationInput): FileValidationResult {
  const reasons: string[] = [];
  const extension = getFileExtension(file.name);
  const normalizedExistingNames = existingNames.map((name) => name.toLowerCase());

  if (!extension || !config.limits.acceptedExtensions.includes(extension as never)) {
    reasons.push(`.${extension || "file"} is not supported`);
  }

  if (normalizedExistingNames.includes(file.name.toLowerCase())) {
    reasons.push(`${file.name} is already in the upload queue`);
  }

  if (file.size > config.limits.hardMaxFileSizeBytes) {
    reasons.push(`${file.name} is larger than the hard upload limit`);
  }

  if (extension === "json" && file.size > config.limits.jsonHardMaxFileSizeBytes) {
    reasons.push(`${file.name} is larger than the GroundX JSON file limit`);
  }

  if (extension === "pdf" && pdfPageCount && pdfPageCount > config.limits.hardMaxPdfPages) {
    reasons.push(`${file.name} is above the hard PDF page limit`);
  }

  const requiresPreparation =
    extension === "docx" ||
    extension === "pptx" ||
    (extension === "pdf" &&
      ((pdfPageCount ?? 0) > config.limits.recommendedMaxPdfPages ||
        file.size > config.limits.recommendedMaxFileSizeBytes));

  return {
    valid: reasons.length === 0,
    requiresPreparation,
    reasons,
  };
}
