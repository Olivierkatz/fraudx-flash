import { FC, ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import {
  ChatWithSourcesCitation,
  ChatWithSourcesMessage,
  ChatWithSourcesScope,
  createChatWithSourcesSession,
  getChatWithSourcesMessages,
  getChatWithSourcesSourcePreview,
  refineChatWithSourcesCitation,
  streamChatWithSourcesMessage,
} from "@/api/entities/chatWithSourcesEntity";

import { ChatWithSourcesContext } from "./ChatWithSourcesContext";

function nowIso(): string {
  return new Date().toISOString();
}

function userMessage(message: string): ChatWithSourcesMessage {
  return {
    id: `local-user-${Date.now()}`,
    role: "user",
    segments: [{ type: "content", text: message }],
    createdAt: nowIso(),
  };
}

function assistantMessage(id: string): ChatWithSourcesMessage {
  return {
    id,
    role: "assistant",
    segments: [],
    createdAt: nowIso(),
  };
}

export const ChatWithSourcesProvider: FC<{ children: ReactNode; initialSessionId?: string }> = ({
  children,
  initialSessionId = null,
}) => {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessionId);
  const [messages, setMessages] = useState<ChatWithSourcesMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<ChatWithSourcesCitation | null>(null);

  useEffect(() => {
    if (!initialSessionId) return;
    let cancelled = false;
    getChatWithSourcesMessages(initialSessionId)
      .then(({ messages: hydratedMessages }) => {
        if (!cancelled) setMessages(hydratedMessages);
      })
      .catch(() => {
        if (!cancelled) setError("Chat history could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [initialSessionId]);

  const sendMessage = useCallback(
    async ({ scope, message }: { scope: ChatWithSourcesScope; message: string }) => {
      setError(null);
      setIsSending(true);
      const cleanMessage = message.trim();
      const assistantId = `local-assistant-${Date.now()}`;
      setMessages((current) => [...current, userMessage(cleanMessage), assistantMessage(assistantId)]);
      try {
        const sessionId = activeSessionId ?? (await createChatWithSourcesSession({ contentScope: scope })).sessionId;
        setActiveSessionId(sessionId);
        await streamChatWithSourcesMessage(sessionId, { message: cleanMessage }, {
          onEvent(event) {
            if (event.type === "error") {
              setError(event.error);
              return;
            }
            if (event.type === "content") {
              setMessages((current) =>
                current.map((item) =>
                  item.id === assistantId
                    ? { ...item, segments: [...item.segments, { type: "content", text: event.text }] }
                    : item
                )
              );
            }
            if (event.type === "citation") {
              setMessages((current) =>
                current.map((item) =>
                  item.id === assistantId
                    ? { ...item, segments: [...item.segments, { type: "citation", citation: event.citation }] }
                    : item
                )
              );
            }
          },
        });
      } catch {
        setError("The answer could not be generated.");
      } finally {
        setIsSending(false);
      }
    },
    [activeSessionId]
  );

  const refineCitation = useCallback(async (citation: ChatWithSourcesCitation) => {
    const refined = await refineChatWithSourcesCitation(citation);
    setActiveCitation(refined.citation);
  }, []);

  const openSource = useCallback(async (citation: ChatWithSourcesCitation) => {
    setError(null);
    setActiveCitation(citation);
    try {
      const preview = await getChatWithSourcesSourcePreview(citation.documentId);
      setActiveCitation((current) =>
        current?.id === citation.id
          ? {
              ...current,
              processId: current.processId ?? preview.processId,
              bucketId: current.bucketId ?? preview.bucketId,
              fileName: current.fileName ?? preview.fileName,
              fileType: current.fileType ?? preview.fileType,
              sourceUrl: current.sourceUrl ?? preview.sourceUrl,
              searchData: current.searchData ?? preview.searchData,
            }
          : current
      );
    } catch {
      setError("Source details could not be loaded.");
    }
  }, []);

  const value = useMemo(
    () => ({
      messages,
      isSending,
      error,
      activeSessionId,
      sendMessage,
      clearError: () => setError(null),
      activeCitation,
      openSource,
      closeSource: () => setActiveCitation(null),
      refineCitation,
    }),
    [activeCitation, activeSessionId, error, isSending, messages, openSource, refineCitation, sendMessage]
  );

  return <ChatWithSourcesContext.Provider value={value}>{children}</ChatWithSourcesContext.Provider>;
};
