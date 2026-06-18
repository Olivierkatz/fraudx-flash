import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { MemoryChatWithSourcesRepository } from "../repositories/chatWithSourcesRepository.js";
import { createChatWithSourcesRoute } from "./chatWithSourcesRoute.js";

function createHarness(options: { authenticated?: boolean } = {}) {
  const repository = new MemoryChatWithSourcesRepository();
  const groundxClient = {
    forward: vi.fn().mockImplementation((path: string) => {
      if (path.startsWith("/ingest/document/")) {
        return Promise.resolve(
          Response.json({
            document: {
              documentId: "d1",
              fileName: "source.pdf",
              sourceUrl: "https://docs.test/source.pdf",
              status: "complete",
            },
          })
        );
      }
      return Promise.resolve(
        Response.json({
          search: {
            results: [{ documentId: "d1", fileName: "source.pdf", text: "Source text", sourceUrl: "https://docs.test/source.pdf" }],
          },
        })
      );
    }),
  };
  const llmClient = {
    forward: vi.fn().mockResolvedValue(Response.json({ answer: "Answer [[1]]" })),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (options.authenticated !== false) {
      (req as any).session = { groundxUsername: "gx-user", groundxApiKey: "gx-key" };
    }
    next();
  });
  app.use(
    "/api/widgets/chat-with-sources",
    createChatWithSourcesRoute({
      repository,
      groundxClient,
      llmClient,
      requireSession(req, res, next) {
        if (!(req as any).session) {
          res.status(401).json({ error: "Authentication required" });
          return;
        }
        next();
      },
    })
  );
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(400).json({ error: error?.message ?? "failed" });
  });
  return { app, repository, groundxClient, llmClient };
}

describe("chatWithSourcesRoute", () => {
  it("requires authentication for widget routes", async () => {
    const { app } = createHarness({ authenticated: false });

    await request(app)
      .post("/api/widgets/chat-with-sources/sessions")
      .send({ contentScope: { searchTarget: { type: "bucket", bucketId: 7 } } })
      .expect(401);
  });

  it("creates owned sessions, streams typed events, and stores message history", async () => {
    const { app, repository, groundxClient, llmClient } = createHarness();
    const created = await request(app)
      .post("/api/widgets/chat-with-sources/sessions")
      .send({ contentScope: { searchTarget: { type: "bucket", bucketId: 7 } } })
      .expect(200);

    const stream = await request(app)
      .post(`/api/widgets/chat-with-sources/sessions/${created.body.sessionId}/messages/stream`)
      .send({ message: "What happened?" })
      .expect(200);

    expect(stream.text).toContain('"type":"content"');
    expect(stream.text).toContain('"type":"citation"');
    expect(stream.text).toContain('"type":"done"');
    expect(groundxClient.forward).toHaveBeenCalledWith("/search/7?n=10&verbosity=2", expect.objectContaining({ apiKey: "gx-key" }));
    expect(llmClient.forward).toHaveBeenCalledWith("/chat/completions", expect.objectContaining({ method: "POST" }));
    expect(await repository.listMessages(created.body.sessionId)).toHaveLength(2);

    const history = await request(app)
      .get(`/api/widgets/chat-with-sources/sessions/${created.body.sessionId}/messages`)
      .expect(200);
    expect(history.body.messages).toHaveLength(2);
  });

  it("normalizes source preview, citation refinement, invalid scope, and deletion", async () => {
    const { app, groundxClient } = createHarness();
    await request(app).post("/api/widgets/chat-with-sources/sessions").send({ contentScope: { searchTarget: { type: "document" } } }).expect(400);
    const created = await request(app)
      .post("/api/widgets/chat-with-sources/sessions")
      .send({ contentScope: { searchTarget: { type: "group", groupId: "42" } } })
      .expect(200);

    const preview = await request(app).get("/api/widgets/chat-with-sources/sources/d1/preview").expect(200);
    expect(preview.body).toMatchObject({
      documentId: "d1",
      fileName: "source.pdf",
      sourceUrl: "https://docs.test/source.pdf",
      status: "complete",
    });
    expect(groundxClient.forward).toHaveBeenCalledWith("/ingest/document/d1", expect.objectContaining({ apiKey: "gx-key" }));
    const refined = await request(app)
      .post("/api/widgets/chat-with-sources/citations/refine")
      .send({ citation: { id: "c1", sourceIndex: 1, occurrenceIndex: 1, documentId: "d1" } })
      .expect(200);
    expect(refined.body).toMatchObject({ refined: false, citation: { documentId: "d1" } });
    await request(app).delete(`/api/widgets/chat-with-sources/sessions/${created.body.sessionId}`).expect(200);
  });

  it("streams frontend-safe error events when GroundX or LLM orchestration fails", async () => {
    const repository = new MemoryChatWithSourcesRepository();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).session = { groundxUsername: "gx-user", groundxApiKey: "gx-key" };
      next();
    });
    app.use(
      "/api/widgets/chat-with-sources",
      createChatWithSourcesRoute({
        repository,
        groundxClient: { forward: vi.fn().mockResolvedValue(Response.json({ error: "upstream" }, { status: 500 })) },
        llmClient: { forward: vi.fn() },
        requireSession: (_req, _res, next) => next(),
      })
    );

    const created = await request(app)
      .post("/api/widgets/chat-with-sources/sessions")
      .send({ contentScope: { searchTarget: { type: "bucket", bucketId: 7 } } })
      .expect(200);
    const stream = await request(app)
      .post(`/api/widgets/chat-with-sources/sessions/${created.body.sessionId}/messages/stream`)
      .send({ message: "What happened?" })
      .expect(200);

    expect(stream.text).toContain('"type":"error"');
    expect(stream.text).toContain("Upstream request failed with 500");
    expect(await repository.listMessages(created.body.sessionId)).toEqual([]);
  });
});
