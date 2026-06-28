#!/usr/bin/env node
// Deploy dist/ to a gh-pages branch via the GitHub Git Database REST API.
//
// Avoids the `workflow` OAuth scope (needed only for .github/workflows): gh-pages
// is plain static content. Run after `npm run build`. Requires gh CLI (repo scope).
//
// Usage: GH_FORCE_TTY=0 node scripts/deploy_ghpages_api.mjs
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const REPO = "rance1230/earth-wind-globe";
const DIST = path.resolve("dist");
const BRANCH = "gh-pages";

// gh returns raw JSON when --jq is used and TTY is off. Strip any stray ANSI.
function ghJson(args, input) {
  const env = { ...process.env, GH_FORCE_TTY: "0", NO_COLOR: "1", CLICOLOR: "0", CLICOLOR_FORCE: "0" };
  let out = execSync(`gh api ${args} --jq '.'`, {
    input: input ? Buffer.from(input) : undefined,
    encoding: "utf8",
    env,
    maxBuffer: 200 * 1024 * 1024,
  });
  // Strip ANSI escape sequences if any leaked through.
  out = out.replace(/\u001b\[[0-9;]*m/g, "");
  return out.trim() ? JSON.parse(out) : null;
}
function ghRaw(args, input) {
  const env = { ...process.env, GH_FORCE_TTY: "0", NO_COLOR: "1", CLICOLOR: "0" };
  return execSync(`gh api ${args}`, {
    input: input ? Buffer.from(input) : undefined,
    encoding: "utf8",
    env,
    maxBuffer: 200 * 1024 * 1024,
  });
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(DIST);
console.log(`dist: ${files.length} files`);

const treeEntries = [];
for (const f of files) {
  const rel = path.relative(DIST, f).split(path.sep).join("/");
  const b64 = fs.readFileSync(f).toString("base64");
  const blob = ghJson(`repos/${REPO}/git/blobs -f encoding=base64 --input -`, JSON.stringify({ content: b64 }));
  treeEntries.push({ path: rel, mode: "100644", type: "blob", sha: blob.sha });
  if (treeEntries.length % 5 === 0) console.log(`  ${treeEntries.length}/${files.length} blobs`);
}
console.log(`  ${treeEntries.length} blobs done`);

const tree = ghJson(`repos/${REPO}/git/trees --input -`, JSON.stringify({ tree: treeEntries }));
console.log(`tree ${tree.sha}`);

const commit = ghJson(
  `repos/${REPO}/git/commits --input -`,
  JSON.stringify({ message: "deploy gh-pages (dist build)", tree: tree.sha, parents: [] })
);
console.log(`commit ${commit.sha}`);

let refExists = true;
try {
  ghRaw(`repos/${REPO}/git/refs/heads/${BRANCH}`);
} catch {
  refExists = false;
}
if (refExists) {
  ghJson(`repos/${REPO}/git/refs/heads/${BRANCH} -X PATCH --input -`, JSON.stringify({ sha: commit.sha, force: true }));
  console.log(`updated refs/heads/${BRANCH}`);
} else {
  ghJson(`repos/${REPO}/git/refs --input -`, JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha: commit.sha }));
  console.log(`created refs/heads/${BRANCH}`);
}
console.log("done: gh-pages deployed");
