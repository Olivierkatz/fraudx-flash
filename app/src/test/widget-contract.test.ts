import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WIDGET_SLOTS = [
  join(SRC_ROOT, "shared/components/chat-widgets"),
  join(SRC_ROOT, "shared/components/viewer-widgets"),
];

function widgetDirectories(slotDir: string): string[] {
  if (!existsSync(slotDir)) return [];
  return readdirSync(slotDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => join(slotDir, entry.name));
}

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function sectionBody(text: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`^## ${escaped}\\n([\\s\\S]*?)(?=^## |\\z)`, "m"))?.[1] ?? "";
}

describe("widget slot contract", () => {
  it("keeps chat and viewer widget slots documented", () => {
    for (const slotDir of WIDGET_SLOTS) {
      expect(existsSync(slotDir), `${relative(SRC_ROOT, slotDir)} must exist`).toBe(true);
      expect(existsSync(join(slotDir, "README.md")), `${relative(SRC_ROOT, slotDir)} needs a README`).toBe(true);
    }
  });

  it("requires each real widget to document, test, and expose a mode contract", () => {
    const widgets = WIDGET_SLOTS.flatMap(widgetDirectories);

    for (const widgetDir of widgets) {
      const relativeWidget = relative(SRC_ROOT, widgetDir);
      expect(existsSync(join(widgetDir, "README.md")), `${relativeWidget} needs README.md`).toBe(true);

      const files = walk(widgetDir);
      const componentFiles = files.filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"));
      const testFiles = files.filter((file) => file.endsWith(".test.tsx"));
      const readmeText = readFileSync(join(widgetDir, "README.md"), "utf8");
      const componentText = componentFiles
        .filter((file) => existsSync(file) && statSync(file).isFile())
        .map((file) => readFileSync(file, "utf8"))
        .join("\n");
      const modeContract = sectionBody(readmeText, "Mode Contract");
      const hasModeProp = /\bmode\??\s*:/.test(componentText);
      const hasNoModeRationale = /\b(no mode contract required|mode contract is not required)\b/i.test(modeContract);

      expect(componentFiles.length, `${relativeWidget} needs a widget component`).toBeGreaterThan(0);
      expect(testFiles.length, `${relativeWidget} needs a sibling test`).toBeGreaterThan(0);
      expect(modeContract, `${relativeWidget} needs a README ## Mode Contract section`).not.toBe("");
      expect(hasModeProp || hasNoModeRationale, `${relativeWidget} needs a typed mode prop or explicit no-mode rationale`).toBe(true);
    }
  });
});
