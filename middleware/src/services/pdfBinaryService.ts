import type { PdfSplitPlan } from "./pdfPreparationService.js";
import type { PreparedBinaryPart } from "./fileUploaderPreparationService.js";

function partFileName(fileName: string, part: number, total: number): string {
  if (total <= 1) return fileName;
  return fileName.replace(/\.pdf$/i, `-part-${part}-of-${total}.pdf`);
}

export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return pdf.getPageCount();
}

export async function splitPdfBytes(input: {
  bytes: Uint8Array;
  splitPlan: PdfSplitPlan;
  fileName: string;
}): Promise<PreparedBinaryPart[]> {
  const { PDFDocument } = await import("pdf-lib");
  const source = await PDFDocument.load(input.bytes, { ignoreEncryption: true });
  const totalPages = source.getPageCount();
  const output: PreparedBinaryPart[] = [];

  for (const planPart of input.splitPlan.parts) {
    if (planPart.startPage < 1 || planPart.endPage > totalPages || planPart.startPage > planPart.endPage) {
      throw new Error("PDF split plan contains an invalid page range");
    }

    const target = await PDFDocument.create();
    const indexes = Array.from(
      { length: planPart.endPage - planPart.startPage + 1 },
      (_, index) => planPart.startPage - 1 + index
    );
    const copiedPages = await target.copyPages(source, indexes);
    copiedPages.forEach((page) => target.addPage(page));
    output.push({
      fileName: partFileName(input.fileName, planPart.part, input.splitPlan.total),
      fileType: "pdf",
      bytes: await target.save(),
    });
  }

  return output;
}
