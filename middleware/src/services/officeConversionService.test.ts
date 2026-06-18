import { describe, expect, it } from "vitest";

import { convertOfficeToPdf } from "./officeConversionService";

describe("officeConversionService", () => {
  it("fails clearly when server-side conversion is disabled", async () => {
    await expect(
      convertOfficeToPdf({
        fileName: "brief.docx",
        bytes: Buffer.from("doc"),
        config: { enabled: false, command: "soffice", timeoutMs: 1000 },
      })
    ).rejects.toThrow(/PDF conversion is not configured/);
  });

  it("fails clearly when the configured converter binary is unavailable", async () => {
    await expect(
      convertOfficeToPdf({
        fileName: "brief.docx",
        bytes: Buffer.from("doc"),
        config: { enabled: true, command: "__missing_office_converter__", timeoutMs: 1000 },
      })
    ).rejects.toThrow(/Office to PDF conversion failed/);
  });
});
