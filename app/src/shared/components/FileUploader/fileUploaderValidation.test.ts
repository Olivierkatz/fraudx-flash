import { describe, expect, it } from "vitest";

import { createFileUploaderConfig } from "./fileUploaderConfig";
import { validateFileForGroundXUpload } from "./fileUploaderValidation";

const config = createFileUploaderConfig();

function file(name: string, size = 1024): Pick<File, "name" | "size"> {
  return { name, size };
}

describe("validateFileForGroundXUpload", () => {
  it("accepts supported files", () => {
    expect(validateFileForGroundXUpload({ file: file("guide.pdf"), config })).toMatchObject({
      valid: true,
      requiresPreparation: false,
    });
  });

  it("marks DOCX and PPTX files for server-side PDF conversion", () => {
    expect(validateFileForGroundXUpload({ file: file("claim.docx"), config }).requiresPreparation).toBe(true);
    expect(validateFileForGroundXUpload({ file: file("deck.pptx"), config }).requiresPreparation).toBe(true);
  });

  it("marks large PDFs for preparation and rejects hard page limits", () => {
    expect(validateFileForGroundXUpload({ file: file("manual.pdf"), config, pdfPageCount: 250 })).toMatchObject({
      valid: true,
      requiresPreparation: true,
    });
    expect(validateFileForGroundXUpload({ file: file("manual.pdf"), config, pdfPageCount: 751 })).toMatchObject({
      valid: false,
    });
  });

  it("rejects JSON files above GroundX's documented 5 MB hard limit", () => {
    const result = validateFileForGroundXUpload({
      file: file("payload.json", 6 * 1024 * 1024),
      config,
    });

    expect(result.valid).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/JSON file limit/i);
  });

  it("rejects unsupported and duplicate files", () => {
    const result = validateFileForGroundXUpload({
      file: file("script.exe"),
      config,
      existingNames: ["script.exe"],
    });

    expect(result.valid).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/not supported/i);
    expect(result.reasons.join(" ")).toMatch(/already/i);
  });
});
