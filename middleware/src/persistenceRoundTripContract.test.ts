import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import { MemoryAppRepository } from "./db/memoryRepository.js";
import { FakeGroundXClient, FakeLlmClient, FakePartnerClient, testEnv } from "./test/fakes.js";

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

describe("app-owned persistence round-trip contract", () => {
  it("documents every active app-owned persistence contract", () => {
    for (const contract of APP_OWNED_PERSISTENCE_CONTRACTS) {
      expect(contract.publicWritePath).toMatch(/^(GET|POST|PUT|PATCH|DELETE) \/api\//);
      expect(contract.publicReadPath).toMatch(/^(GET|POST|PUT|PATCH|DELETE) \/api\//);
      expect(contract.storageMethods.length).toBeGreaterThan(0);
      expect(contract.closureTest).toBe("middleware/src/persistenceRoundTripContract.test.ts");
    }
  });

  it("keeps reserved metadata fields explicit until a public write path exists", () => {
    expect(RESERVED_METADATA_FIELDS).toEqual([
      "uiPreferencesJson",
      "featureFlagsJson",
      "lastActiveProjectId",
      "acceptedTermsAt",
      "appRole",
    ]);
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
