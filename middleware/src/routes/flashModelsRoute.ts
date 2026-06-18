import express from "express";
import type { LlmClient } from "../types.js";

export function createFlashModelsRoute({
  llmClient,
  requireSession,
}: {
  llmClient: LlmClient;
  requireSession: express.RequestHandler;
}) {
  const router = express.Router();
  router.use(requireSession);

  router.get("/", async (_req, res, next) => {
    try {
      const response = await llmClient.forward("/models", { method: "GET" });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
