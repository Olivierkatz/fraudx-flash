import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(SRC_ROOT, "../..");
const MIDDLEWARE_APP = join(REPO_ROOT, "middleware/src/app.ts");
const API_ROOT = join(SRC_ROOT, "api");

interface RouteContract {
  evidence?: string;
  allowlistReason?: string;
}

const ROUTE_CONTRACTS: Record<string, RouteContract> = {
  "/api/healthz": { allowlistReason: "Health is exercised by preview/smoke checks instead of the frontend SDK." },
  "/api/auth/register": { evidence: "customerRegisterUrl" },
  "/api/auth/login": { evidence: "customerLoginUrl" },
  "/api/auth/logout": { evidence: "customerLogoutUrl" },
  "/api/auth/me": { evidence: "customerDataUrl" },
  "/api/me/metadata": { evidence: "appMetadataUrl" },
  "/api/auth/password/reset": { evidence: "resetPasswordCodeUrl" },
  "/api/auth/password/confirm": { evidence: "resetPasswordConfirmUrl" },
  "/api/v1": { evidence: "groundxUrl" },
  "/api/customer": { evidence: "partnerUrl" },
  "/api/apikey": { evidence: "partnerUrl" },
  "/api/project": { evidence: "partnerUrl" },
  "/api/bucket": { evidence: "partnerUrl" },
  "/api/group": { evidence: "partnerUrl" },
  "/api/llm": { evidence: "llmUrl" },
};

function walk(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")) {
      files.push(full);
    }
  }
  return files;
}

function registeredRoutes(): string[] {
  const text = readFileSync(MIDDLEWARE_APP, "utf8");
  const routes = new Set<string>();

  for (const match of text.matchAll(/app\.(?:get|post|put|patch|delete)\(\s*"([^"]+)"/g)) {
    routes.add(match[1]);
  }
  for (const match of text.matchAll(/app\.use\(\s*"([^"]+)"/g)) {
    routes.add(match[1]);
  }
  for (const match of text.matchAll(/app\.use\(\s*\[([\s\S]*?)\]/g)) {
    for (const route of match[1].matchAll(/"([^"]+)"/g)) {
      routes.add(route[1]);
    }
  }

  return [...routes].sort();
}

describe("server route to frontend API contract", () => {
  it("requires every registered server route to be classified", () => {
    expect(registeredRoutes()).toEqual(Object.keys(ROUTE_CONTRACTS).sort());
  });

  it("requires non-health server routes to have frontend API evidence", () => {
    const apiSource = walk(API_ROOT)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    for (const [route, contract] of Object.entries(ROUTE_CONTRACTS)) {
      if (contract.allowlistReason) continue;
      expect(contract.evidence, `${route} needs client evidence or allowlist reason`).toBeTruthy();
      expect(apiSource, `${route} is registered in middleware but has no frontend API evidence: ${contract.evidence}`).toContain(contract.evidence);
    }
  });
});
