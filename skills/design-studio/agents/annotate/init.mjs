#!/usr/bin/env node
// Drop the design-studio skill into a consuming project (run after installing this
// package as a devDependency), so the project's own agent can use it, and print the
// dev-only snippet that loads the annotate picker on top of the running app.
//
//   node init.mjs [--dest .claude/skills] [--port 4311]
//
// Copies skills/design-studio/ → <dest>/design-studio/ in the current project.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_SRC = path.resolve(HERE, "..", ".."); // skills/design-studio

function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const DEST_ROOT = path.resolve(process.cwd(), arg("--dest", ".claude/skills"));
const PORT = arg("--port", "4311");
const dest = path.join(DEST_ROOT, "design-studio");

fs.mkdirSync(DEST_ROOT, { recursive: true });
fs.cpSync(SKILL_SRC, dest, {
  recursive: true,
  filter: (src) => {
    const base = path.basename(src);
    return base !== "node_modules" && base !== ".git";
  },
});

console.log(`✓ design-studio skill → ${path.relative(process.cwd(), dest)}`);
console.log("");
console.log("To pin code/design comments on the running app, start the picker server:");
console.log(`  npx design-annotate --store .annotate/annotations.json --port ${PORT}`);
console.log("");
console.log("…and load the overlay in your app, in development only:");
console.log(`  <script>window.__ANNOTATE_BASE="http://localhost:${PORT}";</script>`);
console.log(`  <script src="http://localhost:${PORT}/__annotate/overlay.js"></script>`);
console.log("");
console.log("Then turn pins into specs:");
console.log("  npx design-specs --store .annotate/annotations.json --out .");
