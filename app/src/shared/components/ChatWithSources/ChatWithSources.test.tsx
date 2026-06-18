import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ChatWithSourcesCitation, ChatWithSourcesMessage } from "@/api/entities/chatWithSourcesEntity";
import { ChatWithSourcesContext, type ChatWithSourcesContextValue } from "@/contexts/ChatWithSourcesContext";
import { renderWithAppProviders } from "@/test/renderWithAppProviders";

import { ChatWithSources } from "./ChatWithSources";

const citation: ChatWithSourcesCitation = {
  id: "c1",
  sourceIndex: 1,
  occurrenceIndex: 1,
  documentId: "d1",
  fileName: "evidence.pdf",
  fileType: "pdf",
  sourceUrl: "https://docs.groundx.test/evidence.pdf",
  multimodalUrl: "https://docs.groundx.test/evidence-xray.json",
  chunkText: "Relevant source text",
  boundingBoxes: [{ pageNumber: 2 }],
  pageImages: ["https://docs.groundx.test/evidence-page-2.png"],
  pages: [{ number: 2, imageUrl: "https://docs.groundx.test/evidence-page-2.png" }],
};

const messages: ChatWithSourcesMessage[] = [
  {
    id: "m1",
    role: "assistant",
    createdAt: "now",
    segments: [
      { type: "content", text: "The answer is supported. " },
      { type: "citation", citation },
    ],
  },
];

function providerValue(overrides: Partial<ChatWithSourcesContextValue> = {}): ChatWithSourcesContextValue {
  return {
    messages: [],
    isSending: false,
    error: null,
    activeSessionId: null,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    clearError: vi.fn(),
    openSource: vi.fn(),
    closeSource: vi.fn(),
    activeCitation: null,
    refineCitation: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderWithChat(value: ChatWithSourcesContextValue, children: ReactNode) {
  return renderWithAppProviders(
    <ChatWithSourcesContext.Provider value={value}>{children}</ChatWithSourcesContext.Provider>
  );
}

describe("ChatWithSources", () => {
  it("renders configured title, educational tooltip, starter prompts, and disabled send state", async () => {
    renderWithChat(
      providerValue(),
      <ChatWithSources
        scope={{ searchTarget: { type: "bucket", bucketId: 7 } }}
        config={{ copy: { title: "CLAIM CHAT", scopeLabel: "Claims" }, starterPrompts: ["Find anomalies"] }}
      />
    );

    expect(screen.getByRole("heading", { name: "CLAIM CHAT" })).toBeInTheDocument();
    expect(screen.getByText("CLAIMS")).toBeInTheDocument();
    expect(screen.getByText(/Ask a question/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /about chat with sources/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /send/i })[0]).toBeDisabled();
  });

  it("sends valid messages through context and exposes keyboard-accessible source chips", async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const openSource = vi.fn();
    renderWithChat(
      providerValue({ messages, sendMessage, openSource }),
      <ChatWithSources scope={{ searchTarget: { type: "bucket", bucketId: 7 } }} />
    );

    fireEvent.change(screen.getByRole("textbox", { name: /message/i }), { target: { value: "What supports this?" } });
    fireEvent.click(screen.getAllByRole("button", { name: /send/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: "SOURCE 1" }));

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        scope: { searchTarget: { type: "bucket", bucketId: 7 } },
        message: "What supports this?",
      })
    );
    expect(openSource).toHaveBeenCalledWith(citation);
  });

  it("opens source details and refines the active citation", async () => {
    const refineCitation = vi.fn().mockResolvedValue(undefined);
    renderWithChat(
      providerValue({ activeCitation: citation, refineCitation }),
      <ChatWithSources scope={{ searchTarget: { type: "group", groupId: "7" } }} />
    );

    const dialog = screen.getByRole("presentation");
    expect(within(dialog).getByText("SOURCE DETAILS")).toBeInTheDocument();
    expect(within(dialog).getByText("evidence.pdf")).toBeInTheDocument();
    expect(within(dialog).getByRole("img", { name: /preview for evidence.pdf/i })).toHaveAttribute(
      "src",
      "https://docs.groundx.test/evidence-page-2.png"
    );
    expect(within(dialog).getByText("Page 2")).toBeInTheDocument();
    expect(within(dialog).getByText(/1 source coordinate available/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /open multimodal source/i })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /refine citation/i }));

    expect(refineCitation).toHaveBeenCalledWith(citation);
  });

  it("shows recoverable error state", async () => {
    const clearError = vi.fn();
    renderWithChat(
      providerValue({ error: "failed", clearError }),
      <ChatWithSources scope={{ searchTarget: { type: "bucket", bucketId: 7 } }} />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/could not be generated/i);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(clearError).toHaveBeenCalled();
  });

  it("can render inside a plain RTL tree with mocked providers for widget-package tests", () => {
    render(
      <ChatWithSourcesContext.Provider value={providerValue()}>
        <ChatWithSources scope={{ searchTarget: { type: "bucket", bucketId: 7 } }} />
      </ChatWithSourcesContext.Provider>
    );

    expect(screen.getByRole("heading", { name: "CHAT WITH SOURCES" })).toBeInTheDocument();
  });
});
