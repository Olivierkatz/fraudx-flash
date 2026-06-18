import { describe, expect, it, vi } from "vitest";

import { MemoryChatWithSourcesRepository } from "../repositories/chatWithSourcesRepository.js";
import {
  ChatWithSourcesService,
  GroundXSearchRateLimiter,
  type ChatWithSourcesRateLimiter,
  type GroundXClient,
  type LlmClient,
} from "./chatWithSourcesService.js";

function response(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

describe("ChatWithSourcesService", () => {
  it("searches the scoped GroundX resource, asks the LLM with grounded context, and persists only chat metadata", async () => {
    const repository = new MemoryChatWithSourcesRepository();
    const groundxClient: GroundXClient = {
      forward: vi.fn().mockResolvedValue(
        response({
          search: {
            text: "[[1]] Contract requires notice.",
            results: [
              {
                documentId: "d1",
                fileName: "contract.pdf",
                fileType: "pdf",
                sourceUrl: "https://docs.groundx.test/contract.pdf",
                text: "Contract requires notice.",
                boundingBoxes: [{ pageNumber: 2, topLeftX: 0, topLeftY: 0, bottomRightX: 1, bottomRightY: 1 }],
                pageImages: ["https://docs.groundx.test/page-2.jpg"],
                pages: [{ number: 2, imageUrl: "https://docs.groundx.test/page-2.jpg", width: 100, height: 200 }],
                score: 87.4,
                searchData: { claimId: "c1" },
              },
            ],
          },
        })
      ),
    };
    const llmClient: LlmClient = {
      forward: vi.fn().mockResolvedValue(response({ answer: "Notice is required. [[1]]" })),
    };
    const service = new ChatWithSourcesService({ repository, groundxClient, llmClient });
    const session = await service.createSession({
      groundxUsername: "gx-user",
      contentScope: { searchTarget: { type: "bucket", bucketId: 7 } },
    });

    const answer = await service.answer({ session, message: "What is required?", apiKey: "gx-key" });

    expect(groundxClient.forward).toHaveBeenCalledWith(
      "/search/7?n=10&verbosity=2",
      expect.objectContaining({
        method: "POST",
        apiKey: "gx-key",
        body: JSON.stringify({ query: "What is required?", relevance: 10 }),
      })
    );
    expect(llmClient.forward).toHaveBeenCalledWith(
      "/chat/completions",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("[1] contract.pdf | d1"),
      })
    );
    expect(answer.assistantMessage.segments).toEqual([
      { type: "content", text: "Notice is required. " },
      {
        type: "citation",
        citation: expect.objectContaining({
          documentId: "d1",
          fileName: "contract.pdf",
          sourceIndex: 1,
          boundingBoxes: [{ pageNumber: 2, topLeftX: 0, topLeftY: 0, bottomRightX: 1, bottomRightY: 1 }],
          pages: [{ number: 2, imageUrl: "https://docs.groundx.test/page-2.jpg", width: 100, height: 200 }],
          score: 87.4,
          searchData: { claimId: "c1" },
        }),
      },
    ]);
    expect(await repository.listMessages(session.sessionId)).toHaveLength(2);
  });

  it("supports bucket, group, and document content scope and rejects invalid scope", () => {
    const service = new ChatWithSourcesService({
      repository: new MemoryChatWithSourcesRepository(),
      groundxClient: { forward: vi.fn() },
      llmClient: { forward: vi.fn() },
    });

    expect(service.normalizeScope({ searchTarget: { type: "group", groupId: "42" } })).toEqual({ searchTarget: { type: "group", groupId: "42" } });
    expect(service.normalizeScope({ searchTarget: { type: "documents", documentIds: ["9f7c11a6-24b8-4d52-a9f3-90a7e70a9e49"] } })).toEqual({
      searchTarget: { type: "documents", documentIds: ["9f7c11a6-24b8-4d52-a9f3-90a7e70a9e49"] },
    });
    expect(() => service.normalizeScope({ searchTarget: { type: "documents", documentIds: ["doc-1"] } })).toThrow(/search target/i);
    expect(() => service.normalizeScope({ searchTarget: { type: "group", groupId: "g1" } })).toThrow(/search target/i);
    expect(() => service.normalizeScope({ searchTarget: { type: "document" } })).toThrow(/search target/i);
  });

  it("uses GroundX documented search_content query parameters and body shape", async () => {
    const groundxClient: GroundXClient = {
      forward: vi.fn().mockResolvedValue(response({ search: { text: "No answer", results: [] } })),
    };
    const llmClient: LlmClient = {
      forward: vi.fn().mockResolvedValue(response({ choices: [{ message: { content: "No matching source." } }] })),
    };
    const service = new ChatWithSourcesService({
      repository: new MemoryChatWithSourcesRepository(),
      groundxClient,
      llmClient,
    });
    const session = await service.createSession({
      groundxUsername: "gx-user",
      contentScope: { searchTarget: { type: "group", groupId: 42 } },
    });

    await service.answer({ session, message: "  Search me  ", apiKey: "gx-key" });

    expect(groundxClient.forward).toHaveBeenCalledWith(
      "/search/42?n=10&verbosity=2",
      {
        method: "POST",
        body: JSON.stringify({ query: "Search me", relevance: 10 }),
        apiKey: "gx-key",
      }
    );
  });

  it("routes document-set search through search_documents with server-derived filters only", async () => {
    const groundxClient: GroundXClient = {
      forward: vi.fn().mockResolvedValue(response({ search: { results: [] } })),
    };
    const llmClient: LlmClient = {
      forward: vi.fn().mockResolvedValue(response({ answer: "No matching source." })),
    };
    const service = new ChatWithSourcesService({
      repository: new MemoryChatWithSourcesRepository(),
      groundxClient,
      llmClient,
    });
    const documentId = "9f7c11a6-24b8-4d52-a9f3-90a7e70a9e49";
    const session = await service.createSession({
      groundxUsername: "gx-user",
      contentScope: {
        searchTarget: { type: "documents", documentIds: [documentId] },
        projectId: "project-a",
        folderId: "folder-b",
      },
    });

    await service.answer({
      session,
      message: "Find the issue",
      apiKey: "gx-key",
      contentConstraints: { roles: ["reviewer"], status: "approved" },
    });

    expect(groundxClient.forward).toHaveBeenCalledWith(
      "/search/documents?n=10&verbosity=2",
      {
        method: "POST",
        apiKey: "gx-key",
        body: JSON.stringify({
          documentIds: [documentId],
          query: "Find the issue",
          relevance: 10,
          filter: {
            $and: [
              { project: "project-a" },
              { folder: "folder-b" },
              { roles: { $in: ["reviewer"] } },
              { status: "approved" },
            ],
          },
        }),
      }
    );
  });

  it("builds numbered LLM context from individual results instead of merged search.text", async () => {
    const groundxClient: GroundXClient = {
      forward: vi.fn().mockResolvedValue(
        response({
          search: {
            text: "Merged context should not be used for inline citations.",
            results: [
              { documentId: "d1", fileName: "one.pdf", suggestedText: "Suggested source one." },
              { documentId: "d2", fileName: "two.pdf", text: "Raw source two." },
            ],
          },
        })
      ),
    };
    const llmClient: LlmClient = {
      forward: vi.fn().mockResolvedValue(response({ answer: "First claim [1]. Second claim [[2]]." })),
    };
    const service = new ChatWithSourcesService({
      repository: new MemoryChatWithSourcesRepository(),
      groundxClient,
      llmClient,
    });
    const session = await service.createSession({
      groundxUsername: "gx-user",
      contentScope: { searchTarget: { type: "bucket", bucketId: 7 } },
    });

    const answer = await service.answer({ session, message: "Compare", apiKey: "gx-key" });
    const llmBody = JSON.parse(vi.mocked(llmClient.forward).mock.calls[0][1].body as string);
    const userContent = llmBody.messages[1].content as string;

    expect(userContent).toContain("[1] one.pdf | d1");
    expect(userContent).toContain("Suggested source one.");
    expect(userContent).toContain("[2] two.pdf | d2");
    expect(userContent).toContain("Raw source two.");
    expect(userContent).not.toContain("Merged context should not be used");
    expect(answer.assistantMessage.segments).toEqual([
      { type: "content", text: "First claim " },
      { type: "citation", citation: expect.objectContaining({ documentId: "d1", sourceIndex: 1 }) },
      { type: "content", text: ". Second claim " },
      { type: "citation", citation: expect.objectContaining({ documentId: "d2", sourceIndex: 2 }) },
      { type: "content", text: "." },
    ]);
  });

  it("requires the server-side GroundX API key before searching", async () => {
    const groundxClient: GroundXClient = { forward: vi.fn() };
    const service = new ChatWithSourcesService({
      repository: new MemoryChatWithSourcesRepository(),
      groundxClient,
      llmClient: { forward: vi.fn() },
    });
    const session = await service.createSession({
      groundxUsername: "gx-user",
      contentScope: { searchTarget: { type: "bucket", bucketId: 7 } },
    });

    await expect(service.answer({ session, message: "Hello", apiKey: "" })).rejects.toThrow(/api key is required/i);
    expect(groundxClient.forward).not.toHaveBeenCalled();
  });

  it("runs GroundX search through the rate limiter so deployments can honor documented search targets", async () => {
    const limiter: ChatWithSourcesRateLimiter = { run: vi.fn((task) => task()) };
    const service = new ChatWithSourcesService({
      repository: new MemoryChatWithSourcesRepository(),
      groundxClient: {
        forward: vi.fn().mockResolvedValue(response({ search: { results: [] } })),
      },
      llmClient: { forward: vi.fn().mockResolvedValue(response({ answer: "No matching sources." })) },
      searchLimiter: limiter,
    });
    const session = await service.createSession({
      groundxUsername: "gx-user",
      contentScope: { searchTarget: { type: "bucket", bucketId: 7 } },
    });

    await service.answer({ session, message: "Hello", apiKey: "gx-key" });

    expect(limiter.run).toHaveBeenCalledTimes(1);
  });

  it("limits concurrent search execution in the default GroundX search limiter", async () => {
    const limiter = new GroundXSearchRateLimiter(1, 0);
    const order: string[] = [];
    let releaseFirst: (() => void) | undefined;

    const first = limiter.run(
      () =>
        new Promise<string>((resolve) => {
          order.push("first-start");
          releaseFirst = () => {
            order.push("first-end");
            resolve("first");
          };
        })
    );
    const second = limiter.run(async () => {
      order.push("second-start");
      return "second";
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual(["first-start"]);
    releaseFirst?.();
    await expect(Promise.all([first, second])).resolves.toEqual(["first", "second"]);
    expect(order).toEqual(["first-start", "first-end", "second-start"]);
  });

  it("normalizes citation refinement without exposing LLM/provider credentials", async () => {
    const service = new ChatWithSourcesService({
      repository: new MemoryChatWithSourcesRepository(),
      groundxClient: { forward: vi.fn() },
      llmClient: { forward: vi.fn() },
    });

    await expect(
      service.refineCitation({ id: "c1", sourceIndex: 1, occurrenceIndex: 1, documentId: "d1" })
    ).resolves.toMatchObject({ refined: false, citation: { documentId: "d1" } });
  });

  it("normalizes GroundX document_get preview responses into frontend-safe source metadata", async () => {
    const service = new ChatWithSourcesService({
      repository: new MemoryChatWithSourcesRepository(),
      groundxClient: {
        forward: vi.fn().mockResolvedValue(
          response({
            document: {
              documentId: "d1",
              processId: "p1",
              bucketId: 7,
              fileName: "source.pdf",
              fileType: "pdf",
              sourceUrl: "https://docs.groundx.test/source.pdf",
              textUrl: "https://docs.groundx.test/source.txt",
              xrayUrl: "https://docs.groundx.test/source-xray.json",
              status: "complete",
              statusMessage: "Ready",
              searchData: { claimId: "c1" },
              filter: { tenant: "demo" },
            },
          })
        ),
      },
      llmClient: { forward: vi.fn() },
    });

    await expect(service.sourcePreview("d1", "gx-key")).resolves.toEqual({
      documentId: "d1",
      processId: "p1",
      bucketId: 7,
      fileName: "source.pdf",
      fileType: "pdf",
      sourceUrl: "https://docs.groundx.test/source.pdf",
      textUrl: "https://docs.groundx.test/source.txt",
      xrayUrl: "https://docs.groundx.test/source-xray.json",
      status: "complete",
      statusMessage: "Ready",
      searchData: { claimId: "c1" },
      filter: { tenant: "demo" },
    });
  });
});
