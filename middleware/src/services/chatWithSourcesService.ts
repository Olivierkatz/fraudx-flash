import { randomUUID } from "node:crypto";

import type {
  ChatWithSourcesCitation,
  ChatWithSourcesMessage,
  ChatWithSourcesSegment,
  ChatWithSourcesSession,
  ChatWithSourcesStreamEvent,
  GroundXSearchResponse,
} from "./chatWithSourcesTypes.js";
import type { ChatWithSourcesRepository } from "../repositories/chatWithSourcesRepository.js";
import {
  groundXSearchPath,
  normalizeContentScope,
  searchBody,
  type ContentScope,
  type ServerDerivedContentConstraints,
} from "./contentScope.js";
import {
  citationFromSearchResult,
  llmAnswerFromResponse,
  readUpstreamJson,
  segmentsFromGroundedAnswer,
  sourceContextFromResults,
  type GroundXClient,
  type LlmClient,
} from "./groundedGeneration.js";

export type { GroundXClient, LlmClient } from "./groundedGeneration.js";

export interface ChatWithSourcesRateLimiter {
  run<T>(task: () => Promise<T>): Promise<T>;
}

export interface ChatWithSourcesServiceDependencies {
  repository: ChatWithSourcesRepository;
  groundxClient: GroundXClient;
  llmClient: LlmClient;
  searchLimiter?: ChatWithSourcesRateLimiter;
}

export interface ChatWithSourcesAnswer {
  userMessage: ChatWithSourcesMessage;
  assistantMessage: ChatWithSourcesMessage;
  events: ChatWithSourcesStreamEvent[];
}

function nowIso(): string {
  return new Date().toISOString();
}

export class GroundXSearchRateLimiter implements ChatWithSourcesRateLimiter {
  private active = 0;
  private queue: Array<() => void> = [];
  private nextStartAt = 0;

  constructor(
    private readonly maxConcurrent = 3,
    private readonly minStartIntervalMs = 3000
  ) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.active -= 1;
      this.releaseNext();
    }
  }

  private async acquire(): Promise<void> {
    if (this.active >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active += 1;
    const waitMs = Math.max(0, this.nextStartAt - Date.now());
    this.nextStartAt = Date.now() + waitMs + this.minStartIntervalMs;
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  private releaseNext(): void {
    this.queue.shift()?.();
  }
}

export class ChatWithSourcesService {
  private readonly searchLimiter: ChatWithSourcesRateLimiter;

  constructor(private dependencies: ChatWithSourcesServiceDependencies) {
    this.searchLimiter = dependencies.searchLimiter ?? new GroundXSearchRateLimiter();
  }

  normalizeScope(scope: unknown): ContentScope {
    return normalizeContentScope(scope);
  }

  async createSession(input: {
    groundxUsername: string;
    contentScope: ContentScope;
    metadata?: Record<string, unknown>;
  }): Promise<ChatWithSourcesSession> {
    const session = {
      sessionId: randomUUID(),
      groundxUsername: input.groundxUsername,
      contentScope: input.contentScope,
      metadata: input.metadata,
      createdAt: nowIso(),
    };
    await this.dependencies.repository.createSession(session);
    return session;
  }

  async getOwnedSession(sessionId: string, groundxUsername: string): Promise<ChatWithSourcesSession> {
    const session = await this.dependencies.repository.getSession(sessionId);
    if (!session || session.groundxUsername !== groundxUsername) throw new Error("Chat session not found");
    return session;
  }

  async answer(input: {
    session: ChatWithSourcesSession;
    message: string;
    apiKey: string;
    contentConstraints?: ServerDerivedContentConstraints;
  }): Promise<ChatWithSourcesAnswer> {
    const cleanMessage = input.message.trim();
    if (!cleanMessage) throw new Error("Message is required");
    if (!input.apiKey.trim()) throw new Error("GroundX API key is required for chat with sources");

    const searchResponse = await this.searchLimiter.run(() =>
      this.dependencies.groundxClient.forward(
        groundXSearchPath(input.session.contentScope),
        {
          method: "POST",
          body: JSON.stringify(searchBody(input.session.contentScope, cleanMessage, input.contentConstraints)),
          apiKey: input.apiKey,
        }
      )
    );
    const searchPayload = (await readUpstreamJson(searchResponse)) as GroundXSearchResponse;
    const results = searchPayload.search?.results ?? [];
    const citations = results.map(citationFromSearchResult);
    const sourceContext = sourceContextFromResults(results);

    const llmResponse = await this.dependencies.llmClient.forward("/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content:
              "Answer only from the numbered GroundX sources. Cite supported claims with tokens like [1]. If the sources do not answer the question, say so.",
          },
          {
            role: "user",
            content: `Question: ${cleanMessage}\n\nGroundX context:\n${sourceContext}`,
          },
        ],
      }),
    });
    const answerText = llmAnswerFromResponse(
      await readUpstreamJson(llmResponse),
      "I found relevant GroundX sources, but the LLM response did not include answer text."
    );
    const assistantSegments: ChatWithSourcesSegment[] = segmentsFromGroundedAnswer(answerText, citations, {
      appendFallbackCitations: true,
      fallbackCitationLimit: 3,
    });
    const userMessage: ChatWithSourcesMessage = {
      id: randomUUID(),
      role: "user",
      segments: [{ type: "content", text: cleanMessage }],
      createdAt: nowIso(),
    };
    const assistantMessage: ChatWithSourcesMessage = {
      id: randomUUID(),
      role: "assistant",
      segments: assistantSegments,
      createdAt: nowIso(),
    };

    await this.dependencies.repository.addMessage(input.session.sessionId, userMessage);
    await this.dependencies.repository.addMessage(input.session.sessionId, assistantMessage);

    return {
      userMessage,
      assistantMessage,
      events: [
        ...assistantSegments.map((segment) =>
          segment.type === "content"
            ? ({ type: "content", text: segment.text } as const)
            : ({ type: "citation", citation: segment.citation } as const)
        ),
        { type: "done", messageId: assistantMessage.id },
      ],
    };
  }

  async sourcePreview(documentId: string, apiKey: string): Promise<Record<string, unknown>> {
    const response = await this.dependencies.groundxClient.forward(
      `/ingest/document/${encodeURIComponent(documentId)}`,
      { method: "GET", apiKey }
    );
    const payload = await readUpstreamJson(response);
    const document = (payload as { document?: Record<string, unknown> }).document ?? payload;
    return {
      documentId: String(document.documentId ?? documentId),
      processId: document.processId,
      bucketId: document.bucketId,
      fileName: document.fileName,
      fileType: document.fileType,
      sourceUrl: document.sourceUrl,
      textUrl: document.textUrl,
      xrayUrl: document.xrayUrl,
      status: document.status,
      statusMessage: document.statusMessage,
      searchData: document.searchData,
      filter: document.filter,
    };
  }

  async refineCitation(citation: ChatWithSourcesCitation): Promise<{ citation: ChatWithSourcesCitation; refined: boolean; rationale: string }> {
    if (!citation.documentId) throw new Error("Citation documentId is required");
    return {
      citation,
      refined: false,
      rationale:
        "Citation refinement is wired through the middleware so apps can add provider-specific refinement without exposing credentials to the browser.",
    };
  }
}
