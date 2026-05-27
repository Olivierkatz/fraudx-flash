import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import { MemoryAppRepository } from "./db/memoryRepository.js";
import { FakeGroundXClient, FakeLlmClient, FakePartnerClient, testEnv } from "./test/fakes.js";

const HERE = dirname(fileURLToPath(import.meta.url));

const APP_OWNED_PERSISTENCE_CONTRACTS = [
  {
    name: "session",
    publicWritePath: "POST /api/auth/login",
    publicReadPath: "GET /api/auth/me",
    storageMethods: ["createSession", "getSession", "deleteSession"],
    closureTest: "middleware/src/persistenceRoundTripContract.test.ts",
  },
  {
    name: "onboarding metadata",
    publicWritePath: "PATCH /api/me/metadata",
    publicReadPath: "GET /api/auth/me",
    storageMethods: ["upsertMetadata", "getMetadata"],
    closureTest: "middleware/src/persistenceRoundTripContract.test.ts",
  },
] as const;

const METADATA_IDENTITY_FIELDS = ["groundxUsername"] as const;
const PUBLIC_METADATA_WRITE_FIELDS = ["onboardingState"] as const;
const RESERVED_METADATA_FIELDS = [
  "uiPreferencesJson",
  "featureFlagsJson",
  "lastActiveProjectId",
  "acceptedTermsAt",
  "appRole",
] as const;

function setup() {
  const repository = new MemoryAppRepository();
  const app = createApp({
    env: testEnv,
    repository,
    partnerClient: new FakePartnerClient(),
    groundxClient: new FakeGroundXClient(),
    llmClient: new FakeLlmClient(),
  });
  return { app, repository };
}

function appUserMetadataFieldsFromType(): string[] {
  const text = readFileSync(join(HERE, "types.ts"), "utf8");
  const match = text.match(/export interface AppUserMetadata \{([\s\S]*?)\n\}/);
  if (!match) throw new Error("AppUserMetadata interface not found");
  return [...match[1].matchAll(/^\s*([A-Za-z][A-Za-z0-9]*)\??:/gm)].map((field) => field[1]).sort();
}

function allowedMetadataPatchFieldsFromRoute(): string[] {
  const text = readFileSync(join(HERE, "app.ts"), "utf8");
  const match = text.match(/allowedFields\s*=\s*new Set\(\[([^\]]*)\]\)/);
  if (!match) throw new Error("metadata allowedFields set not found");
  return [...match[1].matchAll(/"([^"]+)"/g)].map((field) => field[1]).sort();
}

describe("app-owned persistence round-trip contract", () => {
  it("documents every active app-owned persistence contract", () => {
    for (const contract of APP_OWNED_PERSISTENCE_CONTRACTS) {
      expect(contract.publicWritePath).toMatch(/^(GET|POST|PUT|PATCH|DELETE) \/api\//);
      expect(contract.publicReadPath).toMatch(/^(GET|POST|PUT|PATCH|DELETE) \/api\//);
      expect(contract.storageMethods.length).toBeGreaterThan(0);
      expect(contract.closureTest).toBe("middleware/src/persistenceRoundTripContract.test.ts");
    }
  });

  it("classifies every metadata field as identity, public-write, or reserved", () => {
    const classifiedFields = [
      ...METADATA_IDENTITY_FIELDS,
      ...PUBLIC_METADATA_WRITE_FIELDS,
      ...RESERVED_METADATA_FIELDS,
    ].sort();

    expect(appUserMetadataFieldsFromType()).toEqual(classifiedFields);
  });

  it("keeps public metadata writes limited to fields with a round-trip closure path", () => {
    expect(allowedMetadataPatchFieldsFromRoute()).toEqual([...PUBLIC_METADATA_WRITE_FIELDS].sort());
  });

  it("round-trips onboarding metadata through public write and read paths", async () => {
    const { app } = setup();
    const agent = request.agent(app);

    await agent.post("/api/auth/login").send({ email: "pat@example.com", password: "secret" }).expect(200);
    await agent.patch("/api/me/metadata").send({ onboardingState: "complete" }).expect(200);

    await agent.get("/api/auth/me").expect(200).expect((res) => {
      expect(res.body.appMetadata).toMatchObject({
        groundxUsername: "gx-user",
        onboardingState: "complete",
      });
    });
  });
});
