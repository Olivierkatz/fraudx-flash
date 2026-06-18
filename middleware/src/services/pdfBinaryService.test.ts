import { describe, expect, it } from "vitest";

import { countPdfPages, splitPdfBytes } from "./pdfBinaryService";

async function createPdf(pageCount: number): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    pdf.addPage([200, 200]);
  }
  return pdf.save();
}

describe("pdfBinaryService", () => {
  it("counts pages and writes valid split PDF parts with stable part names", async () => {
    const bytes = await createPdf(3);

    await expect(countPdfPages(bytes)).resolves.toBe(3);

    const parts = await splitPdfBytes({
      bytes,
      fileName: "manual.pdf",
      splitPlan: {
        splitSourceId: "split-1",
        total: 2,
        parts: [
          { part: 1, startPage: 1, endPage: 2 },
          { part: 2, startPage: 3, endPage: 3 },
        ],
      },
    });

    expect(parts.map((part) => part.fileName)).toEqual(["manual-part-1-of-2.pdf", "manual-part-2-of-2.pdf"]);
    await expect(countPdfPages(parts[0].bytes)).resolves.toBe(2);
    await expect(countPdfPages(parts[1].bytes)).resolves.toBe(1);
  });

  it("rejects split plans that reference pages outside the PDF", async () => {
    const bytes = await createPdf(2);

    await expect(
      splitPdfBytes({
        bytes,
        fileName: "manual.pdf",
        splitPlan: {
          splitSourceId: "split-1",
          total: 1,
          parts: [{ part: 1, startPage: 1, endPage: 3 }],
        },
      })
    ).rejects.toThrow(/invalid page range/);
  });
});
