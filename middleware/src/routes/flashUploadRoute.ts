import express from "express";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { IncomingForm } = require("formidable");
import { createReadStream } from "fs";
import FormData from "form-data";
import type { AppEnv } from "../config/env.js";

function workspaceApiKey(env: AppEnv): string | undefined {
  return env.GROUNDX_WORKSPACE_API_KEY || env.GROUNDX_PARTNER_API_KEY || (env as unknown as Record<string, string>).GROUNDX_API_KEY;
}

export function createFlashUploadRoute({
  env,
  requireSession,
}: {
  env: AppEnv;
  requireSession: express.RequestHandler;
}) {
  const router = express.Router();
  router.use(requireSession);

  router.post("/", async (req, res, next) => {
    try {
      const form = new IncomingForm({ maxFileSize: 50 * 1024 * 1024 });
      const [fields, files] = await form.parse(req);

      const bucketId = Number(fields.bucketId?.[0]);
      if (!bucketId) {
        res.status(400).json({ error: "bucketId is required" });
        return;
      }

      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      if (!file) {
        res.status(400).json({ error: "file is required" });
        return;
      }

      const apiKey = workspaceApiKey(env);
      const formData = new FormData();
      formData.append(
        "request",
        JSON.stringify({
          documents: [
            {
              bucketId,
              type: file.originalFilename?.split(".").pop()?.toLowerCase() ?? "pdf",
              searchData: { fileName: file.originalFilename ?? "document.pdf" },
            },
          ],
        }),
        { contentType: "application/json" }
      );
      formData.append("document", createReadStream(file.filepath), {
        filename: file.originalFilename ?? "document.pdf",
        contentType: file.mimetype ?? "application/pdf",
      });

      const ingestRes = await fetch("https://api.groundx.ai/api/v1/ingest/documents/local", {
        method: "POST",
        headers: {
          "X-API-Key": apiKey ?? "",
          ...formData.getHeaders(),
        },
        body: formData as unknown as import("undici-types").BodyInit,
      });

      const data = await ingestRes.json();
      if (!ingestRes.ok) {
        res.status(502).json({ error: "GroundX ingest failed", detail: data });
        return;
      }

      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
