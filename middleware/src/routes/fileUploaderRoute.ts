import express from "express";
import { randomUUID } from "node:crypto";

import type { FileUploaderRepository } from "../repositories/fileUploaderRepository.js";
import { buildGroundXDocuments, GroundXRemoteIngestClient } from "../services/fileUploaderIngestService.js";
import { FileUploaderDocumentMetadata, FileUploaderSession } from "../services/fileUploaderTypes.js";
import { cleanHostedUrl, GroundXUploadService } from "../services/groundxUploadService.js";

const SUPPORTED_DIRECT_UPLOAD_TYPES = new Set([
  "pdf",
  "xlsx",
  "csv",
  "tsv",
  "json",
  "txt",
  "hwp",
  "bmp",
  "gif",
  "heic",
  "heif",
  "ico",
  "jpg",
  "jpeg",
  "png",
  "svg",
  "tif",
  "tiff",
  "webp",
]);
const OFFICE_TYPES = new Set(["docx", "pptx"]);
const RECOMMENDED_PREPARED_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const HARD_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const JSON_HARD_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const GROUNDX_RECOMMENDED_MAX_DOCUMENTS_PER_BATCH = 20;

interface FileUploaderRouteDependencies {
  repository: FileUploaderRepository;
  uploadService: GroundXUploadService;
  ingestClient: GroundXRemoteIngestClient;
  requireSession: express.RequestHandler;
  prepareFile?: (input: {
    req: express.Request;
    uploadId: string;
    groundxUsername: string;
  }) => Promise<{
    status: "ready";
    requiresPreparation: true;
    session: FileUploaderSession;
    parts: Array<{
      uploadId: string;
      partId: string;
      fileName: string;
      fileType: string;
      size: number;
      uploaded?: boolean;
      upload: { url: string; method: "PUT"; headers: Record<string, string> };
    }>;
  }>;
}

function sessionUsername(req: express.Request): string {
  return (req as express.Request & { session?: { groundxUsername?: string } }).session?.groundxUsername ?? "unknown";
}

function extensionOf(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension && extension !== fileName.toLowerCase() ? extension : "";
}

function normalizeUploadMetadata(input: unknown): (FileUploaderDocumentMetadata & { fileSize: number }) | null {
  const metadata = input as Partial<FileUploaderDocumentMetadata & { fileSize: number }>;
  if (!metadata || typeof metadata !== "object") return null;
  const { bucketId, fileName, fileType, fileSize } = metadata;
  if (typeof bucketId !== "number" || !Number.isInteger(bucketId) || bucketId <= 0) return null;
  if (typeof fileName !== "string" || !fileName.trim()) return null;
  if (typeof fileType !== "string" || !fileType.trim()) return null;
  if (extensionOf(fileName) !== fileType.toLowerCase()) return null;
  if (typeof fileSize !== "number" || !Number.isFinite(fileSize) || fileSize <= 0) return null;
  if (metadata.processLevel && metadata.processLevel !== "full" && metadata.processLevel !== "none") return null;
  return {
    ...metadata,
    bucketId,
    fileName,
    fileType: fileType.toLowerCase(),
    fileSize,
  };
}

function directUploadRejection(metadata: FileUploaderDocumentMetadata & { fileSize: number }): string | null {
  if (metadata.fileSize > HARD_FILE_SIZE_BYTES) return "File exceeds the hard upload size limit";
  if (metadata.fileType === "json" && metadata.fileSize > JSON_HARD_FILE_SIZE_BYTES) {
    return "JSON files cannot exceed the GroundX 5 MB hard limit";
  }
  if (OFFICE_TYPES.has(metadata.fileType)) return "DOCX and PPTX uploads must use the prepare route for PDF conversion";
  if (!SUPPORTED_DIRECT_UPLOAD_TYPES.has(metadata.fileType)) return `.${metadata.fileType} is not supported`;
  if (metadata.fileType === "pdf" && metadata.fileSize > RECOMMENDED_PREPARED_FILE_SIZE_BYTES) {
    return "Large PDFs must use the prepare route for page counting and splitting";
  }
  return null;
}

async function getOwnedSession(input: {
  repository: FileUploaderRepository;
  req: express.Request;
  res: express.Response;
}): Promise<FileUploaderSession | null> {
  const uploadId = String(input.req.params.uploadId ?? "");
  const session = await input.repository.getSession(uploadId);
  if (!session || session.groundxUsername !== sessionUsername(input.req)) {
    input.res.status(404).json({ error: "Upload session not found" });
    return null;
  }
  return session;
}

