import type {
  ChatWithSourcesMessage,
  ChatWithSourcesSession,
} from "../services/chatWithSourcesTypes.js";

export interface ChatWithSourcesRepository {
  createSession(session: ChatWithSourcesSession): Promise<void>;
  getSession(sessionId: string): Promise<ChatWithSourcesSession | null>;
  deleteSession(sessionId: string): Promise<void>;
  addMessage(sessionId: string, message: ChatWithSourcesMessage): Promise<void>;
  listMessages(sessionId: string): Promise<ChatWithSourcesMessage[]>;
}

export class MemoryChatWithSourcesRepository implements ChatWithSourcesRepository {
  private sessions = new Map<string, ChatWithSourcesSession>();
  private messages = new Map<string, ChatWithSourcesMessage[]>();

  async createSession(session: ChatWithSourcesSession): Promise<void> {
    this.sessions.set(session.sessionId, structuredClone(session));
    this.messages.set(session.sessionId, []);
  }

  async getSession(sessionId: string): Promise<ChatWithSourcesSession | null> {
    const session = this.sessions.get(sessionId);
    return session ? structuredClone(session) : null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    this.messages.delete(sessionId);
  }

  async addMessage(sessionId: string, message: ChatWithSourcesMessage): Promise<void> {
    const nextMessages = [...(this.messages.get(sessionId) ?? []), structuredClone(message)];
    this.messages.set(sessionId, nextMessages);
  }

  async listMessages(sessionId: string): Promise<ChatWithSourcesMessage[]> {
    return structuredClone(this.messages.get(sessionId) ?? []);
  }
}
