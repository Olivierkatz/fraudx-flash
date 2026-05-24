#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const rootEnvPath = resolve(root, ".env.local");
const middlewareEnvPath = resolve(root, "middleware/.env.local");
const force = process.argv.includes("--force");

function readEnvFile(path, values) {
  if (!existsSync(path) || force) return;
  const current = readFileSync(path, "utf8");
  for (const line of current.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match) values.set(match[1], match[2]);
  }
}

function readExistingEnv() {
  const values = new Map();
  readEnvFile(rootEnvPath, values);
  readEnvFile(middlewareEnvPath, values);
  return values;
}

async function promptSecret(label) {
  if (!process.stdin.isTTY) return "";

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const value = await rl.question(`${label}: `);
    return value.trim();
  } finally {
    rl.close();
  }
}

async function readWorkspaceApiKey(existing) {
  if (process.env.WORKSPACE_API_KEY) return process.env.WORKSPACE_API_KEY.trim();
  if (process.env.PARTNER_API_KEY) return process.env.PARTNER_API_KEY.trim();
  if (process.env.GROUNDX_API_KEY) return process.env.GROUNDX_API_KEY.trim();
  if (existing.get("GROUNDX_WORKSPACE_API_KEY")) return existing.get("GROUNDX_WORKSPACE_API_KEY");
  if (existing.get("GROUNDX_PARTNER_API_KEY")) return existing.get("GROUNDX_PARTNER_API_KEY");
  return promptSecret("Workspace API key for local middleware proxying");
}

