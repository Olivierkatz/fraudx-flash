import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(SRC_ROOT, "../..");
const MIDDLEWARE_APP = join(REPO_ROOT, "middleware/src/app.ts");

interface RouteContract {
  evidence?: Array<{
    sourcePath: string;
    snippets: string[];
  }>;
  allowlistReason?: string;
}

const ROUTE_CONTRACTS: Record<string, RouteContract> = {
  "/api/healthz": { allowlistReason: "Health is exercised by preview/smoke checks instead of the frontend SDK." },
  "/api/auth/register": {
    evidence: [{ sourcePath: "api/entities/customerEntity.ts", snippets: ["export const register", "customerRegisterUrl"] }],
  },
  "/api/auth/login": {
    evidence: [{ sourcePath: "api/entities/customerEntity.ts", snippets: ["export const login", "customerLoginUrl"] }],
  },
  "/api/auth/logout": {
    evidence: [{ sourcePath: "api/entities/customerEntity.ts", snippets: ["export const logout", "customerLogoutUrl"] }],
  },
  "/api/auth/me": {
    evidence: [{ sourcePath: "api/entities/customerEntity.ts", snippets: ["export const getUserData", "customerDataUrl"] }],
  },
  "/api/me/metadata": {
    evidence: [{ sourcePath: "api/entities/customerEntity.ts", snippets: ["export const updateAppMetadata", "appMetadataUrl"] }],
  },
  "/api/auth/password/reset": {
    evidence: [{ sourcePath: "api/entities/customerEntity.ts", snippets: ["export const resetUserPassword", "resetPasswordCodeUrl"] }],
  },
  "/api/auth/password/confirm": {
    evidence: [{ sourcePath: "api/entities/customerEntity.ts", snippets: ["export const confirmUserChangingPassword", "resetPasswordConfirmUrl"] }],
  },
  "/api/v1": {
    evidence: [
      { sourcePath: "api/entities/groundxBucketsEntity.ts", snippets: ["groundxUrl(\"/v1/bucket"] },
      { sourcePath: "api/entities/groundxDocumentsEntity.ts", snippets: ["groundxUrl(\"/v1/ingest"] },
      { sourcePath: "api/entities/groundxSearchEntity.ts", snippets: ["groundxUrl(\"/v1/search"] },
      { sourcePath: "api/entities/groundxWorkflowsEntity.ts", snippets: ["groundxUrl(\"/v1/workflow"] },
    ],
  },
  "/api/customer": {
    evidence: [{ sourcePath: "api/entities/partnerCustomerEntity.ts", snippets: ["export const getPartnerCustomer", "partnerUrl(`/customer/"] }],
  },
  "/api/apikey": {
    evidence: [{ sourcePath: "api/entities/partnerApiKeysEntity.ts", snippets: ["export const listPartnerApiKeys", "partnerUrl(\"/apikey"] }],
  },
  "/api/project": {
    evidence: [{ sourcePath: "api/entities/partnerProjectsEntity.ts", snippets: ["export const listPartnerProjects", "partnerUrl(\"/project"] }],
  },
  "/api/bucket": {
    evidence: [{ sourcePath: "api/entities/partnerBucketsEntity.ts", snippets: ["export const listPartnerBuckets", "partnerUrl(\"/bucket"] }],
  },
  "/api/group": {
    evidence: [{ sourcePath: "api/entities/partnerGroupsEntity.ts", snippets: ["export const listPartnerGroups", "partnerUrl(\"/group"] }],
  },
  "/api/llm": { allowlistReason: "The base scaffold exposes the LLM proxy for project-specific callers; add a frontend caller when a product uses it." },
};

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
    for (const [route, contract] of Object.entries(ROUTE_CONTRACTS)) {
      if (contract.allowlistReason) continue;
      expect(contract.evidence?.length, `${route} needs route-specific client evidence or an allowlist reason`).toBeGreaterThan(0);

      for (const evidence of contract.evidence ?? []) {
        const sourceFile = join(SRC_ROOT, evidence.sourcePath);
        expect(existsSync(sourceFile), `${route} evidence file is missing: ${evidence.sourcePath}`).toBe(true);
        const sourceText = readFileSync(sourceFile, "utf8");
        for (const snippet of evidence.snippets) {
          expect(sourceText, `${route} has no frontend API evidence in ${evidence.sourcePath}: ${snippet}`).toContain(snippet);
        }
      }
    }
  });
});
