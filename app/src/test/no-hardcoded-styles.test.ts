import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_ROOTS = [join(SRC_ROOT, "shared/components"), join(SRC_ROOT, "views")];

const EXEMPT_OFFENDER_IDS = new Set([
  'views/Auth/AuthLayout.tsx:viewport height literal:minHeight: "100vh",',
  'views/Banned/Banned.tsx:viewport height literal:<Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", backgroundColor: MAIN_BACKGROUND, p: 3 }}>',
  "views/CoreLayouts/Dashboard.tsx:numeric borderRadius:borderRadius: 1,",
  'views/CoreLayouts/Dashboard.tsx:viewport height literal:<Box sx={{ display: "flex", minHeight: "100vh", backgroundColor: MAIN_BACKGROUND }}>',
  "views/CoreLayouts/Dashboard.tsx:numeric fontSize:fontSize: 30,",
  "views/Home/Home.tsx:numeric fontSize:fontSize: 28,",
  "views/Home/Home.tsx:numeric fontWeight:sx={{ backgroundColor: GREEN, color: NAVY, fontWeight: 700 }}",
]);

const STYLE_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "hex color", pattern: /#[0-9a-fA-F]{3,8}\b/g },
  { name: "numeric fontSize", pattern: /\bfontSize\s*:\s*\d/g },
  { name: "numeric fontWeight", pattern: /\bfontWeight\s*:\s*\d/g },
  { name: "numeric borderRadius", pattern: /\bborderRadius\s*:\s*\d/g },
  { name: "viewport height literal", pattern: /\b(?:minHeight|maxHeight)\s*:\s*["']\d+(?:vh|vw|px)["']/g },
];

interface StyleOffender {
  id: string;
  file: string;
  kind: string;
  line: string;
}

function walkSource(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSource(full, files);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")) {
      files.push(full);
    }
  }
  return files;
}

function collectOffenders(file: string): StyleOffender[] {
  const relativePath = relative(SRC_ROOT, file);
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  const offenders: StyleOffender[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    for (const { name, pattern } of STYLE_PATTERNS) {
      pattern.lastIndex = 0;
      if (!pattern.test(line)) continue;
      offenders.push({
        file: relativePath,
        kind: name,
        line: trimmedLine,
        id: `${relativePath}:${name}:${trimmedLine}`,
      });
    }
  }

  return offenders;
}

describe("hardcoded style drift guard", () => {
  it("keeps raw style literals on an explicit shrinking allowlist", () => {
    const offenders = SCAN_ROOTS.flatMap((root) => walkSource(root)).flatMap(collectOffenders);
    const offenderIds = new Set(offenders.map((offender) => offender.id));

    for (const offender of offenders) {
      expect(
        EXEMPT_OFFENDER_IDS.has(offender.id),
        `${offender.file} has a hardcoded ${offender.kind}; use tokens or add a justified shrinking exemption: ${offender.line}`,
      ).toBe(true);
    }

    for (const exemptId of EXEMPT_OFFENDER_IDS) {
      expect(
        offenderIds.has(exemptId),
        `style exemption should be removed after the literal is cleaned up: ${exemptId}`,
      ).toBe(true);
    }
  });
});