async function readLlmApiKey(existing, llmService) {
  if (process.env.LLM_API_KEY) return process.env.LLM_API_KEY.trim();
  if (existing.get("LLM_API_KEY")) return existing.get("LLM_API_KEY");
  const normalizedService = llmService.trim().toLowerCase();
  if (normalizedService === "openai" && process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  if (normalizedService === "anthropic" && process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY.trim();
  return promptSecret("LLM API key for local middleware completions");
}

async function readLlmService(existing) {
  if (process.env.LLM_SERVICE) return process.env.LLM_SERVICE.trim();
  if (existing.get("LLM_SERVICE")) return existing.get("LLM_SERVICE");
  return promptSecret("LLM service/provider for local middleware completions");
}

async function readLlmModelId(existing) {
  if (process.env.LLM_MODEL_ID) return process.env.LLM_MODEL_ID.trim();
  if (existing.get("LLM_MODEL_ID")) return existing.get("LLM_MODEL_ID");
  return promptSecret("LLM model ID for local middleware completions");
}

function readAuthMode(existing) {
  const raw = process.env.APP_AUTH_MODE || process.env.SCAFFOLD_AUTH_MODEL || existing.get("APP_AUTH_MODE") || "customer";
  const authMode = raw.trim().toLowerCase();
  if (authMode === "customer" || authMode === "partner") return authMode;
  console.error("APP_AUTH_MODE must be either customer or partner.");
  console.error("Use APP_AUTH_MODE=partner only when the scaffold should include Partner auth and provisioning routes.");
  process.exit(1);
}

function normalizedIntakeValue(value) {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function readPrimarySurface(existing) {
  const raw = process.env.SCAFFOLD_PRIMARY_SURFACE || process.env.APP_PRIMARY_SURFACE || process.env.VITE_APP_PRIMARY_SURFACE || existing.get("APP_PRIMARY_SURFACE") || "dashboard";
  const normalized = normalizedIntakeValue(raw);
  if (normalized === "dashboard") return "dashboard";
  if (normalized === "chat-driven-viewer" || normalized === "chat-driven" || normalized === "chat-first") return "chat-driven-viewer";
  if (normalized === "single-workflow" || normalized === "workflow") return "single-workflow";
  console.error("SCAFFOLD_PRIMARY_SURFACE must be dashboard, chat-driven-viewer, or single-workflow.");
  process.exit(1);
}

function normalizeCapability(value) {
  const normalized = normalizedIntakeValue(value);
  if (normalized === "chat") return "chat";
  if (normalized === "extraction" || normalized === "extract") return "extraction";
  if (normalized === "reports" || normalized === "report" || normalized === "smart-reports") return "reports";
  if (normalized === "ingest" || normalized === "upload") return "ingest";
  if (normalized === "document-viewer" || normalized === "documents" || normalized === "viewer") return "document-viewer";
  return "";
}

function readCapabilities(existing) {
  const raw = process.env.SCAFFOLD_CAPABILITIES || process.env.APP_CAPABILITIES || process.env.VITE_APP_CAPABILITIES || existing.get("APP_CAPABILITIES") || "";
  const capabilities = new Set();
  for (const part of raw.split(",")) {
    if (!part.trim()) continue;
    const capability = normalizeCapability(part);
    if (!capability) {
      console.error("SCAFFOLD_CAPABILITIES may include chat, extraction, reports, ingest, and document-viewer only.");
      process.exit(1);
    }
    capabilities.add(capability);
  }
  return [...capabilities].join(",");
}

function readOnboardingEnabled(existing) {
  const raw = process.env.SCAFFOLD_ONBOARDING || process.env.APP_ONBOARDING_ENABLED || process.env.VITE_APP_ONBOARDING_ENABLED || existing.get("APP_ONBOARDING_ENABLED") || "false";
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return "true";
  if (["0", "false", "no", "off"].includes(normalized)) return "false";
  console.error("SCAFFOLD_ONBOARDING must be yes/no or true/false.");
  process.exit(1);
}

const existing = readExistingEnv();
const workspaceApiKey = await readWorkspaceApiKey(existing);
if (!workspaceApiKey) {
  console.error("WORKSPACE_API_KEY is required to configure the scaffolded middleware for real GroundX calls.");
  console.error("Aliases accepted: PARTNER_API_KEY or GROUNDX_API_KEY.");
  console.error("Run: WORKSPACE_API_KEY=... LLM_SERVICE=... LLM_MODEL_ID=... LLM_API_KEY=... npm run setup:env");
  process.exit(1);
}

const llmService = await readLlmService(existing);
if (!llmService) {
  console.error("LLM_SERVICE is required to configure the scaffolded middleware for real completions.");
  console.error("Run: WORKSPACE_API_KEY=... LLM_SERVICE=... LLM_MODEL_ID=... LLM_API_KEY=... npm run setup:env");
  process.exit(1);
}

const llmModelId = await readLlmModelId(existing);
if (!llmModelId) {
  console.error("LLM_MODEL_ID is required to configure the scaffolded middleware for real completions.");
  console.error("Run: WORKSPACE_API_KEY=... LLM_SERVICE=... LLM_MODEL_ID=... LLM_API_KEY=... npm run setup:env");
  process.exit(1);
}

const llmApiKey = await readLlmApiKey(existing, llmService);
if (!llmApiKey) {
  console.error("LLM_API_KEY is required to configure the scaffolded middleware for real completions.");
  console.error("If LLM_SERVICE=openai, OPENAI_API_KEY may be used. If LLM_SERVICE=anthropic, ANTHROPIC_API_KEY may be used.");
  console.error("Run: WORKSPACE_API_KEY=... LLM_SERVICE=... LLM_MODEL_ID=... LLM_API_KEY=... npm run setup:env");
  process.exit(1);
}
const authMode = readAuthMode(existing);
const primarySurface = readPrimarySurface(existing);
const capabilities = readCapabilities(existing);
const onboardingEnabled = readOnboardingEnabled(existing);

const envLines = [
    "NODE_ENV=development",
    "PORT=3001",
    "LOG_LEVEL=info",
    "ALLOWED_ORIGIN=http://localhost:5173",
    "MOCK_MODE=true",
    "APP_REPOSITORY_MODE=memory",
    `APP_AUTH_MODE=${authMode}`,
    `VITE_APP_AUTH_MODE=${authMode}`,
    `APP_PRIMARY_SURFACE=${primarySurface}`,
    `VITE_APP_PRIMARY_SURFACE=${primarySurface}`,
    `APP_CAPABILITIES=${capabilities}`,
    `VITE_APP_CAPABILITIES=${capabilities}`,
    `APP_ONBOARDING_ENABLED=${onboardingEnabled}`,
    `VITE_APP_ONBOARDING_ENABLED=${onboardingEnabled}`,
    `SESSION_SECRET=${randomBytes(32).toString("hex")}`,
    "GROUNDX_BASE_URL=https://api.groundx.ai/api/v1",
    `GROUNDX_WORKSPACE_API_KEY=${workspaceApiKey}`,
    `GROUNDX_PARTNER_API_KEY=${workspaceApiKey}`,
    "GROUNDX_ANON_API_KEY=",
    `LLM_SERVICE=${llmService}`,
    "LLM_BASE_URL=https://api.openai.com/v1",
    `LLM_API_KEY=${llmApiKey}`,
    "LLM_AUTH_HEADER_NAME=Authorization",
    "LLM_AUTH_SCHEME=Bearer",
    `LLM_MODEL_ID=${llmModelId}`,
    "",
  ].join("\n");

mkdirSync(dirname(middlewareEnvPath), { recursive: true });
writeFileSync(rootEnvPath, envLines, { mode: 0o600 });
writeFileSync(middlewareEnvPath, envLines, { mode: 0o600 });

console.log("Wrote .env.local and middleware/.env.local for local development. Both files are ignored by git.");
