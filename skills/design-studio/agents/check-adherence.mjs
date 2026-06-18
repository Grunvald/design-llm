#!/usr/bin/env node
// Design-system adherence gate.
//
// Enforces that any design project BOUND to a design system (it has a
// _d_meta.json with a non-empty designSystems list and an imported _ds/<slug>/
// copy) may only use what the system provides:
//   - colors, border-radius, box-shadow, font-family, font-size must be a
//     design-system token via var(--*) — no raw hex/rgb/hsl/oklch, no raw radius
//     /shadow/font literals;
//   - every var(--*) must resolve to a token the system actually declares;
//   - interactive elements (button/input/select/textarea) must come from the
//     system's components, not be hand-rolled.
// Pure layout geometry (margin/padding/gap/width/height in px) is left free.
//
// The rule it implements for the agent: to add a new element or value, add it to
// the design system first (a token or a component), recompile, then use it.
//
// Modes:
//   node tools/ds-gate/check-adherence.mjs            # report + exit 1 on violations
//   node tools/ds-gate/check-adherence.mjs --hook     # Stop-hook: emit a block decision
//
// Unbound projects (no design system) are NOT checked — binding a system is how a
// project opts into strict mode.

import fs from "node:fs";
import path from "node:path";

const HOOK = process.argv.includes("--hook");
const ROOT = (() => {
  const i = process.argv.indexOf("--root");
  return path.resolve(i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : "designs");
})();

const SKIP_DIRS = new Set(["_ds", "node_modules", ".git"]);
const SCAN_EXT = new Set([".html", ".htm", ".jsx", ".tsx", ".js", ".css"]);
const KEYWORDS = new Set(["none", "inherit", "initial", "unset", "transparent", "currentcolor", "0", "auto"]);

// --- discovery ----------------------------------------------------------------

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

// A bound project = a directory with _d_meta.json whose designSystems is non-empty.
function findBoundProjects(root) {
  const out = [];
  let dirs;
  try {
    dirs = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const dir = path.join(root, d.name);
    const meta = readJson(path.join(dir, "_d_meta.json"));
    if (meta && Array.isArray(meta.designSystems) && meta.designSystems.length) {
      out.push(dir);
    }
  }
  return out;
}

// Token allowlist for a project = every token declared by each imported system.
function allowedTokens(projectDir) {
  const allowed = new Set();
  walk(path.join(projectDir, "_ds"), (file) => {
    if (path.basename(file) !== "_ds_manifest.json") return;
    const manifest = readJson(file);
    if (manifest && Array.isArray(manifest.tokens)) {
      for (const t of manifest.tokens) {
        const name = typeof t === "string" ? t : t && t.name;
        if (name) allowed.add(name);
      }
    }
  });
  return allowed;
}

// A project file authored by us (not the imported system copy, not metadata).
function deliverableFiles(projectDir) {
  const files = [];
  walk(projectDir, (file) => {
    const base = path.basename(file);
    if (base.startsWith("_d") || base === "annotations.json") return; // _d_meta / _ds_* / annotations
    if (SCAN_EXT.has(path.extname(file).toLowerCase())) files.push(file);
  });
  return files;
}

// --- detectors ----------------------------------------------------------------

const RE_VAR = /var\(\s*(--[A-Za-z0-9_-]+)/g;
const RE_HEX = /#[0-9a-fA-F]{3,8}\b/g;
const RE_COLOR_FN = /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\s*\(/gi;
const RE_RAW_EL = /<\s*(button|input|select|textarea)\b/gi;
// CSS form (kebab) and JSX inline-style form (camel).
const RE_CSS_PROP = /(?:^|[;{}\s])(border-radius|box-shadow|font-family|font-size)\s*:\s*([^;}\n]+)/gi;
const RE_JSX_PROP = /\b(borderRadius|boxShadow|fontFamily|fontSize)\s*:\s*([^,}\n]+)/g;

