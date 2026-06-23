#!/usr/bin/env node
// Annotate dev server: serves a design directory statically, injects the annotation
// overlay into every HTML page, and persists comments to annotations.json next to the
// page. The agent reads those files and applies the requested edits.
//
//   node tools/annotate/server.mjs [--root designs] [--port 4311] [--store FILE]
//
// Then open http://localhost:<port>/<project>/<file>.html and click "Annotate".
//
// Two surfaces, one annotation shape (each pin carries its own `page` and `kind`):
//   - Mockup mode (default): pins persist to annotations.json in the served page's
//     directory, as before.
//   - App mode (--store FILE): the overlay is loaded into a real running app from a
//     different origin (CORS is enabled); all pins persist to the single FILE, keyed
//     by each pin's `page`. build-specs.mjs turns either store into design/code specs.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const ROOT = path.resolve(arg("--root", "designs"));
const PORT = parseInt(arg("--port", "4311"), 10);
const OVERLAY = path.join(HERE, "overlay.js");
const STORE_ARG = arg("--store", "");
const STORE = STORE_ARG ? path.resolve(STORE_ARG) : null; // app mode: one shared file

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".jsx": "text/babel; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const INJECT = (page) =>
  `\n<script>window.__ANNOTATE_PAGE=${JSON.stringify(page)};</script>` +
  `\n<script src="/__annotate/overlay.js"></script>\n`;

// Mockup mode: annotations.json lives in the same directory as the page being
// annotated. App mode (--store): all pages share one file, keyed by each pin's page.
// Returns null if the page (an attacker-controllable query param, reachable
// cross-origin via CORS) would escape ROOT — the handler then rejects it.
function storeFor(page) {
  if (STORE) return STORE;
  const dir = path.dirname(page).replace(/^\/+/, "");
  const file = path.resolve(ROOT, dir, "annotations.json");
  if (!file.startsWith(ROOT + path.sep)) return null;
  return file;
}

function readStore(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

function writeStore(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS: the real-app dev widget loads the overlay and posts pins from a different
  // origin (e.g. the app's own dev server).
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // Overlay script.
  if (url.pathname === "/__annotate/overlay.js") {
    res.writeHead(200, { "Content-Type": MIME[".js"] });
    fs.createReadStream(OVERLAY).pipe(res);
    return;
  }

  // Annotations API.
  if (url.pathname === "/__annotations") {
    const page = url.searchParams.get("page");
    if (!page) return sendJson(res, 400, { error: "missing page" });
    const file = storeFor(page);
    if (!file) return sendJson(res, 400, { error: "bad page" });

    // Return only this page's pins (plus legacy pins that predate the page field),
    // so a shared store / shared directory doesn't leak pins across pages.
    if (req.method === "GET") {
      return sendJson(res, 200, readStore(file).filter((a) => !a.page || a.page === page));
    }

    if (req.method === "POST") {
      let body;
      try {
        body = await readBody(req);
      } catch {
        return sendJson(res, 400, { error: "bad json" });
      }
      if (!body.text) return sendJson(res, 400, { error: "missing text" });
      const list = readStore(file);
      const ann = {
        id: "a" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
        page,
        selector: body.selector || "",
        domPath: body.domPath || [],
        snippet: body.snippet || "",
        kind: body.kind === "code" ? "code" : "design",
        text: body.text,
        createdAt: new Date().toISOString(),
      };
      list.push(ann);
      writeStore(file, list);
      console.log(`+ [${ann.kind}] annotation on ${page} → ${ann.selector}`);
      return sendJson(res, 200, ann);
    }

    if (req.method === "DELETE") {
      const id = url.searchParams.get("id");
      const list = readStore(file).filter((a) => a.id !== id);
      writeStore(file, list);
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 405, { error: "method not allowed" });
  }

  // Static files.
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const filePath = path.join(ROOT, rel);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    return res.end("forbidden");
  }

  fs.stat(filePath, (err, stat) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("404 — " + rel);
    }
    if (stat.isDirectory()) {
      res.writeHead(302, { Location: rel.replace(/\/?$/, "/") });
      return res.end();
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";

    // Inject the overlay into HTML before </body>.
    if (ext === ".html") {
      let html = fs.readFileSync(filePath, "utf8");
      const inject = INJECT(rel);
      html = html.includes("</body>")
        ? html.replace("</body>", inject + "</body>")
        : html + inject;
      res.writeHead(200, { "Content-Type": type });
      return res.end(html);
    }

    res.writeHead(200, { "Content-Type": type });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Annotate server → http://localhost:${PORT}/`);
  console.log(`Serving ${ROOT}`);
  console.log(STORE ? `App mode — all pins → ${STORE}` : `Mockup mode — pins → annotations.json per directory`);
});
