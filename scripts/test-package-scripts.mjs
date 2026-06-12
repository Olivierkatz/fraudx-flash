#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readPackage(path) {
  return JSON.parse(readFileSync(resolve(path, "package.json"), "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = readPackage(".");
const app = readPackage("app");
const middleware = readPackage("middleware");

assert(root.scripts?.typecheck === "npm --workspace app run typecheck && npm --workspace middleware run typecheck", "root package.json must expose a fail-loud typecheck command for app and middleware");
assert(root.scripts?.verify?.includes("npm test") && root.scripts.verify.includes("npm run verify:preview"), "root package.json must expose the canonical aggregate verify command");
assert(root.scripts?.test?.includes("npm run test:package-scripts"), "root npm test must include the package script contract");
assert(root.scripts?.test?.includes("npm run typecheck"), "root npm test must include typecheck before lower-level tests");
assert(app.scripts?.typecheck === "tsc --noEmit", "app package.json must expose typecheck as tsc --noEmit");
assert(middleware.scripts?.typecheck === "tsc --noEmit", "middleware package.json must expose typecheck as tsc --noEmit");

console.log("package script contract passed.");
