import axios from "@/api/axios";
import { Metadata, middlewareUrl } from "@/api/common";

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

export interface FileUploaderPreparedPart {
  uploadId: string;
  partId: string;
  fileName: string;
  fileType: string;
  size: number;
  uploaded?: boolean;
  upload: {
    url: string;
    method: "PUT";
    headers: Record<string, string>;
  };
}

export interface CreateFileUploaderUploadRequest {
  bucketId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  filter?: Metadata;
  searchData?: Metadata;
  processLevel?: "full" | "none";
}

export interface CreateFileUploaderUploadResponse {
  uploadId: string;
  status: FileUploaderStatus;
  parts: FileUploaderPreparedPart[];
  requiresPreparation: boolean;
}

export interface PrepareFileUploaderRequest {
  bucketId: number;
  fileName: string;
  fileType: "pdf" | "docx" | "pptx";
  filter?: Metadata;
  searchData?: Metadata;
  processLevel?: "full" | "none";
}

export interface CompleteFileUploaderUploadResponse {
  uploadId: string;
  status: FileUploaderStatus;
  sourceUrls: string[];
}

export interface CompleteFileUploaderUploadRequest {
  parts?: Array<{
    partId: string;
    hostedUrl?: string;
  }>;
}

export interface IngestFileUploaderUploadResponse {
  uploadId: string;
  status: FileUploaderStatus;
  ingest: {
    processId: string;
    status: string;
  };
}

export interface FileUploaderUploadResponse {
  uploadId: string;
  status: FileUploaderStatus;
  fileName: string;
  fileType: string;
  sourceUrls?: string[];
  ingest?: {
    processId: string;
    status: string;
  };
}

export const createFileUploaderUpload = async (
  input: CreateFileUploaderUploadRequest
): Promise<CreateFileUploaderUploadResponse> => {
  const response = await axios.post<CreateFileUploaderUploadResponse>(`${middlewareUrl}/widgets/file-uploader/uploads`, input);
  return response.data;
};

export const prepareFileUploaderUpload = async (
  input: PrepareFileUploaderRequest,
  file: File
): Promise<CreateFileUploaderUploadResponse> => {
  const body = new FormData();
  body.set("metadata", JSON.stringify(input));
  body.set("file", file);
  const response = await axios.post<CreateFileUploaderUploadResponse>(`${middlewareUrl}/widgets/file-uploader/prepare`, body);
  return response.data;
};

export const completeFileUploaderUpload = async (
  uploadId: string,
  input: CompleteFileUploaderUploadRequest = {}
): Promise<CompleteFileUploaderUploadResponse> => {
  const response = await axios.put<CompleteFileUploaderUploadResponse>(
    `${middlewareUrl}/widgets/file-uploader/uploads/${encodeURIComponent(uploadId)}/complete`,
    input
  );
  return response.data;
};

export const ingestFileUploaderUpload = async (uploadId: string): Promise<IngestFileUploaderUploadResponse> => {
  const response = await axios.post<IngestFileUploaderUploadResponse>(
    `${middlewareUrl}/widgets/file-uploader/uploads/${encodeURIComponent(uploadId)}/ingest`
  );
  return response.data;
};

export const cancelFileUploaderUpload = async (uploadId: string): Promise<FileUploaderUploadResponse> => {
  const response = await axios.delete<FileUploaderUploadResponse>(
    `${middlewareUrl}/widgets/file-uploader/uploads/${encodeURIComponent(uploadId)}`
  );
  return response.data;
};

export const getFileUploaderUpload = async (uploadId: string): Promise<FileUploaderUploadResponse> => {
  const response = await axios.get<FileUploaderUploadResponse>(
    `${middlewareUrl}/widgets/file-uploader/uploads/${encodeURIComponent(uploadId)}`
  );
  return response.data;
};
