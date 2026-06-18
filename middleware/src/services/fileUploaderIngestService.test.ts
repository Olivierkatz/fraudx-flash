import { describe, expect, it, vi } from "vitest";

import { buildGroundXDocuments, createSingleGroundXUploadPart } from "./fileUploaderIngestService";
import { GroundXUploadService } from "./groundxUploadService";

const metadata = {
  bucketId: 7,
  fileName: "claims.csv",
  fileType: "csv",
  filter: { product: "claims" },
  searchData: { customerId: "customer-1" },
  processLevel: "full" as const,
};

describe("fileUploaderIngestService", () => {
  it("builds remote ingest documents without duplicating GroundX document state", () => {
    const docs = buildGroundXDocuments({
      metadata,
      sourceUrls: ["https://uploads.groundx.test/claims.csv"],
    });

    expect(docs).toEqual([
      {
        bucketId: 7,
        sourceUrl: "https://uploads.groundx.test/claims.csv",
        fileName: "claims.csv",
        fileType: "csv",
        processLevel: "full",
        filter: { product: "claims" },
        searchData: { customerId: "customer-1" },
      },
    ]);
  });

  it("ingests converted DOCX/PPTX as PDFs while preserving original attribution", () => {
    const docs = buildGroundXDocuments({
      metadata: { ...metadata, fileName: "pitch.pdf", fileType: "pdf" },
      sourceUrls: ["https://uploads.groundx.test/pitch.pdf"],
      originalFileName: "pitch.pptx",
      originalFileType: "pptx",
    });

    expect(docs[0]).toMatchObject({
      fileName: "pitch.pdf",
      fileType: "pdf",
      searchData: { customerId: "customer-1", originalFileName: "pitch.pptx", originalFileType: "pptx" },
    });
  });

  it("adds split metadata to every PDF part with identical filter and process level", () => {
    const docs = buildGroundXDocuments({
      metadata: { ...metadata, fileName: "manual.pdf", fileType: "pdf" },
      sourceUrls: ["https://uploads.groundx.test/manual-1.pdf", "https://uploads.groundx.test/manual-2.pdf"],
      sourceParts: [
        { sourceUrl: "https://uploads.groundx.test/manual-1.pdf", fileName: "manual-part-1-of-2.pdf", fileType: "pdf" },
        { sourceUrl: "https://uploads.groundx.test/manual-2.pdf", fileName: "manual-part-2-of-2.pdf", fileType: "pdf" },
      ],
      splitPlan: {
        splitSourceId: "split-1",
        total: 2,
        parts: [
          { part: 1, startPage: 1, endPage: 200 },
          { part: 2, startPage: 201, endPage: 400 },
        ],
      },
    });

    expect(docs).toHaveLength(2);
    expect(docs[0]).toMatchObject({
      sourceUrl: "https://uploads.groundx.test/manual-1.pdf",
      fileName: "manual-part-1-of-2.pdf",
      fileType: "pdf",
      filter: { product: "claims" },
      searchData: expect.objectContaining({ splitSourceId: "split-1", splitPart: 1, splitTotal: 2 }),
    });
    expect(docs[1]).toMatchObject({
      sourceUrl: "https://uploads.groundx.test/manual-2.pdf",
      fileName: "manual-part-2-of-2.pdf",
      fileType: "pdf",
      filter: { product: "claims" },
      searchData: expect.objectContaining({ splitSourceId: "split-1", splitPart: 2, splitTotal: 2 }),
    });
  });

  it("builds the exact GroundX remote ingest shape for converted and split Office uploads", () => {
    const docs = buildGroundXDocuments({
      metadata: {
        ...metadata,
        fileName: "deck.pdf",
        fileType: "pdf",
        processLevel: "none",
      },
      sourceUrls: ["https://cdn.groundx.test/deck-part-1.pdf", "https://cdn.groundx.test/deck-part-2.pdf"],
      sourceParts: [
        { sourceUrl: "https://cdn.groundx.test/deck-part-1.pdf", fileName: "deck-part-1-of-2.pdf", fileType: "pdf" },
        { sourceUrl: "https://cdn.groundx.test/deck-part-2.pdf", fileName: "deck-part-2-of-2.pdf", fileType: "pdf" },
      ],
      originalFileName: "deck.pptx",
      originalFileType: "pptx",
      splitPlan: {
        splitSourceId: "split-office",
        total: 2,
        parts: [
          { part: 1, startPage: 1, endPage: 200 },
          { part: 2, startPage: 201, endPage: 250 },
        ],
      },
    });

    expect(docs).toEqual([
      {
        bucketId: 7,
        sourceUrl: "https://cdn.groundx.test/deck-part-1.pdf",
        fileName: "deck-part-1-of-2.pdf",
        fileType: "pdf",
        processLevel: "none",
        filter: { product: "claims" },
        searchData: {
          customerId: "customer-1",
          originalFileName: "deck.pptx",
          originalFileType: "pptx",
          splitSourceId: "split-office",
          splitPart: 1,
          splitTotal: 2,
        },
      },
      {
        bucketId: 7,
        sourceUrl: "https://cdn.groundx.test/deck-part-2.pdf",
        fileName: "deck-part-2-of-2.pdf",
        fileType: "pdf",
        processLevel: "none",
        filter: { product: "claims" },
        searchData: {
          customerId: "customer-1",
          originalFileName: "deck.pptx",
          originalFileType: "pptx",
          splitSourceId: "split-office",
          splitPart: 2,
          splitTotal: 2,
        },
      },
    ]);
  });

  it("creates upload parts through the GroundX upload service", async () => {
    const uploadService = new GroundXUploadService(
      { uploadBaseUrl: "https://api.eyelevel.ai/upload" },
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ URL: "https://uploads.groundx.test/a.pdf?sig=1", Header: {}, Method: "PUT" }))
      )
    );

    const part = await createSingleGroundXUploadPart({
      uploadId: "u1",
      partId: "p1",
      fileName: "a.pdf",
      fileType: "pdf",
      size: 20,
      uploadService,
    });

    expect(part.hostedUrl).toBe("https://uploads.groundx.test/a.pdf");
  });
});
