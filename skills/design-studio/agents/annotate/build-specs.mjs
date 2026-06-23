#!/usr/bin/env node
// Turn pinned annotations into two specs — one per stream.
//
// Every pin carries a `kind`: "design" (the design agent edits the mockup, including
// mockup-level behavior like hover/states/transitions) or "code" (the coding agent
// changes the real codebase, using the pin only as a visual reference). This splits
// all collected pins by kind and writes:
//   - design-spec.md  — for the design agent
//   - code-spec.md    — for the coding agent
// A stream with no pins produces no file.
//
//   node build-specs.mjs [--root designs] [--store FILE] [--out DIR]
//
// It reads every annotations.json under --root (mockup mode) and, if given, the single
// --store FILE (app mode). --out defaults to the current directory.

import fs from "node:fs";
import path from "node:path";

function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const ROOT = path.resolve(arg("--root", "designs"));
const STORE = arg("--store", "");
const OUT = path.resolve(arg("--out", "."));

const SKIP_DIRS = new Set(["_ds", "node_modules", ".git"]);

const DESIGN_INTRO =
  "Each item is a comment pinned on a mockup element. Apply it as a change to that " +
  "page's design — visual, or mockup-level behavior (hover, states, transitions). " +
  "Locate the element by its selector; fall back to the DOM path / element text if the " +
  "page changed.";

const CODE_INTRO =
  "Each item is a comment pinned on a mockup element, but the work belongs in the real " +
  "codebase, not the mockup. Treat the mockup as the visual reference and implement the " +
  "described structural or behavioral change in the app's own components, following its " +
  "existing patterns. See handoff-to-claude-code.md for how to frame a full handoff.";

// --- collection ---------------------------------------------------------------

function walk(dir, onFile) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), onFile);
    } else {
      onFile(path.join(dir, e.name));
    }
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function normalize(arr, fallbackPage, into) {
  if (!Array.isArray(arr)) return;
  for (const a of arr) {
    if (!a || !a.text) continue;
    into.push({
      page: a.page || fallbackPage,
      selector: a.selector || "",
      domPath: Array.isArray(a.domPath) ? a.domPath : [],
      snippet: a.snippet || "",
      kind: a.kind === "code" ? "code" : "design",
      text: a.text,
    });
  }
}

function collect() {
  const items = [];
  // Mockup mode: every per-directory annotations.json.
  walk(ROOT, (file) => {
    if (path.basename(file) !== "annotations.json") return;
    const rel = path.relative(ROOT, path.dirname(file)).split(path.sep).join("/");
    normalize(readJson(file), "/" + rel, items);
  });
  // App mode: the single shared store, if any pins lack a page they get "".
  if (STORE) normalize(readJson(path.resolve(STORE)), "", items);
  return items;
}

// --- rendering ----------------------------------------------------------------

function renderSpec(title, intro, items) {
  const pages = new Map();
  for (const it of items) {
    if (!pages.has(it.page)) pages.set(it.page, []);
    pages.get(it.page).push(it);
  }
  const out = [`# ${title}`, "", intro, ""];
  let n = 0;
  for (const [page, list] of pages) {
    out.push(`## ${page || "(unkeyed)"}`, "");
    for (const it of list) {
      n++;
      out.push(`### ${n}. \`${it.selector || "(no selector)"}\``);
      if (it.domPath.length) out.push(`- DOM: ${it.domPath.join(" › ")}`);
      if (it.snippet) out.push(`- Element text: "${it.snippet}"`);
      out.push(`- Change: ${it.text}`, "");
    }
  }
  return out.join("\n");
}

// --- run ----------------------------------------------------------------------

function main() {
  const items = collect();
  const streams = [
    { kind: "design", file: "design-spec.md", title: "Design spec", intro: DESIGN_INTRO },
    { kind: "code", file: "code-spec.md", title: "Code spec", intro: CODE_INTRO },
  ];

  fs.mkdirSync(OUT, { recursive: true });
  const written = [];
  for (const s of streams) {
    const list = items.filter((i) => i.kind === s.kind);
    if (!list.length) continue;
    fs.writeFileSync(path.join(OUT, s.file), renderSpec(s.title, s.intro, list) + "\n");
    written.push(`${s.file} (${list.length})`);
  }

  if (!written.length) {
    console.log("build-specs: no annotations found.");
    process.exit(0);
  }
  console.log(`✓ wrote ${written.join(", ")} → ${OUT}`);
  process.exit(0);
}

main();
