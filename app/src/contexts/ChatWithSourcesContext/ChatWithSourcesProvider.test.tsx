import { ReactNode, useEffect } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  createChatWithSourcesSession,
  getChatWithSourcesMessages,
  getChatWithSourcesSourcePreview,
  refineChatWithSourcesCitation,
  streamChatWithSourcesMessage,
} from "@/api/entities/chatWithSourcesEntity";

import { ChatWithSourcesProvider } from "./ChatWithSourcesProvider";
import { useChatWithSourcesContext } from "./ChatWithSourcesContext";

vi.mock("@/api/entities/chatWithSourcesEntity", () => ({
  createChatWithSourcesSession: vi.fn(),
  getChatWithSourcesMessages: vi.fn(),
  getChatWithSourcesSourcePreview: vi.fn(),
  streamChatWithSourcesMessage: vi.fn(),
  refineChatWithSourcesCitation: vi.fn(),
}));

const mockCreateSession = vi.mocked(createChatWithSourcesSession);
const mockGetMessages = vi.mocked(getChatWithSourcesMessages);
const mockGetSourcePreview = vi.mocked(getChatWithSourcesSourcePreview);
const mockStream = vi.mocked(streamChatWithSourcesMessage);
const mockRefine = vi.mocked(refineChatWithSourcesCitation);

function Consumer({ onSnapshot }: { onSnapshot: (value: ReturnType<typeof useChatWithSourcesContext>) => void }) {
  const context = useChatWithSourcesContext();
  useEffect(() => {
    onSnapshot(context);
  }, [context, onSnapshot]);
  return null;
}

function Harness({ children }: { children: ReactNode }) {
  return <ChatWithSourcesProvider>{children}</ChatWithSourcesProvider>;
}

function latest<T>(items: T[]): T {
  return items[items.length - 1]!;
}

describe("ChatWithSourcesProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMessages.mockResolvedValue({ messages: [] });
  });

  it("creates a session, appends user content, streams assistant content, and stores citation segments", async () => {
    mockCreateSession.mockResolvedValue({ sessionId: "s1", contentScope: { searchTarget: { type: "bucket", bucketId: 7 } }, createdAt: "now" });
    mockStream.mockImplementation(async (_sessionId, _input, handlers) => {
      handlers.onEvent({ type: "content", text: "Answer " });
      handlers.onEvent({
        type: "citation",
        citation: { id: "c1", sourceIndex: 1, occurrenceIndex: 1, documentId: "d1", fileName: "a.pdf" },
      });
      handlers.onEvent({ type: "done", messageId: "m1" });
    });
    const snapshots: ReturnType<typeof useChatWithSourcesContext>[] = [];

    render(
      <Harness>
        <Consumer onSnapshot={(value) => snapshots.push(value)} />
      </Harness>
    );

    await act(async () => {
      await latest(snapshots).sendMessage({ scope: { searchTarget: { type: "bucket", bucketId: 7 } }, message: "What is supported?" });
    });

    await waitFor(() => expect(latest(snapshots).messages).toHaveLength(2));
    expect(mockCreateSession).toHaveBeenCalledWith({ contentScope: { searchTarget: { type: "bucket", bucketId: 7 } } });
    expect(mockStream).toHaveBeenCalledWith("s1", { message: "What is supported?" }, expect.any(Object));
    expect(latest(snapshots).messages[1].segments).toEqual([
      { type: "content", text: "Answer " },
      {
        type: "citation",
        citation: { id: "c1", sourceIndex: 1, occurrenceIndex: 1, documentId: "d1", fileName: "a.pdf" },
      },
    ]);
  });

  it("refines the active citation through the middleware route", async () => {
    const refined = { id: "c1", sourceIndex: 1, occurrenceIndex: 1, documentId: "d1", pageInfo: { page: 3 } };
    mockRefine.mockResolvedValue({ citation: refined, refined: true });
    const snapshots: ReturnType<typeof useChatWithSourcesContext>[] = [];

    render(
      <Harness>
        <Consumer onSnapshot={(value) => snapshots.push(value)} />
      </Harness>
    );

    await act(async () => {
      await latest(snapshots).refineCitation({ id: "c1", sourceIndex: 1, occurrenceIndex: 1, documentId: "d1" });
    });

    await waitFor(() => expect(latest(snapshots).activeCitation).toEqual(refined));
  });

  it("opens a source immediately, then enriches it from the GroundX document preview route", async () => {
    mockGetSourcePreview.mockResolvedValue({
      documentId: "d1",
      processId: "p1",
      bucketId: 7,
      fileName: "contract.pdf",
      fileType: "pdf",
      sourceUrl: "https://docs.groundx.test/contract.pdf",
      searchData: { fullTitle: "Contract" },
    });
    const snapshots: ReturnType<typeof useChatWithSourcesContext>[] = [];

    render(
      <Harness>
        <Consumer onSnapshot={(value) => snapshots.push(value)} />
      </Harness>
    );

    await act(async () => {
      await latest(snapshots).openSource({ id: "c1", sourceIndex: 1, occurrenceIndex: 1, documentId: "d1" });
    });

    await waitFor(() =>
      expect(latest(snapshots).activeCitation).toMatchObject({
        id: "c1",
        documentId: "d1",
        processId: "p1",
        bucketId: 7,
        fileName: "contract.pdf",
        fileType: "pdf",
        sourceUrl: "https://docs.groundx.test/contract.pdf",
        searchData: { fullTitle: "Contract" },
      })
    );
    expect(mockGetSourcePreview).toHaveBeenCalledWith("d1");
  });

  it("keeps the stream citation visible and reports a safe error when source preview fails", async () => {
    mockGetSourcePreview.mockRejectedValue(new Error("GroundX unavailable"));
    const snapshots: ReturnType<typeof useChatWithSourcesContext>[] = [];

    render(
      <Harness>
        <Consumer onSnapshot={(value) => snapshots.push(value)} />
      </Harness>
    );

    await act(async () => {
      await latest(snapshots).openSource({
        id: "c1",
        sourceIndex: 1,
        occurrenceIndex: 1,
        documentId: "d1",
        fileName: "stream.pdf",
      });
    });

    await waitFor(() => expect(latest(snapshots).error).toMatch(/source details could not be loaded/i));
    expect(latest(snapshots).activeCitation).toMatchObject({ documentId: "d1", fileName: "stream.pdf" });
  });

  it("hydrates messages when an initial session id is provided", async () => {
    mockGetMessages.mockResolvedValue({
      messages: [
        {
          id: "m1",
          role: "assistant",
          segments: [{ type: "content", text: "Existing answer" }],
          createdAt: "now",
        },
      ],
    });
    const snapshots: ReturnType<typeof useChatWithSourcesContext>[] = [];

    render(
      <ChatWithSourcesProvider initialSessionId="existing-session">
        <Consumer onSnapshot={(value) => snapshots.push(value)} />
      </ChatWithSourcesProvider>
    );

    await waitFor(() => expect(latest(snapshots).messages).toHaveLength(1));
    expect(mockGetMessages).toHaveBeenCalledWith("existing-session");
    expect(latest(snapshots).messages[0].segments).toEqual([{ type: "content", text: "Existing answer" }]);
  });
});
