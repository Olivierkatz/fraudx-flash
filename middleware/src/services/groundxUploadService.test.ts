import { describe, expect, it, vi } from "vitest";

import { cleanHostedUrl, GroundXUploadService, normalizeGroundXUploadResponse } from "./groundxUploadService";

describe("GroundXUploadService", () => {
  it("maps GroundX upload-service responses into browser PUT instructions", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          URL: "https://uploads.groundx.test/object.pdf?signature=abc",
          Header: { "Content-Type": ["application/pdf"], "x-amz-acl": "private" },
          Method: "PUT",
        }),
        { status: 200 }
      )
    );
    const service = new GroundXUploadService({ uploadBaseUrl: "https://api.eyelevel.ai/upload/" }, fetchImpl);

    const upload = await service.createUploadParameters("Annual Report.pdf", "pdf");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0][0])).toBe("https://api.eyelevel.ai/upload/file?name=Annual+Report.pdf&type=pdf");
    expect(upload).toEqual({
      url: "https://uploads.groundx.test/object.pdf?signature=abc",
      method: "PUT",
      headers: { "Content-Type": "application/pdf", "x-amz-acl": "private" },
    });
  });

  it("derives clean hosted URLs and rejects malformed upload responses", () => {
    expect(cleanHostedUrl("https://uploads.groundx.test/file.pdf?signature=abc&expires=1")).toBe(
      "https://uploads.groundx.test/file.pdf"
    );
    expect(() => normalizeGroundXUploadResponse({ Header: {}, Method: "PUT" })).toThrow(/URL/);
    expect(() => normalizeGroundXUploadResponse({ URL: "https://x.test", Method: "POST" })).toThrow(/PUT/);
  });

  it("normalizes upstream upload-service errors", async () => {
    const service = new GroundXUploadService(
      { uploadBaseUrl: "https://api.eyelevel.ai/upload" },
      vi.fn().mockResolvedValue(new Response("bad", { status: 503 }))
    );

    await expect(service.createUploadParameters("a.pdf", "pdf")).rejects.toThrow(/503/);
  });

  it("uploads bytes with the returned method and headers, then prefers GX-HOSTED-URL", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 201, headers: { "GX-HOSTED-URL": "https://cdn.groundx.test/a.pdf" } }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    const service = new GroundXUploadService({ uploadBaseUrl: "https://api.eyelevel.ai/upload" }, fetchImpl);

    await expect(
      service.uploadBytes(
        {
          url: "https://uploads.groundx.test/a.pdf?signature=abc",
          method: "PUT",
          headers: { "Content-Type": "application/pdf" },
        },
        new Uint8Array([1, 2, 3])
      )
    ).resolves.toBe("https://cdn.groundx.test/a.pdf");

    expect(fetchImpl).toHaveBeenCalledWith("https://uploads.groundx.test/a.pdf?signature=abc", {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: new Uint8Array([1, 2, 3]),
    });

    await expect(
      service.uploadBytes(
        {
          url: "https://uploads.groundx.test/b.pdf?signature=abc",
          method: "PUT",
          headers: {},
        },
        new Uint8Array([4])
      )
    ).resolves.toBe("https://uploads.groundx.test/b.pdf");
  });
});
