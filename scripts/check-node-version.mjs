#!/usr/bin/env node

const requiredMajor = 20;
const current = process.versions.node;
const major = Number(current.split(".")[0]);

if (!Number.isFinite(major) || major < requiredMajor) {
  console.error(`GroundX web UI scaffold requires Node.js ${requiredMajor} or newer. Current version: ${current}.`);
  console.error("Install a current Node.js LTS release, then rerun npm install.");
  process.exit(1);
}
