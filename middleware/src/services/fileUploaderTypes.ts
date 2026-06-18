export type FileUploaderStatus =
  | "queued"
  | "preparing"
  | "ready"
  | "uploading"
  | "uploaded"
  | "ingesting"
  | "complete"
  | "error"
  | "cancelled";

export interface FileUploaderDocumentMetadata {
  bucketId: number;
  fileName: string;
  fileType: string;
  filter?: Record<string, unknown>;
  searchData?: Record<string, unknown>;
  processLevel?: "full" | "none";
}

export interface FileUploaderUploadPart {
  partId: string;
  fileName: string;
  fileType: string;
  size: number;
  uploadUrl: string;
  hostedUrl?: string;
  uploaded?: boolean;
}

export interface FileUploaderSession {
  uploadId: string;
  groundxUsername: string;
  status: FileUploaderStatus;
  metadata: FileUploaderDocumentMetadata;
  parts: FileUploaderUploadPart[];
  originalFileName?: string;
  originalFileType?: string;
  splitPlan?: {
    splitSourceId: string;
    total: number;
    parts: Array<{ part: number; startPage: number; endPage: number }>;
  };
  error?: string;
  ingest?: {
    processId: string;
    status: string;
  };
}
