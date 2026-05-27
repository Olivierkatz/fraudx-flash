#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";

const root = process.cwd();
const markers = ["TO" + "DO", "FIX" + "ME", "X" + "XX", "HA" + "CK"];
const markerPattern = new RegExp(`\\b(?:${markers.join("|")})(?:\\b|\\()`);
const markerWithStableIdPattern = new RegExp(`\\b(?:${markers.join("|")})\\([A-Z][A-Z0-9]*-\\d+\\)`);
const tombstoneNames = new Set(["open-work.md", "chat-fix-list.md", "phase-tracker.md"]);
const ignoredPrefixes = [
  ".git/",
  "app/coverage/",
  "app/dist/",
  "app/node_modules/",
  "app/test-results/",
  "coverage/",
  "dist/",
  "docs/agents/",
  "middleware/coverage/",
  "middleware/dist/",
  "middleware/node_modules/",
  "node_modules/",
  "test-results/",
];
const ignoredExtensions = new Set([
  ".avif",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".lock",
  ".pdf",
  ".png",
  ".svg",
  ".webm",
  ".woff",
  ".woff2",
]);
const violations = [];

function shouldSkip(file) {
  if (ignoredPrefixes.some((prefix) => file.startsWith(prefix))) return true;
  if (file === "package-lock.json") return true;
  return [...ignoredExtensions].some((extension) => file.endsWith(extension));
}

function scanFile(file) {
  if (shouldSkip(file)) return;
  if (file.startsWith("docs/") && tombstoneNames.has(basename(file))) {
    violations.push(`${file}: duplicate tracker tombstone files are not allowed; use docs/agents/backlog.md`);
  }

  const stat = statSync(file);
  if (stat.size > 1024 * 1024) return;

  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (!markerPattern.test(line)) continue;
    if (markerWithStableIdPattern.test(line)) continue;
    violations.push(`${file}:${index + 1}: follow-on marker needs a stable backlog id such as ${markers[0]}(UI-12)`);
  }
}

const gitFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
  cwd: root,
  encoding: "utf8",
}).split("\0").filter(Boolean);

for (const file of gitFiles) {
  scanFile(file);
}

if (violations.length) {
  console.error("Backlog scan failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Backlog scan passed.");