// CSS: a bare value (Inter, 12px, 0 2px 8px …) is a literal — only var()/keyword passes.
function valueOkCss(raw) {
  const v = raw.trim().replace(/[!;]+$/g, "").trim();
  if (v.includes("var(")) return true;
  return KEYWORDS.has(v.replace(/^['"]|['"]$/g, "").trim().toLowerCase());
}

// JSX inline style: a bare identifier/member is a runtime expression — can't judge,
// allow it; only quoted-string and numeric literals are flaggable.
function valueOkJsx(raw) {
  const v = raw.trim();
  if (v.includes("var(")) return true;
  if (KEYWORDS.has(v.replace(/^['"]|['"]$/g, "").trim().toLowerCase())) return true;
  const isStringLit = /^['"].*['"]$/.test(v);
  const isNumber = /^-?\d/.test(v);
  return !isStringLit && !isNumber;
}

function scanFile(file, allowed, projectDir) {
  const rel = path.relative(projectDir, file);
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const lines = text.split(/\r?\n/);
  const v = [];
  const add = (ln, msg) => v.push({ file: rel, line: ln + 1, msg });

  lines.forEach((line, ln) => {
    let m;

    RE_VAR.lastIndex = 0;
    while ((m = RE_VAR.exec(line))) {
      if (!allowed.has(m[1])) add(ln, `var(${m[1]}) — token not declared in the design system`);
    }

    RE_HEX.lastIndex = 0;
    while ((m = RE_HEX.exec(line))) {
      add(ln, `raw color "${m[0]}" — use a design-system color token via var(--*)`);
    }
    RE_COLOR_FN.lastIndex = 0;
    while ((m = RE_COLOR_FN.exec(line))) {
      add(ln, `raw color "${m[0].trim()}…)" — use a design-system color token via var(--*)`);
    }

    RE_CSS_PROP.lastIndex = 0;
    while ((m = RE_CSS_PROP.exec(line))) {
      if (!valueOkCss(m[2])) add(ln, `raw ${m[1]} "${m[2].trim()}" — must be a design-system token via var(--*)`);
    }
    RE_JSX_PROP.lastIndex = 0;
    while ((m = RE_JSX_PROP.exec(line))) {
      if (!valueOkJsx(m[2])) add(ln, `raw ${m[1]} "${m[2].trim()}" — must be a design-system token via var(--*)`);
    }

    RE_RAW_EL.lastIndex = 0;
    while ((m = RE_RAW_EL.exec(line))) {
      add(ln, `raw <${m[1]}> — add the element to the design system, then use its component`);
    }
  });

  // de-dupe identical (line, msg)
  const seen = new Set();
  return v.filter((x) => {
    const k = x.line + "|" + x.msg;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// --- run ----------------------------------------------------------------------

function collect() {
  const projects = findBoundProjects(ROOT);
  const byProject = [];
  for (const dir of projects) {
    const allowed = allowedTokens(dir);
    const violations = [];
    for (const f of deliverableFiles(dir)) violations.push(...scanFile(f, allowed, dir));
    if (violations.length) byProject.push({ project: path.relative(ROOT, dir) || ".", violations });
  }
  return byProject;
}

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

function main() {
  const input = HOOK ? readStdin() : {};
  let results;
  try {
    results = collect();
  } catch (e) {
    // Tooling crash: surface it. Block once, but don't wedge a continuation pass.
    if (HOOK && !input.stop_hook_active) {
      process.stdout.write(JSON.stringify({ decision: "block", reason: `ds-gate crashed: ${e.message}` }));
    } else {
      process.stderr.write(`ds-gate error: ${e.stack || e}\n`);
    }
    process.exit(HOOK ? 0 : 1);
  }

  const total = results.reduce((n, p) => n + p.violations.length, 0);

  if (HOOK) {
    if (total === 0) process.exit(0); // clean → allow stop
    const lines = [];
    for (const p of results) {
      lines.push(`Design-system gate — project "${p.project}" has ${p.violations.length} adherence violation(s):`);
      for (const x of p.violations.slice(0, 40)) lines.push(`  ${x.file}:${x.line}  ${x.msg}`);
      if (p.violations.length > 40) lines.push(`  …and ${p.violations.length - 40} more`);
    }
    lines.push("");
    lines.push("This project is bound to a design system, so it may only use system tokens and components.");
    lines.push("To resolve: add the missing token/component to the design system, recompile it, then reference it here. Do not hardcode values or hand-roll elements. Fix every line above before finishing.");
    process.stdout.write(JSON.stringify({ decision: "block", reason: lines.join("\n") }));
    process.exit(0);
  }

  // CLI report
  if (total === 0) {
    const n = findBoundProjects(ROOT).length;
    console.log(n ? `✓ ds-gate: ${n} bound project(s), no violations.` : "ds-gate: no bound projects to check.");
    process.exit(0);
  }
  for (const p of results) {
    console.log(`\n✗ ${p.project} — ${p.violations.length} violation(s):`);
    for (const x of p.violations) console.log(`  ${x.file}:${x.line}  ${x.msg}`);
  }
  console.log(`\n${total} violation(s). A bound project may only use design-system tokens and components.`);
  process.exit(1);
}

main();
