import { describe, expect, it } from "vitest";

import { createFileUploaderConfig, defaultFileUploaderConfig, getFileExtension } from "./fileUploaderConfig";

describe("fileUploaderConfig", () => {
  it("uses production-safe GroundX upload defaults", () => {
    const config = createFileUploaderConfig();

    expect(config.copy.title).toBe("UPLOAD FILES");
    expect(config.limits.acceptedExtensions).toContain("pdf");
    expect(config.limits.acceptedExtensions).toContain("docx");
    expect(config.limits.acceptedExtensions).toContain("pptx");
    expect(config.limits.maxFiles).toBe(20);
    expect(config.limits.batchSize).toBe(10);
    expect(config.limits.batchSize).toBeLessThan(20);
    expect(config.limits.jsonHardMaxFileSizeBytes).toBe(5 * 1024 * 1024);
    expect(config.limits.recommendedMaxPdfPages).toBe(200);
    expect(config.limits.hardMaxPdfPages).toBe(750);
  });

  it("merges overrides without mutating defaults", () => {
    const config = createFileUploaderConfig({
      copy: { title: "CASE FILES", educationCopy: "Upload claim files into the current bucket." },
      limits: { acceptedExtensions: ["pdf"], maxFiles: 5, batchSize: 5 },
    });

    expect(config.copy.title).toBe("CASE FILES");
    expect(config.copy.educationCopy).toMatch(/claim files/i);
    expect(config.limits.acceptedExtensions).toEqual(["pdf"]);
    expect(defaultFileUploaderConfig.copy.title).toBe("UPLOAD FILES");
  });

  it("rejects unusable limits and unknown extensions", () => {
    expect(() => createFileUploaderConfig({ limits: { maxFiles: 0 } })).toThrow(/maxFiles/i);
    expect(() =>
      createFileUploaderConfig({ limits: { recommendedMaxFileSizeBytes: 2, hardMaxFileSizeBytes: 1 } })
    ).toThrow(/recommendedMaxFileSizeBytes/i);
    expect(() =>
      createFileUploaderConfig({ limits: { jsonHardMaxFileSizeBytes: 51 * 1024 * 1024 } })
    ).toThrow(/jsonHardMaxFileSizeBytes/i);
    expect(() => createFileUploaderConfig({ limits: { batchSize: 21, maxFiles: 25 } })).toThrow(/recommended/i);
    expect(() => createFileUploaderConfig({ limits: { acceptedExtensions: ["exe" as never] } })).toThrow(/exe/i);
  });

  it("extracts lowercase extensions", () => {
    expect(getFileExtension("Example.PDF")).toBe("pdf");
    expect(getFileExtension("no-extension")).toBe("");
  });
});
