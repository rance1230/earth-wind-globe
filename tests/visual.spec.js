import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "README.md",
  "PLAN.md",
  "NEXT_AGENT_PROMPT.md",
  "TRANSFER_STATUS.md",
  "package.json",
  "vite.config.js",
  "index.html",
  "src/main.js",
  "src/config.js",
  "src/scene/EarthScene.js"
];

const missing = requiredFiles.filter((file) => !existsSync(file));
if (missing.length) {
  console.error(`Missing required handoff files: ${missing.join(", ")}`);
  process.exit(1);
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
for (const script of ["dev", "build", "preview", "test:visual"]) {
  if (!packageJson.scripts?.[script]) {
    console.error(`Missing package script: ${script}`);
    process.exit(1);
  }
}

console.log("Handoff visual placeholder check passed.");
console.log("Full Playwright pixel checks are pending V1 implementation; see TRANSFER_STATUS.md.");
