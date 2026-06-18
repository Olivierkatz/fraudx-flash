import express from "express";

import type { ChatWithSourcesRepository } from "../repositories/chatWithSourcesRepository.js";
import { ChatWithSourcesService, type GroundXClient, type LlmClient } from "../services/chatWithSourcesService.js";

export interface ChatWithSourcesRouteDependencies {
  repository: ChatWithSourcesRepository;
  groundxClient: GroundXClient;
  llmClient: LlmClient;
  requireSession: express.RequestHandler;
}

function sessionContext(req: express.Request): { groundxUsername: string; groundxApiKey: string } {
  const session = (req as express.Request & { session?: { groundxUsername?: string; groundxApiKey?: string } }).session;
  return {
    groundxUsername: session?.groundxUsername ?? "unknown",
    groundxApiKey: session?.groundxApiKey ?? "",
  };
}

function writeEvent(res: express.Response, event: unknown): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function createChatWithSourcesRoute({
  repository,
  groundxClient,
  llmClient,
  requireSession,
}: ChatWithSourcesRouteDependencies) {
  const router = express.Router();
  const service = new ChatWithSourcesService({ repository, groundxClient, llmClient });

  router.use(requireSession);

  router.post("/sessions", async (req, res, next) => {
    try {
      const contentScope = service.normalizeScope((req.body as { contentScope?: unknown }).contentScope);
      const session = await service.createSession({
        groundxUsername: sessionContext(req).groundxUsername,
        contentScope,
        metadata: (req.body as { metadata?: Record<string, unknown> }).metadata,
      });
      res.json(session);
    } catch (error) {
      next(error);
    }
  });

  router.get("/sessions/:sessionId/messages", async (req, res, next) => {
    try {
      const session = await service.getOwnedSession(req.params.sessionId, sessionContext(req).groundxUsername);
      res.json({ messages: await repository.listMessages(session.sessionId) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/sessions/:sessionId/messages/stream", async (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    try {
      const session = await service.getOwnedSession(req.params.sessionId, sessionContext(req).groundxUsername);
      const answer = await service.answer({
        session,
        message: String((req.body as { message?: unknown }).message ?? ""),
        apiKey: sessionContext(req).groundxApiKey,
      });
      answer.events.forEach((event) => writeEvent(res, event));
    } catch (error) {
      writeEvent(res, { type: "error", error: error instanceof Error ? error.message : "Chat failed" });
    } finally {
      res.end();
    }
  });

  router.get("/sources/:documentId/preview", async (req, res, next) => {
    try {
      const preview = await service.sourcePreview(req.params.documentId, sessionContext(req).groundxApiKey);
      res.json(preview);
    } catch (error) {
      next(error);
    }
  });

  router.post("/citations/refine", async (req, res, next) => {
    try {
      const result = await service.refineCitation((req.body as { citation?: any }).citation);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/sessions/:sessionId", async (req, res, next) => {
    try {
      await service.getOwnedSession(req.params.sessionId, sessionContext(req).groundxUsername);
      await repository.deleteSession(req.params.sessionId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
