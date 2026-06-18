import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import axios from "@/api/axios";

import {
  createChatWithSourcesSession,
  deleteChatWithSourcesSession,
  getChatWithSourcesMessages,
  getChatWithSourcesSourcePreview,
  refineChatWithSourcesCitation,
  streamChatWithSourcesMessage,
} from "./chatWithSourcesEntity";

vi.mock("@/api/axios", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockAxios = axios as unknown as {
  post: Mock;
  get: Mock;
  delete: Mock;
};

function streamResponse(body: string): Response {
  return streamResponseChunks([body]);
}

function streamResponseChunks(chunks: string[]): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } }
  );
}

describe("chatWithSourcesEntity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses same-origin widget routes for session, history, source, refine, and delete calls", async () => {
    mockAxios.post.mockResolvedValueOnce({ data: { sessionId: "s1", contentScope: { searchTarget: { type: "bucket", bucketId: 7 } }, createdAt: "now" } });
    mockAxios.get
      .mockResolvedValueOnce({ data: { messages: [] } })
      .mockResolvedValueOnce({ data: { documentId: "d1", fileName: "a.pdf" } });
    mockAxios.post.mockResolvedValueOnce({ data: { citation: { id: "c1" }, refined: true } });
    mockAxios.delete.mockResolvedValueOnce({ data: { success: true } });

    await createChatWithSourcesSession({ contentScope: { searchTarget: { type: "bucket", bucketId: 7 } } });
    await getChatWithSourcesMessages("s 1");
    await getChatWithSourcesSourcePreview("doc/1");
    await refineChatWithSourcesCitation({ id: "c1", sourceIndex: 1, occurrenceIndex: 1, documentId: "d1" });
    await deleteChatWithSourcesSession("s 1");

    expect(mockAxios.post).toHaveBeenNthCalledWith(1, "/api/widgets/chat-with-sources/sessions", {
      contentScope: { searchTarget: { type: "bucket", bucketId: 7 } },
    });
    expect(mockAxios.get).toHaveBeenNthCalledWith(1, "/api/widgets/chat-with-sources/sessions/s%201/messages");
    expect(mockAxios.get).toHaveBeenNthCalledWith(2, "/api/widgets/chat-with-sources/sources/doc%2F1/preview");
    expect(mockAxios.post).toHaveBeenNthCalledWith(2, "/api/widgets/chat-with-sources/citations/refine", {
      citation: { id: "c1", sourceIndex: 1, occurrenceIndex: 1, documentId: "d1" },
    });
    expect(mockAxios.delete).toHaveBeenCalledWith("/api/widgets/chat-with-sources/sessions/s%201");
  });

  it("rejects invalid document-set scopes before calling middleware", async () => {
    await expect(createChatWithSourcesSession({ contentScope: { searchTarget: { type: "documents", documentIds: ["doc-1"] } } })).rejects.toThrow(/search target/i);

    expect(mockAxios.post).not.toHaveBeenCalled();
  });

  it("parses typed server-sent events from the stream route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamResponse(
        [
          'data: {"type":"content","text":"Answer"}',
          "",
          'data: {"type":"citation","citation":{"id":"c1","sourceIndex":1,"occurrenceIndex":1,"documentId":"d1"}}',
          "",
          'data: {"type":"done","messageId":"m1"}',
          "",
        ].join("\n")
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const events: unknown[] = [];

    await streamChatWithSourcesMessage("s 1", { message: "What happened?" }, { onEvent: (event) => events.push(event) });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/widgets/chat-with-sources/sessions/s%201/messages/stream",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ message: "What happened?" }),
      })
    );
    expect(events).toEqual([
      { type: "content", text: "Answer" },
      { type: "citation", citation: { id: "c1", sourceIndex: 1, occurrenceIndex: 1, documentId: "d1" } },
      { type: "done", messageId: "m1" },
    ]);
  });

  it("parses stream frames split across chunks and ignores non-data SSE lines", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        streamResponseChunks([
          ': keep-alive\n\ndata: {"type":"content","text":"Part ',
          'one"}\n\n',
          'event: citation\ndata: {"type":"citation","citation":{"id":"c2","sourceIndex":2,"occurrenceIndex":1,"documentId":"d2"}}\n\n',
          'data: {"type":"done","messageId":"m2"}',
        ])
      )
    );
    const events: unknown[] = [];

    await streamChatWithSourcesMessage("s1", { message: "Continue" }, { onEvent: (event) => events.push(event) });

    expect(events).toEqual([
      { type: "content", text: "Part one" },
      { type: "citation", citation: { id: "c2", sourceIndex: 2, occurrenceIndex: 1, documentId: "d2" } },
      { type: "done", messageId: "m2" },
    ]);
  });

  it("fails loudly when the event stream cannot be opened", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Nope", { status: 503 })));

    await expect(
      streamChatWithSourcesMessage("s1", { message: "Hello" }, { onEvent: vi.fn() })
    ).rejects.toThrow(/stream could not be opened/i);
  });
});
