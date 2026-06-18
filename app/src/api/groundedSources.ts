import type { Metadata } from "@/api/common";

export interface GroundedCitation {
  id: string;
  sourceIndex: number;
  occurrenceIndex: number;
  documentId: string;
  processId?: string;
  chunkId?: string;
  bucketId?: number;
  fileName?: string;
  fileType?: string;
  sourceUrl?: string;
  boundingBoxes?: unknown[];
  pageImages?: string[];
  pages?: unknown[];
  multimodalUrl?: string;
  score?: number;
  searchData?: Metadata;
  chunkText?: string;
  suggestedText?: string;
}

export type GroundedAnswerSegment =
  | { type: "content"; text: string }
  | { type: "citation"; citation: GroundedCitation };
