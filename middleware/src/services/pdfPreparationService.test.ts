import { describe, expect, it, vi } from "vitest";

import {
  createPdfSplitPlan,
  deterministicPdfSplit,
  mergeSplitSearchData,
} from "./pdfPreparationService";

const config = {
  recommendedMaxFileSizeBytes: 25 * 1024 * 1024,
  hardMaxFileSizeBytes: 50 * 1024 * 1024,
  recommendedMaxPdfPages: 200,
  hardMaxPdfPages: 750,
};

describe("pdfPreparationService", () => {
  it("keeps small PDFs as a single part", async () => {
    const plan = await createPdfSplitPlan({ fileName: "brief.pdf", fileSize: 1000, pageCount: 20, config });

    expect(plan.total).toBe(1);
    expect(plan.parts).toEqual([{ part: 1, startPage: 1, endPage: 20 }]);
  });

  it("uses deterministic page-window splitting when no LLM planner is configured", () => {
    expect(deterministicPdfSplit(450, 200)).toEqual([
      { part: 1, startPage: 1, endPage: 200 },
      { part: 2, startPage: 201, endPage: 400 },
      { part: 3, startPage: 401, endPage: 450 },
    ]);
  });

  it("splits PDFs that exceed the recommended file size even when page count is below the page recommendation", async () => {
    const plan = await createPdfSplitPlan({
      fileName: "image-heavy.pdf",
      fileSize: 30 * 1024 * 1024,
      pageCount: 100,
      config,
    });

    expect(plan.parts).toEqual([
      { part: 1, startPage: 1, endPage: 83 },
      { part: 2, startPage: 84, endPage: 100 },
    ]);
  });

  it("uses an LLM split plan when it covers all pages within the configured window", async () => {
    const llmPlanner = {
      planPdfSplit: vi.fn().mockResolvedValue([
        { part: 99, startPage: 1, endPage: 125 },
        { part: 100, startPage: 126, endPage: 250 },
      ]),
    };
    const planned = await createPdfSplitPlan({ fileName: "manual.pdf", fileSize: 1, pageCount: 250, config, llmPlanner });
    expect(planned.parts).toEqual([
      { part: 1, startPage: 1, endPage: 125 },
      { part: 2, startPage: 126, endPage: 250 },
    ]);
  });

  it("falls back when the LLM split plan fails, skips pages, overlaps pages, or exceeds the max window", async () => {
    const failingPlanner = { planPdfSplit: vi.fn().mockRejectedValue(new Error("no model")) };
    const fallback = await createPdfSplitPlan({
      fileName: "manual.pdf",
      fileSize: 1,
      pageCount: 250,
      config,
      llmPlanner: failingPlanner,
    });
    expect(fallback.parts).toEqual([
      { part: 1, startPage: 1, endPage: 200 },
      { part: 2, startPage: 201, endPage: 250 },
    ]);

    const invalidPlans = [
      [{ part: 1, startPage: 1, endPage: 199 }],
      [
        { part: 1, startPage: 1, endPage: 150 },
        { part: 2, startPage: 150, endPage: 250 },
      ],
      [{ part: 1, startPage: 1, endPage: 250 }],
    ];

    for (const invalidPlan of invalidPlans) {
      const invalidPlanner = { planPdfSplit: vi.fn().mockResolvedValue(invalidPlan) };
      await expect(
        createPdfSplitPlan({ fileName: "manual.pdf", fileSize: 1, pageCount: 250, config, llmPlanner: invalidPlanner })
      ).resolves.toMatchObject({
        parts: [
          { part: 1, startPage: 1, endPage: 200 },
          { part: 2, startPage: 201, endPage: 250 },
        ],
      });
    }
  });

  it("enforces hard page limits and preserves split attribution search data", async () => {
    await expect(createPdfSplitPlan({ fileName: "huge.pdf", fileSize: 1, pageCount: 751, config })).rejects.toThrow(
      /hard page limit/
    );
    await expect(
      createPdfSplitPlan({ fileName: "huge.pdf", fileSize: 51 * 1024 * 1024, pageCount: 10, config })
    ).rejects.toThrow(/hard file size limit/);

    expect(
      mergeSplitSearchData({
        searchData: { claimId: "c1" },
        originalFileName: "huge.pdf",
        originalFileType: "pdf",
        splitSourceId: "split-1",
        splitPart: 2,
        splitTotal: 4,
      })
    ).toEqual({
      claimId: "c1",
      originalFileName: "huge.pdf",
      originalFileType: "pdf",
      splitSourceId: "split-1",
      splitPart: 2,
      splitTotal: 4,
    });
  });
});
