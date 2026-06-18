import axios from "@/api/axios";
import { Metadata, middlewareUrl } from "@/api/common";
import { validateContentScope, type ContentScope } from "@/api/contentScope";
import type { GroundedAnswerSegment, GroundedCitation } from "@/api/groundedSources";

export type ChatWithSourcesScope = ContentScope;

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
  contentScope: ChatWithSourcesScope;
  createdAt: string;
}

export interface CreateChatWithSourcesSessionRequest {
  contentScope: ChatWithSourcesScope;
  metadata?: Metadata;
}

export interface ChatWithSourcesStreamRequest {
  message: string;
}

export interface SourcePreviewResponse {
  documentId: string;
  processId?: string;
  bucketId?: number;
  fileName?: string;
  fileType?: string;
  sourceUrl?: string;
  textUrl?: string;
  xrayUrl?: string;
  status?: string;
  statusMessage?: string;
  searchData?: Metadata;
  filter?: Metadata;
}

export interface CitationRefinementResponse {
  citation: ChatWithSourcesCitation;
  refined: boolean;
  rationale?: string;
}

export type ChatWithSourcesStreamEvent =
  | { type: "content"; text: string }
  | { type: "citation"; citation: ChatWithSourcesCitation }
  | { type: "done"; messageId: string }
  | { type: "error"; error: string };

const baseUrl = `${middlewareUrl}/widgets/chat-with-sources`;

export const createChatWithSourcesSession = async (
  input: CreateChatWithSourcesSessionRequest
): Promise<ChatWithSourcesSession> => {
  validateContentScope(input.contentScope);
  const response = await axios.post<ChatWithSourcesSession>(`${baseUrl}/sessions`, input);
  return response.data;
};

export const getChatWithSourcesMessages = async (
  sessionId: string
): Promise<{ messages: ChatWithSourcesMessage[] }> => {
  const response = await axios.get<{ messages: ChatWithSourcesMessage[] }>(
    `${baseUrl}/sessions/${encodeURIComponent(sessionId)}/messages`
  );
  return response.data;
};

export const deleteChatWithSourcesSession = async (
  sessionId: string
): Promise<{ success: true }> => {
  const response = await axios.delete<{ success: true }>(
    `${baseUrl}/sessions/${encodeURIComponent(sessionId)}`
  );
  return response.data;
};

export const getChatWithSourcesSourcePreview = async (
  documentId: string
): Promise<SourcePreviewResponse> => {
  const response = await axios.get<SourcePreviewResponse>(
    `${baseUrl}/sources/${encodeURIComponent(documentId)}/preview`
  );
  return response.data;
};

export const refineChatWithSourcesCitation = async (
  citation: ChatWithSourcesCitation
): Promise<CitationRefinementResponse> => {
  const response = await axios.post<CitationRefinementResponse>(`${baseUrl}/citations/refine`, {
    citation,
  });
  return response.data;
};

export async function streamChatWithSourcesMessage(
  sessionId: string,
  input: ChatWithSourcesStreamRequest,
  handlers: {
    onEvent(event: ChatWithSourcesStreamEvent): void;
    signal?: AbortSignal;
  }
): Promise<void> {
  const response = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/messages/stream`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    signal: handlers.signal,
  });

  if (!response.ok || !response.body) {
    throw new Error("Chat stream could not be opened");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const dataLine = frame.split("\n").find((line) => line.startsWith("data:"));
      if (!dataLine) continue;
      handlers.onEvent(JSON.parse(dataLine.slice("data:".length).trim()) as ChatWithSourcesStreamEvent);
    }
  }

  const dataLine = buffer.split("\n").find((line) => line.startsWith("data:"));
  if (dataLine) {
    handlers.onEvent(JSON.parse(dataLine.slice("data:".length).trim()) as ChatWithSourcesStreamEvent);
  }
}
