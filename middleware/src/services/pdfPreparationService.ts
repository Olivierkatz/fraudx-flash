import { createHash, randomUUID } from "node:crypto";

export interface PdfPreparationConfig {
  recommendedMaxFileSizeBytes: number;
  hardMaxFileSizeBytes: number;
  recommendedMaxPdfPages: number;
  hardMaxPdfPages: number;
}

export interface PdfSplitPlanPart {
  part: number;
  startPage: number;
  endPage: number;
}

export interface PdfSplitPlan {
  splitSourceId: string;
  total: number;
  parts: PdfSplitPlanPart[];
}

export interface LlmSplitPlanner {
  planPdfSplit(input: { fileName: string; pageCount: number; maxPagesPerPart: number }): Promise<PdfSplitPlanPart[]>;
}

export function createSplitSourceId(fileName: string, fileSize: number, seed: string = randomUUID()): string {
  return createHash("sha256").update(`${fileName}:${fileSize}:${seed}`).digest("hex").slice(0, 32);
}

export function deterministicPdfSplit(pageCount: number, maxPagesPerPart: number): PdfSplitPlanPart[] {
  if (pageCount <= 0) throw new Error("pageCount must be positive");
  if (maxPagesPerPart <= 0) throw new Error("maxPagesPerPart must be positive");

  const parts: PdfSplitPlanPart[] = [];
  for (let startPage = 1; startPage <= pageCount; startPage += maxPagesPerPart) {
    const endPage = Math.min(pageCount, startPage + maxPagesPerPart - 1);
    parts.push({ part: parts.length + 1, startPage, endPage });
  }
  return parts;
}

function isValidPdfSplitPlan(parts: PdfSplitPlanPart[] | undefined, pageCount: number, maxPagesPerPart: number): boolean {
  if (!parts?.length) return false;

  let expectedStartPage = 1;
  for (const part of parts) {
    if (!Number.isInteger(part.startPage) || !Number.isInteger(part.endPage)) return false;
    if (part.startPage !== expectedStartPage) return false;
    if (part.endPage < part.startPage || part.endPage > pageCount) return false;
    if (part.endPage - part.startPage + 1 > maxPagesPerPart) return false;
    expectedStartPage = part.endPage + 1;
  }

  return expectedStartPage === pageCount + 1;
}

export async function createPdfSplitPlan(input: {
  fileName: string;
  fileSize: number;
  pageCount: number;
  config: PdfPreparationConfig;
  llmPlanner?: LlmSplitPlanner;
}): Promise<PdfSplitPlan> {
  const { fileName, fileSize, pageCount, config, llmPlanner } = input;
  if (fileSize > config.hardMaxFileSizeBytes) {
    throw new Error("PDF exceeds the hard file size limit");
  }
  if (pageCount > config.hardMaxPdfPages) {
    throw new Error("PDF exceeds the hard page limit");
  }

  const sizeBasedMaxPages =
    fileSize > config.recommendedMaxFileSizeBytes
      ? Math.max(1, Math.floor((pageCount * config.recommendedMaxFileSizeBytes) / fileSize))
      : config.recommendedMaxPdfPages;
  const maxPagesPerPart = Math.min(config.recommendedMaxPdfPages, sizeBasedMaxPages);

  if (pageCount <= maxPagesPerPart) {
    return {
      splitSourceId: createSplitSourceId(fileName, fileSize, "single"),
      total: 1,
      parts: [{ part: 1, startPage: 1, endPage: pageCount }],
    };
  }

  let parts: PdfSplitPlanPart[] | undefined;
  if (llmPlanner) {
    try {
      parts = await llmPlanner.planPdfSplit({ fileName, pageCount, maxPagesPerPart });
    } catch {
      parts = undefined;
    }
  }

  const safeParts: PdfSplitPlanPart[] =
    parts && isValidPdfSplitPlan(parts, pageCount, maxPagesPerPart)
      ? parts.map((part, index) => ({ ...part, part: index + 1 }))
      : deterministicPdfSplit(pageCount, maxPagesPerPart);

  return {
    splitSourceId: createSplitSourceId(fileName, fileSize),
    total: safeParts.length,
    parts: safeParts,
  };
}

export function mergeSplitSearchData(input: {
  searchData?: Record<string, unknown>;
  originalFileName: string;
  originalFileType: string;
  splitSourceId: string;
  splitPart: number;
  splitTotal: number;
}): Record<string, unknown> {
  return {
    ...(input.searchData ?? {}),
    originalFileName: input.originalFileName,
    originalFileType: input.originalFileType,
    splitSourceId: input.splitSourceId,
    splitPart: input.splitPart,
    splitTotal: input.splitTotal,
  };
}
