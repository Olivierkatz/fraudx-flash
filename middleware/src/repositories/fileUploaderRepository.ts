import type { FileUploaderSession } from "../services/fileUploaderTypes.js";

export interface FileUploaderRepository {
  saveSession(session: FileUploaderSession): Promise<void>;
  getSession(uploadId: string): Promise<FileUploaderSession | null>;
  deleteSession(uploadId: string): Promise<void>;
}

export class MemoryFileUploaderRepository implements FileUploaderRepository {
  private sessions = new Map<string, FileUploaderSession>();

  async saveSession(session: FileUploaderSession): Promise<void> {
    this.sessions.set(session.uploadId, structuredClone(session));
  }

  async getSession(uploadId: string): Promise<FileUploaderSession | null> {
    const session = this.sessions.get(uploadId);
    return session ? structuredClone(session) : null;
  }

  async deleteSession(uploadId: string): Promise<void> {
    this.sessions.delete(uploadId);
  }
}

