---
name: "adherence-and-feedback"
description: "Two local-host capabilities this fork adds: a hard design-system adherence gate that blocks bound projects from using anything outside the system, and an element-annotation overlay for pinning comments onto a live preview. Both are plain node scripts under agents/."
---
# Adherence gate & element feedback

This fork adds two host-side capabilities the upstream skill assumes but does not ship: a **hard adherence gate** (so a bound design system is enforced, not advisory) and an **element-annotation overlay** (so the user can pin comments onto a preview and the agent applies them). Both are dependency-free node scripts in this skill's `agents/`.

## Adherence gate — `agents/check-adherence.mjs`

A project **bound** to a design system (it has `_d_meta.json` with a non-empty `designSystems` list and an imported `_ds/<slug>/` copy) may use **only** what the system provides. The gate flags, per `file:line`:

- raw colors — hex, `rgb()/rgba()/hsl()/hsla()/oklch()/oklab()/lab()/lch()`;
- raw `border-radius`, `box-shadow`, `font-family`, `font-size` literals (must be `var(--*)`);
- `var(--*)` referencing a token not declared in the bound system's manifest;
- hand-rolled `<button>`, `<input>`, `<select>`, `<textarea>` (must come from the system's components).

Pure layout geometry (`margin`/`padding`/`gap`/`width`/`height` in px) is left free. **Unbound projects are not checked** — binding a system is how a project opts into strict mode. Detection is regex/line-based (not a full CSS/JSX parser), and component enforcement covers the four raw interactive tags, not styled-div lookalikes.

The rule it enforces for you, the agent: **to use a new element or value, add it to the design system first** (a token or a component), recompile with `compile-design-system.mjs`, then reference it in the project. Never hardcode a value or hand-roll an element to "get it working".

Run it standalone (exit 1 on violations) before finishing any bound project:

```bash
node <skill>/agents/check-adherence.mjs           # scans ./designs by default
node <skill>/agents/check-adherence.mjs --root designs
```

### Wire it as a blocking Stop hook (recommended)

Add this to the consuming project's `.claude/settings.json` so the agent cannot finish while a bound project has violations (point the command at wherever this skill is installed — the script resolves `designs/` against the project cwd, so the script's own location doesn't matter):

```json
{
  "hooks": {
    "Stop": [
      { "hooks": [ { "type": "command", "command": "node <path-to-skill>/agents/check-adherence.mjs --hook" } ] }
    ]
  }
}
```

In `--hook` mode the script emits `{"decision":"block","reason":…}` (with the violation list) while any bound project is dirty, and stays silent (exit 0) when clean or when no project is bound. Newly added hooks take effect on the next Claude Code session.

## Element feedback — `agents/annotate/`

A static preview can't capture "change *this* element". The annotate server serves a design directory, injects an overlay into every HTML page, and persists pinned comments to `annotations.json` next to the page.

```bash
node <skill>/agents/annotate/server.mjs --root designs --port 4311
# then open http://localhost:4311/<project>/<file>.html
```

The overlay adds a floating **Annotate** toggle. In annotate mode the block under the cursor is highlighted; clicking it opens a comment box; saved comments render as numbered pins (click a pin to view or delete). Each comment is stored with a CSS selector, a DOM ancestry chain, and a text snippet — the same shape the upstream "Review context" section expects.

To act on feedback: read `designs/<project>/annotations.json`, locate each element by its `selector` (fall back to the `domPath`/`snippet` if the page changed), apply the requested edit to the source, and delete the resolved annotation (`DELETE /__annotations?page=<page>&id=<id>`, or remove it from the file) so its pin clears.