export function createFileUploaderRoute({
  repository,
  uploadService,
  ingestClient,
  requireSession,
  prepareFile,
}: FileUploaderRouteDependencies) {
  const router = express.Router();
  router.use(requireSession);

  router.post("/uploads", async (req, res, next) => {
    try {
      const metadata = normalizeUploadMetadata(req.body);
      if (!metadata) {
        res.status(400).json({ error: "Invalid upload metadata" });
        return;
      }
      const rejection = directUploadRejection(metadata);
      if (rejection) {
        res.status(400).json({ error: rejection });
        return;
      }

      const uploadId = randomUUID();
      const partId = randomUUID();
      const upload = await uploadService.createUploadParameters(metadata.fileName, metadata.fileType);
      const session = {
        uploadId,
        groundxUsername: sessionUsername(req),
        status: "ready" as const,
        metadata,
        parts: [{ partId, fileName: metadata.fileName, fileType: metadata.fileType, size: metadata.fileSize, uploadUrl: upload.url }],
      };
      await repository.saveSession(session);
      res.json({
        uploadId,
        status: session.status,
        requiresPreparation: false,
        parts: [{ uploadId, partId, fileName: metadata.fileName, fileType: metadata.fileType, size: metadata.fileSize, upload }],
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/prepare", async (req, res, next) => {
    try {
      if (!prepareFile) {
        res.status(503).json({
          error:
            "File preparation is not configured. Wire the widget middleware prepareFile dependency with multipart parsing, Office-to-PDF conversion, and PDF splitting before enabling DOCX, PPTX, or oversized PDF uploads.",
        });
        return;
      }

      const uploadId = randomUUID();
      const prepared = await prepareFile({ req, uploadId, groundxUsername: sessionUsername(req) });
      await repository.saveSession(prepared.session);
      res.json({
        uploadId,
        status: prepared.status,
        requiresPreparation: true,
        parts: prepared.parts,
      });
    } catch (error) {
      next(error);
    }
  });

  router.put("/uploads/:uploadId/complete", async (req, res, next) => {
    try {
      const session = await getOwnedSession({ repository, req, res });
      if (!session) return;
      const completedParts = Array.isArray(req.body?.parts) ? req.body.parts : [];
      const completedPartById = new Map<string, string | undefined>(
        completedParts
          .filter((part: { partId?: unknown; hostedUrl?: unknown }) => typeof part.partId === "string")
          .map((part: { partId: string; hostedUrl?: unknown }) => [
            part.partId,
            typeof part.hostedUrl === "string" && part.hostedUrl ? part.hostedUrl : undefined,
          ])
      );
      const missingUploadedParts = session.parts
        .filter((part) => !part.uploaded)
        .filter((part) => !completedPartById.has(part.partId));
      if (missingUploadedParts.length) {
        res.status(400).json({ error: "Every browser-uploaded part must be completed before ingest" });
        return;
      }

      const sourceUrls = session.parts.map((part) => completedPartById.get(part.partId) ?? part.hostedUrl ?? cleanHostedUrl(part.uploadUrl));
      const nextSession: FileUploaderSession = {
        ...session,
        status: "uploaded" as const,
        parts: session.parts.map((part, index) => ({ ...part, hostedUrl: sourceUrls[index] ?? cleanHostedUrl(part.uploadUrl) })),
      };
      await repository.saveSession(nextSession);
      res.json({ uploadId: session.uploadId, status: nextSession.status, sourceUrls });
    } catch (error) {
      next(error);
    }
  });

  router.post("/uploads/:uploadId/ingest", async (req, res, next) => {
    try {
      const session = await getOwnedSession({ repository, req, res });
      if (!session) return;
      const readyForIngest = session.status === "uploaded" || session.parts.every((part) => part.uploaded && part.hostedUrl);
      if (!readyForIngest) {
        res.status(409).json({ error: "Upload session must be completed before ingest" });
        return;
      }

      const sourceUrls = session.parts.map((part) => part.hostedUrl ?? cleanHostedUrl(part.uploadUrl));
      if (sourceUrls.length > GROUNDX_RECOMMENDED_MAX_DOCUMENTS_PER_BATCH) {
        res.status(400).json({
          error:
            "Upload session exceeds the GroundX recommended remote-ingest batch size. Split the session into smaller batches before ingest.",
        });
        return;
      }
      const ingest = await ingestClient.ingestRemote({
        documents: buildGroundXDocuments({
          metadata: session.metadata,
          sourceUrls,
          sourceParts: session.parts.map((part, index) => ({
            sourceUrl: sourceUrls[index],
            fileName: part.fileName,
            fileType: part.fileType,
          })),
          originalFileName: session.originalFileName,
          originalFileType: session.originalFileType,
          splitPlan: session.splitPlan,
        }),
      });
      const nextSession = { ...session, status: "ingesting" as const, ingest: ingest.ingest };
      await repository.saveSession(nextSession);
      res.json({ uploadId: session.uploadId, status: nextSession.status, ingest: ingest.ingest });
    } catch (error) {
      next(error);
    }
  });

  router.get("/uploads/:uploadId", async (req, res, next) => {
    try {
      const session = await getOwnedSession({ repository, req, res });
      if (!session) return;
      res.json(session);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/uploads/:uploadId", async (req, res, next) => {
    try {
      const session = await getOwnedSession({ repository, req, res });
      if (!session) return;
      const nextSession = { ...session, status: "cancelled" as const };
      await repository.saveSession(nextSession);
      res.json(nextSession);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
