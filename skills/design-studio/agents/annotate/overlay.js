// Annotation overlay — injected into served design pages by tools/annotate/server.mjs.
// Lets the user pin a comment onto any element. Comments persist to annotations.json
// next to the page; the agent reads that file and applies the requested edits.
(function () {
  "use strict";

  // BASE lets the overlay talk to a remote annotate server (real-app dev widget,
  // loaded from a different origin); empty = same-origin (static mockup mode).
  var BASE = window.__ANNOTATE_BASE || "";
  var PAGE = window.__ANNOTATE_PAGE || location.pathname;
  var API = BASE + "/__annotations?page=" + encodeURIComponent(PAGE);

  // A pin is either a "design" change (the design agent edits the mockup) or a
  // "code" change (the coding agent edits the real codebase, using the pin as a
  // visual reference). The two streams build two separate specs.
  var KIND_COLORS = { design: "#4f46e5", code: "#d97706" };
  function kindColor(k) { return KIND_COLORS[k] || KIND_COLORS.design; }

  var state = {
    mode: false, // annotate mode on/off
    hovered: null, // element currently under cursor
    annotations: [], // [{id, selector, domPath, snippet, text, kind, createdAt}]
  };

  // --- element identity ---------------------------------------------------

  function isOurs(el) {
    return !!(el && el.closest && el.closest("#__ann_root"));
  }

  // Unique CSS selector: stop at the first id, otherwise nth-of-type chain to body.
  function cssPath(el) {
    if (!el || el.nodeType !== 1) return "";
    var parts = [];
    while (el && el.nodeType === 1 && el.tagName !== "BODY" && el.tagName !== "HTML") {
      if (el.id) {
        parts.unshift("#" + CSS.escape(el.id));
        break;
      }
      var tag = el.tagName.toLowerCase();
      var parent = el.parentNode;
      if (parent) {
        var same = Array.prototype.filter.call(parent.children, function (c) {
          return c.tagName === el.tagName;
        });
        if (same.length > 1) {
          tag += ":nth-of-type(" + (same.indexOf(el) + 1) + ")";
        }
      }
      parts.unshift(tag);
      el = el.parentNode;
    }
    return parts.join(" > ");
  }

  // Human-readable ancestry chain for the agent (tag.class …, outermost last).
  function domPath(el) {
    var chain = [];
    var node = el;
    for (var i = 0; node && node.nodeType === 1 && i < 5; i++) {
      var t = node.tagName.toLowerCase();
      if (node.id) t += "#" + node.id;
      else if (node.className && typeof node.className === "string") {
        t += "." + node.className.trim().split(/\s+/).join(".");
      }
      chain.push(t);
      node = node.parentNode;
    }
    return chain;
  }

  function snippet(el) {
    var s = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");
    return s.length > 90 ? s.slice(0, 90) + "…" : s;
  }

  // --- DOM scaffold -------------------------------------------------------

  var root, highlight, pinsLayer, btn, popover;

  function injectStyles() {
    var css = document.createElement("style");
    css.textContent =
      "#__ann_root, #__ann_root * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }" +
      "#__ann_hl { position: fixed; pointer-events: none; z-index: 2147483640; border: 2px solid #4f46e5; background: rgba(79,70,229,.10); border-radius: 4px; transition: all .04s linear; display: none; }" +
      "#__ann_hl .tag { position: absolute; top: -22px; left: -2px; background: #4f46e5; color: #fff; font-size: 11px; line-height: 1; padding: 4px 6px; border-radius: 4px; white-space: nowrap; }" +
      "#__ann_btn { position: fixed; right: 20px; bottom: 20px; z-index: 2147483646; height: 44px; padding: 0 18px; border-radius: 999px; border: none; cursor: pointer; font-size: 14px; font-weight: 600; background: #14181f; color: #fff; box-shadow: 0 6px 24px rgba(0,0,0,.22); display: flex; align-items: center; gap: 8px; }" +
      "#__ann_btn.on { background: #4f46e5; }" +
      "#__ann_btn .badge { background: rgba(255,255,255,.22); border-radius: 999px; padding: 1px 7px; font-size: 12px; }" +
      ".__ann_pin { position: absolute; z-index: 2147483641; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 999px 999px 999px 2px; color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.3); border: 2px solid #fff; }" +
      "#__ann_pop { position: fixed; z-index: 2147483647; width: 300px; background: #fff; border-radius: 12px; box-shadow: 0 12px 48px rgba(0,0,0,.28); border: 1px solid #e6e9ef; padding: 14px; }" +
      "#__ann_pop .ctx { font-size: 12px; color: #5c6675; background: #f6f7f9; border-radius: 6px; padding: 6px 8px; margin-bottom: 10px; word-break: break-word; max-height: 60px; overflow: auto; }" +
      "#__ann_pop .kinds { display: flex; gap: 6px; margin-bottom: 10px; }" +
      "#__ann_pop .kind { flex: 1; height: 32px; border: 1px solid #e6e9ef; border-radius: 8px; background: #fff; font-size: 12px; font-weight: 600; color: #5c6675; cursor: pointer; }" +
      "#__ann_pop .kind.sel { color: #fff; border-color: transparent; }" +
      "#__ann_pop .kbadge { display: inline-block; vertical-align: middle; margin-left: 6px; padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 700; color: #fff; }" +
      "#__ann_pop textarea { width: 100%; min-height: 72px; resize: vertical; border: 1px solid #e6e9ef; border-radius: 8px; padding: 8px 10px; font-size: 14px; }" +
      "#__ann_pop .row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }" +
      "#__ann_pop button { height: 34px; padding: 0 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid #e6e9ef; background: #fff; }" +
      "#__ann_pop button.primary { background: #4f46e5; color: #fff; border-color: #4f46e5; }" +
      "#__ann_pop button.danger { color: #c0392b; border-color: #f0d0cc; }" +
      "#__ann_pop .saved { font-size: 14px; color: #14181f; white-space: pre-wrap; word-break: break-word; }";
    document.head.appendChild(css);
  }

  function build() {
    injectStyles();
    root = document.createElement("div");
    root.id = "__ann_root";

    highlight = document.createElement("div");
    highlight.id = "__ann_hl";
    highlight.innerHTML = '<span class="tag"></span>';

    pinsLayer = document.createElement("div");
    pinsLayer.id = "__ann_pins";

    btn = document.createElement("button");
    btn.id = "__ann_btn";
    btn.addEventListener("click", toggleMode);

    root.appendChild(highlight);
    root.appendChild(pinsLayer);
    root.appendChild(btn);
    document.body.appendChild(root);
    renderButton();
  }

  function renderButton() {
    btn.className = state.mode ? "on" : "";
    var label = state.mode ? "Click an element to comment" : "Annotate";
    btn.innerHTML =
      "📍 <span>" + label + "</span>" +
      (state.annotations.length ? '<span class="badge">' + state.annotations.length + "</span>" : "");
  }

  // --- annotate mode ------------------------------------------------------

  function toggleMode() {
    state.mode = !state.mode;
    if (!state.mode) {
      highlight.style.display = "none";
      state.hovered = null;
    }
    closePopover();
    renderButton();
  }

  function onMove(e) {
    if (!state.mode) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isOurs(el)) {
      highlight.style.display = "none";
      state.hovered = null;
      return;
    }
    state.hovered = el;
    var r = el.getBoundingClientRect();
    highlight.style.display = "block";
    highlight.style.left = r.left + "px";
    highlight.style.top = r.top + "px";
    highlight.style.width = r.width + "px";
    highlight.style.height = r.height + "px";
    highlight.querySelector(".tag").textContent = labelFor(el);
  }

  function labelFor(el) {
    var t = el.tagName.toLowerCase();
    if (el.id) return t + "#" + el.id;
    if (el.className && typeof el.className === "string") {
      return t + "." + el.className.trim().split(/\s+/)[0];
    }
    return t;
  }

  function onClick(e) {
    if (!state.mode) return;
    if (isOurs(e.target)) return; // let our own UI work normally
    e.preventDefault();
    e.stopPropagation();
    var el = state.hovered || document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isOurs(el)) return;
    openComposer(el, e.clientX, e.clientY);
  }

  // --- popover (compose new + view existing) ------------------------------

  function placePopover(x, y) {
    var w = 300, h = popover.offsetHeight || 160;
    popover.style.left = Math.min(x, window.innerWidth - w - 12) + "px";
    popover.style.top = Math.min(y, window.innerHeight - h - 12) + "px";
  }

  function openComposer(el, x, y) {
    closePopover();
    var target = { selector: cssPath(el), domPath: domPath(el), snippet: snippet(el) };
    var kind = "design";
    popover = document.createElement("div");
    popover.id = "__ann_pop";
    popover.innerHTML =
      '<div class="ctx"><b>' + escapeHtml(labelFor(el)) + "</b>" +
      (target.snippet ? " — " + escapeHtml(target.snippet) : "") + "</div>" +
      '<div class="kinds">' +
      '<button class="kind" data-kind="design">🎨 Design</button>' +
      '<button class="kind" data-kind="code">⌘ Code</button>' +
      "</div>" +
      '<textarea placeholder="What should change here?"></textarea>' +
      '<div class="row"><button class="cancel">Cancel</button><button class="primary save">Save</button></div>';
    root.appendChild(popover);
    placePopover(x, y);
    var kindBtns = popover.querySelectorAll(".kind");
    var saveBtn = popover.querySelector(".save");
    function selectKind(k) {
      kind = k;
      Array.prototype.forEach.call(kindBtns, function (b) {
        var on = b.dataset.kind === k;
        b.classList.toggle("sel", on);
        b.style.background = on ? kindColor(k) : "#fff";
      });
      saveBtn.style.background = kindColor(k);
      saveBtn.style.borderColor = kindColor(k);
    }
    Array.prototype.forEach.call(kindBtns, function (b) {
      b.addEventListener("click", function () { selectKind(b.dataset.kind); });
    });
    selectKind(kind);
    var ta = popover.querySelector("textarea");
    ta.focus();
    popover.querySelector(".cancel").addEventListener("click", closePopover);
    saveBtn.addEventListener("click", function () {
      var text = ta.value.trim();
      if (!text) { ta.focus(); return; }
      save(Object.assign({ text: text, kind: kind }, target));
    });
    ta.addEventListener("keydown", function (ev) {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") popover.querySelector(".save").click();
      if (ev.key === "Escape") closePopover();
    });
  }

  function openViewer(ann, x, y) {
    closePopover();
    popover = document.createElement("div");
    popover.id = "__ann_pop";
    var kind = ann.kind || "design";
    popover.innerHTML =
      '<div class="ctx"><b>' + escapeHtml((ann.domPath && ann.domPath[0]) || ann.selector) + "</b>" +
      (ann.snippet ? " — " + escapeHtml(ann.snippet) : "") +
      '<span class="kbadge" style="background:' + kindColor(kind) + '">' + escapeHtml(kind) + "</span></div>" +
      '<div class="saved">' + escapeHtml(ann.text) + "</div>" +
      '<div class="row"><button class="danger del">Delete</button><button class="cancel">Close</button></div>';
    root.appendChild(popover);
    placePopover(x, y);
    popover.querySelector(".cancel").addEventListener("click", closePopover);
    popover.querySelector(".del").addEventListener("click", function () { remove(ann.id); });
  }

  function closePopover() {
    if (popover && popover.parentNode) popover.parentNode.removeChild(popover);
    popover = null;
  }

  // --- pins ---------------------------------------------------------------

  function renderPins() {
    pinsLayer.innerHTML = "";
    state.annotations.forEach(function (ann, i) {
      var el = safeQuery(ann.selector);
      if (!el) return; // element no longer exists (e.g. after edits)
      var pin = document.createElement("div");
      pin.className = "__ann_pin";
      pin.textContent = i + 1;
      pin.title = (ann.kind || "design") + ": " + ann.text;
      pin.style.background = kindColor(ann.kind);
      pin.dataset.id = ann.id;
      pin.addEventListener("click", function (e) {
        e.stopPropagation();
        openViewer(ann, e.clientX, e.clientY);
      });
      pinsLayer.appendChild(pin);
    });
    positionPins();
  }

  function positionPins() {
    var pins = pinsLayer.children;
    for (var i = 0; i < pins.length; i++) {
      var ann = state.annotations[i];
      if (!ann) continue;
      var el = safeQuery(ann.selector);
      if (!el) { pins[i].style.display = "none"; continue; }
      pins[i].style.display = "flex";
      var r = el.getBoundingClientRect();
      pins[i].style.left = r.left + window.scrollX + "px";
      pins[i].style.top = r.top + window.scrollY + "px";
    }
  }

  function safeQuery(sel) {
    try { return document.querySelector(sel); } catch (e) { return null; }
  }

  // --- persistence --------------------------------------------------------

  function load() {
    fetch(API).then(function (r) { return r.json(); }).then(function (data) {
      state.annotations = Array.isArray(data) ? data : [];
      renderButton();
      renderPins();
    }).catch(function () {});
  }

  function save(ann) {
    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ann),
    }).then(function (r) { return r.json(); }).then(function (saved) {
      state.annotations.push(saved);
      closePopover();
      renderButton();
      renderPins();
    }).catch(function () { alert("Could not save annotation (is the annotate server running?)"); });
  }

  function remove(id) {
    fetch(API + "&id=" + encodeURIComponent(id), { method: "DELETE" })
      .then(function () {
        state.annotations = state.annotations.filter(function (a) { return a.id !== id; });
        closePopover();
        renderButton();
        renderPins();
      }).catch(function () {});
  }

  // --- utils --------------------------------------------------------------

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function tick() {
    if (state.mode && state.hovered) {
      var r = state.hovered.getBoundingClientRect();
      highlight.style.left = r.left + "px";
      highlight.style.top = r.top + "px";
      highlight.style.width = r.width + "px";
      highlight.style.height = r.height + "px";
    }
    positionPins();
    requestAnimationFrame(tick);
  }

  // --- boot ---------------------------------------------------------------

  function init() {
    build();
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    load();
    requestAnimationFrame(tick);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
