#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";

const files = ["app/vite.config.ts", "app/vitest.config.ts"];

for (const file of files) {
  const text = readFileSync(join(process.cwd(), file), "utf8");
  if (!text.includes('import { fileURLToPath } from "node:url";')) {
    throw new Error(`${file} must import fileURLToPath from node:url.`);
  }
  if (!text.includes('fileURLToPath(new URL("./src", import.meta.url))')) {
    throw new Error(`${file} must resolve the @ alias with fileURLToPath(new URL(...)).`);
  }
  if (text.includes('new URL("./src", import.meta.url).pathname')) {
    throw new Error(`${file} uses URL.pathname, which breaks when the repo path contains spaces.`);
  }
}

console.log("vite alias path-with-spaces contract passed.");
