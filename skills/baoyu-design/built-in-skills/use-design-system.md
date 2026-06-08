---
name: "use-design-system"
description: "Consume an existing design system from a regular design project — discover available systems, import a compiled copy into _ds/<slug>/, wire it up, seed a starting point, and record the binding in meta.json."
---
# Using a design system in a project

Use this guide when you're building a **regular design project** (a mockup, prototype, deck, app screens — anything that is *not itself* a design system) and want it to follow one or more existing design systems. It is the consumer-side companion to [`design-system-authoring-guide.md`](design-system-authoring-guide.md) (which covers the other direction — *authoring* the system you import here).

The mechanism mirrors the authoring pipeline: instead of scattering copied assets, you sync a **self-contained, version-pinned copy** of each design system into `<project>/_ds/<slug>/` with a script, wire it into your HTML, and record the binding in `<project>/meta.json`. Re-running the script later is how you pull updates.

## How projects and design systems are distinguished on disk

Everything lives flat under `designs/`. The two kinds are told apart by a marker file, not by folder name:

- **A design system** has `_ds_manifest.json` at its **root** — `designs/<ds>/_ds_manifest.json` (the compiler writes it there). It is self-describing; it does **not** carry a `meta.json`.
- **A regular project** has `meta.json` at its root, plus — for each system it consumes — a `designs/<project>/_ds/<slug>/` folder whose own `_ds_manifest.json` sits **one level deeper**.

So `glob designs/*/_ds_manifest.json` matches **only authored design systems**, never a consumed copy (those live at `designs/*/_ds/*/_ds_manifest.json`). This holds even when a project consumes several systems.

A design system's `SKILL.md` makes the folder portable (downloadable as an Agent Skill), but in *this* repo it is **not registered as a skill** — treat it as a portable artifact plus a human-readable description, and discover it by globbing the manifest (below), not by invoking a skill.

## The consume flow

### 1. Discover available design systems

Run `glob designs/*/_ds_manifest.json`. For each hit, read enough to describe it in a question:
- `namespace`, `components`, `startingPoints`, and `cards` from `_ds_manifest.json`;
- the first heading / opening paragraph of the sibling `README.md` for a human description.

Don't maintain an index file — discovery is always this glob, on demand.

### 2. Ask where to save and which system(s) to use

Before building, confirm with your harness's Ask-Question tool (Claude Code: `AskUserQuestion`):

1. **Where to save** — default `designs/<descriptive-slug>/`; allow a custom location.
2. **Which design system(s)** — list what discovery found, **multiSelect** so the user can pick **none** (free design), **one**, or **several**. With several selected, the **first selection** is the primary by default; confirm if they want a different primary.
3. **(Optional) A starting point** — if a chosen system exposes `startingPoints[]`, offer them as seeds; otherwise offer its `cards[]` as reference or let the user design from scratch.

