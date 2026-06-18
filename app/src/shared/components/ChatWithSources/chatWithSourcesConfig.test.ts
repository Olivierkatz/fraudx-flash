import { describe, expect, it } from "vitest";

import {
  createChatWithSourcesConfig,
  defaultChatWithSourcesConfig,
} from "./chatWithSourcesConfig";

describe("chatWithSourcesConfig", () => {
  it("uses production-safe defaults", () => {
    const config = createChatWithSourcesConfig();

    expect(config.copy.title).toBe("CHAT WITH SOURCES");
    expect(config.features.citationRefinement).toBe(true);
    expect(config.limits.maxMessageLength).toBeGreaterThan(0);
    expect(config.copy.educationCopy).toMatch(/GroundX/i);
  });

  it("merges overrides without mutating defaults", () => {
    const config = createChatWithSourcesConfig({
      copy: { title: "CLAIM CHAT" },
      starterPrompts: ["Find anomalies"],
    });

    expect(config.copy.title).toBe("CLAIM CHAT");
    expect(config.starterPrompts).toEqual(["Find anomalies"]);
    expect(defaultChatWithSourcesConfig.copy.title).toBe("CHAT WITH SOURCES");
  });

  it("rejects unsafe or unusable config", () => {
    expect(() => createChatWithSourcesConfig({ copy: { title: "" } })).toThrow(/title/i);
    expect(() => createChatWithSourcesConfig({ limits: { maxMessageLength: 0 } })).toThrow(/maxMessageLength/i);
    expect(() =>
      createChatWithSourcesConfig({ limits: { maxStarterPrompts: 1 }, starterPrompts: ["A", "B"] })
    ).toThrow(/starterPrompts/i);
  });
});
