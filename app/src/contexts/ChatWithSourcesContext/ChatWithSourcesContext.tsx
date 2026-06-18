import { createContext, useContext } from "react";

import type {
  ChatWithSourcesCitation,
  ChatWithSourcesMessage,
  ChatWithSourcesScope,
} from "@/api/entities/chatWithSourcesEntity";

export interface ChatWithSourcesContextValue {
  messages: ChatWithSourcesMessage[];
  isSending: boolean;
  error: string | null;
  activeSessionId: string | null;
  sendMessage(input: { scope: ChatWithSourcesScope; message: string }): Promise<void>;
  clearError(): void;
  openSource(citation: ChatWithSourcesCitation): void;
  closeSource(): void;
  activeCitation: ChatWithSourcesCitation | null;
  refineCitation(citation: ChatWithSourcesCitation): Promise<void>;
}

export const ChatWithSourcesContext = createContext<ChatWithSourcesContextValue | undefined>(undefined);

export function useChatWithSourcesContext(): ChatWithSourcesContextValue {
  const context = useContext(ChatWithSourcesContext);
  if (!context) throw new Error("useChatWithSourcesContext must be used within ChatWithSourcesProvider");
  return context;
}
