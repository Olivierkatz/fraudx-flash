import type { ContentScope } from "./contentScope.js";
import type {
  GroundedAnswerSegment,
  GroundedCitation,
  GroundXSearchResponse,
  GroundXSearchResult,
} from "./groundedGeneration.js";

export type ChatWithSourcesScope =
  | { type: "bucket"; bucketId: string | number; label?: string }
  | { type: "group"; groupId: string | number; label?: string };

export type ChatWithSourcesCitation = GroundedCitation;
export type ChatWithSourcesSegment = GroundedAnswerSegment;

export interface ChatWithSourcesMessage {
  id: string;
  role: "user" | "assistant";
  segments: ChatWithSourcesSegment[];
  createdAt: string;
}

export interface ChatWithSourcesSession {
  sessionId: string;
  groundxUsername: string;
  contentScope: ContentScope;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type ChatWithSourcesStreamEvent =
  | { type: "content"; text: string }
  | { type: "citation"; citation: ChatWithSourcesCitation }
  | { type: "done"; messageId: string }
  | { type: "error"; error: string };

export type { GroundXSearchResponse, GroundXSearchResult };
