#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const envPaths = [resolve(".env.local"), resolve("middleware/.env.local")];
const backups = envPaths.map((path) => `${path}.test-backup`);

function restore() {
  for (const [index, envPath] of envPaths.entries()) {
    rmSync(envPath, { force: true });
    if (existsSync(backups[index])) renameSync(backups[index], envPath);
  }
}

if (backups.some((backupPath) => existsSync(backupPath))) {
  throw new Error("Refusing to run because a .env.local test backup already exists.");
}

for (const [index, envPath] of envPaths.entries()) {
  if (existsSync(envPath)) renameSync(envPath, backups[index]);
}

try {
  const missing = spawnSync("node", ["scripts/setup-local-env.mjs", "--force"], {
    env: { ...process.env, WORKSPACE_API_KEY: "test-workspace-key", LLM_SERVICE: "openai", LLM_MODEL_ID: "gpt-test", LLM_API_KEY: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "" },
    encoding: "utf8",
  });
  if (missing.status === 0) {
    throw new Error("setup-local-env should fail when LLM_API_KEY is missing.");
  }
  if (!missing.stderr.includes("LLM_API_KEY is required")) {
    throw new Error("setup-local-env missing-key error did not mention LLM_API_KEY.");
  }

  const missingService = spawnSync("node", ["scripts/setup-local-env.mjs", "--force"], {
    env: { ...process.env, WORKSPACE_API_KEY: "test-workspace-key", LLM_SERVICE: "", LLM_MODEL_ID: "gpt-test", LLM_API_KEY: "test-llm-key" },
    encoding: "utf8",
  });
  if (missingService.status === 0) {
    throw new Error("setup-local-env should fail when LLM_SERVICE is missing.");
  }
  if (!missingService.stderr.includes("LLM_SERVICE is required")) {
    throw new Error("setup-local-env missing-service error did not mention LLM_SERVICE.");
  }

  const missingModel = spawnSync("node", ["scripts/setup-local-env.mjs", "--force"], {
    env: { ...process.env, WORKSPACE_API_KEY: "test-workspace-key", LLM_SERVICE: "openai", LLM_MODEL_ID: "", LLM_API_KEY: "test-llm-key" },
    encoding: "utf8",
  });
  if (missingModel.status === 0) {
    throw new Error("setup-local-env should fail when LLM_MODEL_ID is missing.");
  }
  if (!missingModel.stderr.includes("LLM_MODEL_ID is required")) {
    throw new Error("setup-local-env missing-model error did not mention LLM_MODEL_ID.");
  }

  const success = spawnSync("node", ["scripts/setup-local-env.mjs", "--force"], {
    env: {
      ...process.env,
      WORKSPACE_API_KEY: "test-workspace-key",
      LLM_SERVICE: "openai",
      LLM_MODEL_ID: "gpt-test",
      LLM_API_KEY: "test-llm-key",
      SCAFFOLD_PRIMARY_SURFACE: "chat-driven viewer",
      SCAFFOLD_CAPABILITIES: "chat, extraction, document viewer",
      SCAFFOLD_ONBOARDING: "no",
    },
    encoding: "utf8",
  });
  if (success.status !== 0) {
    throw new Error(`setup-local-env failed with both keys:\n${success.stdout}\n${success.stderr}`);
  }

  for (const envPath of envPaths) {
    const written = readFileSync(envPath, "utf8");
    for (const required of [
      "GROUNDX_WORKSPACE_API_KEY=test-workspace-key",
      "GROUNDX_PARTNER_API_KEY=test-workspace-key",
      "LLM_SERVICE=openai",
      "LLM_MODEL_ID=gpt-test",
      "LLM_API_KEY=test-llm-key",
      "MOCK_MODE=true",
      "APP_REPOSITORY_MODE=memory",
      "APP_AUTH_MODE=customer",
      "VITE_APP_AUTH_MODE=customer",
      "APP_PRIMARY_SURFACE=chat-driven-viewer",
      "VITE_APP_PRIMARY_SURFACE=chat-driven-viewer",
      "APP_CAPABILITIES=chat,extraction,document-viewer",
      "VITE_APP_CAPABILITIES=chat,extraction,document-viewer",
      "APP_ONBOARDING_ENABLED=false",
      "VITE_APP_ONBOARDING_ENABLED=false",
    ]) {
      if (!written.includes(required)) throw new Error(`${envPath} missing ${required}`);
    }
  }

  const aliasSuccess = spawnSync("node", ["scripts/setup-local-env.mjs", "--force"], {
    env: {
      ...process.env,
      WORKSPACE_API_KEY: "test-workspace-key",
      LLM_SERVICE: "anthropic",
      LLM_MODEL_ID: "claude-test",
      LLM_API_KEY: "",
      ANTHROPIC_API_KEY: "test-anthropic-key",
    },
    encoding: "utf8",
  });
  if (aliasSuccess.status !== 0) {
    throw new Error(`setup-local-env failed to use service-specific LLM key alias:\n${aliasSuccess.stdout}\n${aliasSuccess.stderr}`);
  }
  const aliasWritten = readFileSync(resolve("middleware/.env.local"), "utf8");
  if (!aliasWritten.includes("LLM_API_KEY=test-anthropic-key")) {
    throw new Error("setup-local-env did not use ANTHROPIC_API_KEY when LLM_SERVICE=anthropic.");
  }

  const legacyAliasSuccess = spawnSync("node", ["scripts/setup-local-env.mjs", "--force"], {
    env: {
      ...process.env,
      WORKSPACE_API_KEY: "",
      PARTNER_API_KEY: "",
      GROUNDX_API_KEY: "test-groundx-key",
      LLM_SERVICE: "openai",
      LLM_MODEL_ID: "gpt-test",
      LLM_API_KEY: "test-llm-key",
    },
    encoding: "utf8",
  });
  if (legacyAliasSuccess.status !== 0) {
    throw new Error(`setup-local-env failed to use GROUNDX_API_KEY as workspace key alias:\n${legacyAliasSuccess.stdout}\n${legacyAliasSuccess.stderr}`);
  }
  const legacyAliasWritten = readFileSync(resolve("middleware/.env.local"), "utf8");
  if (!legacyAliasWritten.includes("GROUNDX_WORKSPACE_API_KEY=test-groundx-key")) {
    throw new Error("setup-local-env did not write GROUNDX_WORKSPACE_API_KEY from GROUNDX_API_KEY.");
  }

  const partnerModeSuccess = spawnSync("node", ["scripts/setup-local-env.mjs", "--force"], {
    env: {
      ...process.env,
      APP_AUTH_MODE: "partner",
      WORKSPACE_API_KEY: "test-workspace-key",
      LLM_SERVICE: "openai",
      LLM_MODEL_ID: "gpt-test",
      LLM_API_KEY: "test-llm-key",
    },
    encoding: "utf8",
  });
  if (partnerModeSuccess.status !== 0) {
    throw new Error(`setup-local-env failed when Partner auth mode was explicit:\n${partnerModeSuccess.stdout}\n${partnerModeSuccess.stderr}`);
  }
  const partnerModeWritten = readFileSync(resolve("middleware/.env.local"), "utf8");
  if (!partnerModeWritten.includes("APP_AUTH_MODE=partner") || !partnerModeWritten.includes("VITE_APP_AUTH_MODE=partner")) {
    throw new Error("setup-local-env did not write explicit Partner auth mode to both middleware and Vite env.");
  }

  console.log("setup-local-env contract passed.");
} finally {
  restore();
}
