import { describe, expect, it } from "vitest";

import { validateContentScope } from "./contentScope";

describe("contentScope frontend contract", () => {
  it("requires a concrete GroundX search target", () => {
    expect(validateContentScope({ searchTarget: { type: "bucket", bucketId: 7 } })).toEqual({
      searchTarget: { type: "bucket", bucketId: 7 },
    });
    expect(validateContentScope({ searchTarget: { type: "group", groupId: "42" }, projectId: "p1" })).toEqual({
      searchTarget: { type: "group", groupId: "42" },
      projectId: "p1",
    });
    expect(validateContentScope({ searchTarget: { type: "documents", documentIds: ["9f7c11a6-24b8-4d52-a9f3-90a7e70a9e49"] } })).toEqual({
      searchTarget: { type: "documents", documentIds: ["9f7c11a6-24b8-4d52-a9f3-90a7e70a9e49"] },
    });
    expect(() => validateContentScope({ searchTarget: { type: "documents", documentIds: [] } })).toThrow(/search target/i);
    expect(() => validateContentScope({ searchTarget: { type: "documents", documentIds: ["doc-1"] } })).toThrow(/search target/i);
    expect(() => validateContentScope({ searchTarget: { type: "bucket", bucketId: 7 }, filter: { customer: "all" } } as any)).toThrow(/server-derived/i);
  });
});
