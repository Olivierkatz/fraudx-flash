export interface GroundXClient {
  forward(path: string, init: RequestInit & { apiKey: string }): Promise<Response>;
}

export interface LlmClient {
  forward(path: string, init: RequestInit): Promise<Response>;
}

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
  searchData?: Record<string, unknown>;
  chunkText?: string;
  suggestedText?: string;
}

export type GroundedAnswerSegment =
  | { type: "content"; text: string }
  | { type: "citation"; citation: GroundedCitation };

export interface GroundXSearchResult {
  documentId?: string;
  processId?: string;
  chunkId?: string;
  bucketId?: number;
  fileName?: string;
  fileType?: string;
  sourceUrl?: string;
  text?: string;
  suggestedText?: string;
  boundingBoxes?: unknown[];
  pageImages?: string[];
  pages?: unknown[];
  multimodalUrl?: string;
  score?: number;
  searchData?: Record<string, unknown>;
}

export interface GroundXSearchResponse {
  search?: {
    text?: string;
    results?: GroundXSearchResult[];
  };
}

export async function readUpstreamJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new Error(`Upstream request failed with ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

export function citationFromSearchResult(result: GroundXSearchResult, index: number): GroundedCitation {
  return {
    id: `${result.documentId ?? "source"}-${index + 1}`,
    sourceIndex: index + 1,
    occurrenceIndex: 1,
    documentId: result.documentId ?? `source-${index + 1}`,
    processId: result.processId,
    chunkId: result.chunkId,
    bucketId: result.bucketId,
    fileName: result.fileName,
    fileType: result.fileType,
    sourceUrl: result.sourceUrl,
    boundingBoxes: result.boundingBoxes,
    pageImages: result.pageImages,
    pages: result.pages,
    multimodalUrl: result.multimodalUrl,
    score: result.score,
    searchData: result.searchData,
    chunkText: result.suggestedText ?? result.text,
    suggestedText: result.suggestedText,
  };
}

export function segmentsFromGroundedAnswer(
  answer: string,
  citations: GroundedCitation[],
  options: { appendFallbackCitations?: boolean; fallbackCitationLimit?: number } = {}
): GroundedAnswerSegment[] {
  const citationByIndex = new Map(citations.map((citation) => [citation.sourceIndex, citation]));
  const segments: GroundedAnswerSegment[] = [];
  const tokenPattern = /\[\[?(\d+)]]?/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(answer))) {
    if (match.index > cursor) segments.push({ type: "content", text: answer.slice(cursor, match.index) });
    const citation = citationByIndex.get(Number(match[1]));
    if (citation) segments.push({ type: "citation", citation });
    cursor = match.index + match[0].length;
  }

  if (cursor < answer.length) segments.push({ type: "content", text: answer.slice(cursor) });
  if (segments.length === 0) segments.push({ type: "content", text: answer });

  if (!segments.some((segment) => segment.type === "citation") && options.appendFallbackCitations) {
    const limit = options.fallbackCitationLimit ?? 3;
    return [...segments, ...citations.slice(0, limit).map((citation) => ({ type: "citation" as const, citation }))];
  }

  return segments;
}

export function llmAnswerFromResponse(input: unknown, fallback: string): string {
  const data = input as {
    answer?: unknown;
    text?: unknown;
    choices?: Array<{ message?: { content?: unknown }; text?: unknown }>;
  };
  if (typeof data.answer === "string") return data.answer;
  if (typeof data.text === "string") return data.text;
  const firstChoice = data.choices?.[0];
  if (typeof firstChoice?.message?.content === "string") return firstChoice.message.content;
  if (typeof firstChoice?.text === "string") return firstChoice.text;
  return fallback;
}

export function sourceContextFromResults(results: GroundXSearchResult[]): string {
  return results
    .map((result, index) => {
      const text = result.suggestedText ?? result.text ?? "";
      const attribution = [result.fileName, result.documentId].filter(Boolean).join(" | ");
      return `[${index + 1}] ${attribution}\n${text}`;
    })
    .join("\n\n");
}

export function hasGroundedAnswerContent(segments: GroundedAnswerSegment[]): boolean {
  return segments.some((segment) => segment.type === "content" && segment.text.trim()) || segments.some((segment) => segment.type === "citation");
}