If the user picks no design system, skip the rest of this flow (steps 3–7) and design normally — no `_ds/` folder, `designSystems: []`, `primaryDesignSystem: null`. You **still** get a `meta.json`: `record-asset.mjs` creates it (with `type`/`createdAt`/`updatedAt`) the first time you record a deliverable as an asset — see ["Recording deliverables as assets"](#recording-deliverables-as-assets) below.

### 3. Import each selected design system

For **each** selected system, run the sync script (a plain `node` call, like the compiler/checker):

```
node <skill>/agents/import-design-system.mjs <dsDir> <projectDir> [--primary]
```

`<skill>` is this skill's directory; `<dsDir>` is the design-system folder (e.g. `designs/fluent2-design-system`); `<projectDir>` is your project folder. Pass `--primary` for the system the user chose as primary (otherwise the **first** system imported auto-claims the primary slot, and later imports leave it untouched).

The script reuses the read-only parser, so the copy set is exact and deterministic. It copies into `<projectDir>/_ds/<slug>/` (slug = the DS folder's basename), preserving relative paths:

- the global-CSS `@import` closure (every CSS file the entry transitively imports);
- every local `url(...)` target in those CSS files (font binaries + images);
- `_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json`, `README.md`;
- the DS's `assets/` directory, if present.

It writes **only** `_ds/<slug>/` and `meta.json` — never the DS source, and it does not transpile (that stays with `compile-design-system.mjs`). It then prints the namespace, the exact `<link>`/`<script>` wiring lines, any starting points, and warnings (e.g. a missing bundle means the DS was never compiled — compile it first, then re-import).

### 4. Wire it into your page

For **each** consumed system, add its global-CSS entry and (if you render components) its bundle. Use the wiring lines the script printed:

```html
<!-- non-primary systems first -->
<link rel="stylesheet" href="_ds/<other-slug>/styles.css">
<!-- PRIMARY system's <link> LAST so its tokens win on collision -->
<link rel="stylesheet" href="_ds/<primary-slug>/styles.css">

<script src="_ds/<slug>/_ds_bundle.js"></script>
```

Then pull components from each system's own namespace — `const { Button } = window.<Namespace>;`. Namespaces are unique per system, so JS/component scopes never collide. Global **CSS** is shared scope, though: order the `<link>`s so the **primary system loads last** and wins on same-named tokens (see "Multiple design systems" below).

### 5. Seed a starting point (optional)

If the user chose a starting point, seed it from the DS copy (the script doesn't do this — you do, after import):

- **Screen** — copy `<dsDir>/<startingPoint.path>` to the **project root** as the seed page, then rewrite its `<script src=…_ds_bundle.js>` → `_ds/<slug>/_ds_bundle.js` and its `<link href=…styles.css>` → `_ds/<slug>/styles.css`. The body's `window.<Namespace>.*` references are already portable.
- **Component** — don't copy a file; render `<Name>` directly from `window.<Namespace>` (the bundle must be loaded). The source at `<dsDir>/<startingPoint.path>` is there if you want to read it for reference.

Record the choice in `meta.json.startingPoint` (with `dsSlug` so it's clear which system it came from).

### 6. Record the binding in meta.json

The script writes/merges `<project>/meta.json` for you. Shape:

```json
{
  "type": "design",
  "title": "Tweet App",
  "prompt": "<the original request>",
  "designSystems": [
    {
      "name": "Fluent 2 Design System",
      "slug": "fluent2-design-system",
      "namespace": "Fluent2DesignSystem_1aab38",
      "dsFolder": "_ds/fluent2-design-system",
      "sourcePath": "designs/fluent2-design-system"
    }
  ],
  "primaryDesignSystem": "fluent2-design-system",
  "startingPoint": { "name": "...", "kind": "screen|component", "dsSlug": "...", "section": "..." },
  "assets": {
    "Tweet Composer": {
      "versions": [
        { "path": "Tweet Composer.html", "createdAt": "<ISO>", "status": "needs-review", "subtitle": "Compose + thread view", "viewport": { "width": 1340, "height": 872 } }
      ]
    }
  },
  "createdAt": "<ISO>",
  "updatedAt": "<ISO>"
}
```

- `designSystems` is an **array** (0..N). No system → `[]` and `primaryDesignSystem: null`.
- `primaryDesignSystem` points at one entry's `slug`, independent of array order. It decides CSS precedence (its `<link>` loads last), the default target for "update / add a component", and records the project's main visual language.
- `assets` records the project's **UI entry points** (the HTML pages / `.dc.html` components you'd show the user) — a map keyed by display name, each with a `versions[]` list. It is **independent of `designSystems`** and present even when no design system is used. Each version is `{ path, createdAt, status, subtitle?, viewport?{width,height?}, chatId?, section? }`, with `path` project-relative and `status ∈ needs-review|approved|changes-requested`. Don't hand-write this — `record-asset.mjs` maintains it (see "Recording deliverables as assets" below).
- The script merges — it preserves orchestrator-written fields (`title`, `prompt`, `startingPoint`, `assets`, …), sets `type:"design"` if absent, sets `createdAt` once, and bumps `updatedAt` each run. Add `title`/`prompt`/`startingPoint` yourself when creating the project.

### 7. (Optional) Sanity-check the copy

You can run the read-only checker against a consumed copy to confirm it's loadable:

```
node <skill>/agents/check-design-system.mjs <projectDir>/_ds/<slug>
```

**Expect "Components: (none)" and "Starting points: (none)" here** — and that's fine. A consumed copy ships the compiled `_ds_bundle.js`, not the source `.jsx`/`.d.ts`, so the checker (which discovers components from source) finds none. What it *does* confirm is that the global-CSS `@import` closure resolves and the tokens are present. A clean exit (0) means the copy is wired correctly; to re-validate components, run the checker against the DS **source** instead.

## Recording deliverables as assets

`meta.json` also indexes the project's **deliverables** — the HTML pages and `.dc.html` components you'd actually show the user — under `assets` (shape in step 6 above). This is **independent of design systems**: every project has deliverables, so it applies even to a project that imported no system. Don't hand-edit `assets`; the `record-asset.mjs` helper maintains it — and it **bootstraps `meta.json` itself** when the project has none yet (the no-design-system case):

```
node <skill>/agents/record-asset.mjs <projectDir> <htmlPath> [flags]
```

`<htmlPath>` is the deliverable, project-relative (e.g. `Welcome.html`); an absolute or `<projectDir>`-prefixed path is normalized to project-relative POSIX for you. Flags:

- `--name "<display name>"` — the asset's key. Omit to derive it from the filename (`Welcome.html` → `Welcome`, `Card.dc.html` → `Card`).
- `--inherit-from <existingPath>` — group this file under the asset that already owns `<existingPath>` (use for a new *version* of an existing deliverable). Resolved to a name before the filename fallback.
- `--subtitle "<text>"`; `--width <n>` / `--height <n>` (viewport — `--height` requires `--width`); `--section "<text>"`.
- `--status needs-review|approved|changes-requested` — defaults to `needs-review`.
- `--chat-id <id>` — optional; normally omitted in Claude Code (no chat-id surface), kept for app-hub parity.

**Record vs. update.** Each asset owns an ordered `versions[]`. Re-recording a `path` that's **already** under that asset **updates it in place** (status is rewritten; supplied subtitle/viewport/section overwrite; `createdAt` is preserved). A path **not** yet present **appends** a new version with a fresh `createdAt`. So a redesign saved as a new file becomes a new version; re-touching the same file is an in-place update.

**Status lifecycle.** Record at `needs-review` (the default) when you create the deliverable. After the user reviews it, re-record the **same** path with `--status approved` or `--status changes-requested` to flip the status in place.

**Unrecord** — when a deliverable is deleted or renamed, drop it:

```
node <skill>/agents/record-asset.mjs <projectDir> --remove [<htmlPath>] [--name "<n>"] [--path <relPath>]
```

A path removes that one version (scoped to `--name` if also given); `--name` alone removes the whole asset. An asset whose last version is removed is deleted, and `assets` is dropped entirely once empty. Running `--remove` against a missing `meta.json` is a no-op — it won't create an empty file.

## Updating a project later

Read `meta.json` to recover which systems the project uses, then:

- **Refresh a system** — re-run the import script for that `<dsDir>`. It overwrites `_ds/<slug>/` in place and updates only that entry in `designSystems[]` (idempotent: no duplicates, other entries and `createdAt`/`title`/`prompt` untouched).
- **Add a system** — run the script for the new `<dsDir>`; it appends to `designSystems[]`. Add `--primary` if it should become primary.
- **Remove a system** — delete its `_ds/<slug>/` folder, its entry in `designSystems[]`, and its `<link>`/`<script>` lines. If it was primary, repoint `primaryDesignSystem` to a remaining slug (or `null`).
- **Change primary** — re-run the script for the target with `--primary` (or edit `primaryDesignSystem`), and move that system's `<link>` to load last.

## Multiple design systems

A project may consume several systems at once. Each `_ds/<slug>/_ds_bundle.js` is namespaced, so JavaScript and components never collide. The one shared surface is **global CSS**: every system's `:root` tokens and base rules land in the same scope, so a later `<link>` overrides an earlier one's same-named variables. Mitigations, in order of preference:

1. Treat one system as **primary** (its `<link>` last, its tokens win) and pull only specific *components* from the others.
2. If two systems must fully coexist and genuinely conflict, scope one copy's CSS — out of scope for the import script; do it by hand only if needed.

`<link>` order is the precedence control, and the orchestrator owns that order at wiring time.
