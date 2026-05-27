import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_ROOTS = [join(SRC_ROOT, "shared/components"), join(SRC_ROOT, "views")];

const EXEMPT_OFFENDER_COUNTS: Record<string, number> = {
  "views/Auth/AuthLayout.tsx": 1,
  "views/Banned/Banned.tsx": 1,
  "views/CoreLayouts/Dashboard.tsx": 3,
  "views/Home/Home.tsx": 2,
};

const STYLE_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "hex color", pattern: /#[0-9a-fA-F]{3,8}\b/g },
  { name: "numeric fontSize", pattern: /\bfontSize\s*:\s*\d/g },
  { name: "numeric fontWeight", pattern: /\bfontWeight\s*:\s*\d/g },
  { name: "numeric borderRadius", pattern: /\bborderRadius\s*:\s*\d/g },
  { name: "viewport height literal", pattern: /\b(?:minHeight|maxHeight)\s*:\s*["']\d+(?:vh|vw|px)["']/g },
];

function walkTsx(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsx(full, files);
    } else if (entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")) {
      files.push(full);
    }
  }
  return files;
}

function countOffenders(text: string): number {
  return STYLE_PATTERNS.reduce((count, { pattern }) => count + [...text.matchAll(pattern)].length, 0);
}

describe("hardcoded style drift guard", () => {
  it("keeps raw style literals on an explicit shrinking allowlist", () => {
    const actualCounts = new Map<string, number>();

    for (const file of SCAN_ROOTS.flatMap((root) => walkTsx(root))) {
      const relativePath = relative(SRC_ROOT, file);
      const offenderCount = countOffenders(readFileSync(file, "utf8"));
      if (offenderCount > 0) actualCounts.set(relativePath, offenderCount);
    }

    for (const [relativePath, offenderCount] of actualCounts) {
      expect(
        EXEMPT_OFFENDER_COUNTS[relativePath],
        `${relativePath} has ${offenderCount} hardcoded style literal(s); use tokens or add a justified shrinking exemption`,
      ).toBe(offenderCount);
    }

    for (const [relativePath, expectedCount] of Object.entries(EXEMPT_OFFENDER_COUNTS)) {
      expect(actualCounts.get(relativePath) ?? 0, `${relativePath} exemption count should shrink when literals are removed`).toBe(expectedCount);
    }
  });
});
