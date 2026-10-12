// Content script: reacts to a middle-click on (or near) selected text and asks the background
// script to search it or open it as a link. Any other middle-click is left to the browser.
(() => {
  "use strict";

  // Settings are cached: the click handler has to decide synchronously, and
  // preventDefault() cannot wait for an async storage read.
  let cfg = { ...DEFAULTS };
  const loadSettings = () => browser.storage.sync.get(DEFAULTS).then((v) => { cfg = v; });
  loadSettings();
  browser.storage.onChanged.addListener(loadSettings);

  // ---------- Selection ----------

  // Input types with a text selection. Password fields are left out on purpose so their
  // content can never end up in a search engine.
  const TEXT_INPUTS = new Set(["text", "search", "url", "tel"]);

  // { text, field } for a selection inside an input/textarea (getSelection() can't see it),
  // { text, range } for a selection in the page, or null if nothing is selected.
  function getSelectionInfo() {
    const el = document.activeElement;
    const isField = el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && TEXT_INPUTS.has(el.type)));
    if (isField && el.selectionStart !== el.selectionEnd) {
      return { text: el.value.slice(el.selectionStart, el.selectionEnd), field: el };
    }
    const sel = getSelection();
    return sel && !sel.isCollapsed && sel.rangeCount
      ? { text: sel.toString(), range: sel.getRangeAt(0) }
      : null;
  }

  // ---------- Hit testing ----------

  // Distance in px from point (x, y) to a rectangle (0 when inside).
  const dist = (r, x, y) =>
    Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));

  // Is (x, y) within `radius` px of the selected page text? Measures each selected text node
  // separately, because Range.getClientRects() also returns whole block elements.
  function nearRange(range, x, y, radius) {
    if (dist(range.getBoundingClientRect(), x, y) > radius) return false; // cheap early exit

    const near = (node, start, end) => {
      const r = document.createRange();
      r.setStart(node, start);
      r.setEnd(node, end);
      return Array.from(r.getClientRects()).some((rect) => dist(rect, x, y) <= radius);
    };

    const root = range.commonAncestorContainer;
    if (root.nodeType === Node.TEXT_NODE) return near(root, range.startOffset, range.endOffset);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode()); ) {
      if (!range.intersectsNode(n)) continue;
      const start = n === range.startContainer ? range.startOffset : 0;
      const end = n === range.endContainer ? range.endOffset : n.length;
      if (end > start && near(n, start, end)) return true;
    }
    return false;
  }

  // Style properties copied to the hidden mirror so its text lays out like the field's.
  const MIRRORED = [
    "fontStyle", "fontVariant", "fontWeight", "fontStretch", "fontSize", "fontFamily",
    "lineHeight", "letterSpacing", "wordSpacing", "textTransform", "textIndent", "tabSize",
    "direction", "textAlign", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  ];

  // Same test for input/textarea. Their selection geometry isn't exposed, so the selected
  // text is measured in a hidden copy ("mirror") of the field.
  function nearField(el, x, y, radius) {
    const box = el.getBoundingClientRect();
    if (dist(box, x, y) > radius) return false;

    // Visible inner area of the field (inside its border and scrollbars).
    const view = { left: box.left + el.clientLeft, top: box.top + el.clientTop };
    view.right = view.left + el.clientWidth;
    view.bottom = view.top + el.clientHeight;

    const multiline = el.tagName === "TEXTAREA";
    const cs = getComputedStyle(el);
    const mirror = document.createElement("div");
    for (const p of MIRRORED) mirror.style[p] = cs[p];
    Object.assign(mirror.style, {
      position: "fixed", visibility: "hidden", pointerEvents: "none",
      margin: "0", border: "0", overflow: "hidden", boxSizing: "border-box",
      left: view.left + "px", top: view.top + "px",
      width: el.clientWidth + "px", height: el.clientHeight + "px",
      whiteSpace: multiline ? "pre-wrap" : "pre",
      overflowWrap: multiline ? "break-word" : "normal",
    });

    const span = document.createElement("span"); // wraps the selected part
    span.textContent = el.value.slice(el.selectionStart, el.selectionEnd);
    mirror.append(el.value.slice(0, el.selectionStart), span, el.value.slice(el.selectionEnd));
    document.documentElement.append(mirror);
    mirror.scrollTop = el.scrollTop; // follow the field's own scrolling
    mirror.scrollLeft = el.scrollLeft;
    const rects = Array.from(span.getClientRects());
    mirror.remove();

    return rects.some((r) => {
      // Single-line inputs centre their text vertically: use the full field height.
      const rect = multiline ? r : { left: r.left, right: r.right, top: view.top, bottom: view.bottom };
      const visible = rect.right > view.left && rect.left < view.right &&
                      rect.bottom > view.top && rect.top < view.bottom;
      return visible && dist(rect, x, y) <= radius;
    });
  }

  // ---------- URL detection ----------

  // Plain selected text that looks like a URL, as in Firefox's own "Open Link" for selected
  // text (Firefox uses an internal URI-fixup service that extensions can't call). Accepts
  // http/https/ftp URLs and scheme-less hosts like "example.com/page"; returns the URL or null.
  // Text inside a real page link is deliberately NOT treated as a link: it gets searched.
  function urlFromText(t) {
    if (/\s/.test(t)) return null;
    if (/^(https?|ftp):\/\/\S+$/i.test(t)) return t;
    return /^(?:[a-z\d-]+\.)+[a-z][a-z\d-]*(?::\d+)?(?:[/?#]\S*)?$/i.test(t) ? "http://" + t : null;
  }

  // ---------- Middle-click ----------

  const block = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation(); // hide the click from page scripts too
  };

  // Called on a middle-button press. Returns true if the press is ours, i.e. it landed on (or
  // within `radius` px of) the selected text. Everything else is left to the browser.
  function onMiddlePress(e) {
    const info = getSelectionInfo();
    if (!e.isTrusted || !info) return false;
    const text = info.text.trim();
    if (!text || text.length < cfg.minLength || (info.field && cfg.skipFields)) return false;

    // A link that isn't part of the selection keeps its normal middle-click: only an exact hit counts.
    const onLink = e.target instanceof Element && e.target.closest("a[href]");
    const radius = onLink ? 0 : cfg.radius;
    const hit = info.field
      ? nearField(info.field, e.clientX, e.clientY, radius)
      : nearRange(info.range, e.clientX, e.clientY, radius);
    if (!hit) return false;

    const msg = {
      type: "open",
      text,
      url: cfg.linkOpen ? urlFromText(text) : null,
      // The chosen modifier (shift/ctrl/alt) reverses the new-tab / current-tab setting.
      reverse: cfg.reverseKey !== "none" && e[cfg.reverseKey + "Key"],
    };
    block(e); // no Windows autoscroll, no Linux paste
    browser.runtime.sendMessage(msg).catch(() => {});
    return true;
  }

  // Firefox reports the middle button as pointerdown (a plain mousedown is not always sent),
  // so the decision is made there. The follow-up mouse events of a handled click are swallowed.
  let handled = false;
  window.addEventListener("pointerdown", (e) => {
    if (e.button === 1) handled = onMiddlePress(e);
  }, true);
  for (const type of ["mousedown", "mouseup", "auxclick"]) {
    window.addEventListener(type, (e) => {
      if (e.button !== 1 || !handled) return;
      block(e);
      if (type === "auxclick") handled = false; // last event of the click
    }, true);
  }

  // ---------- Hotkey ----------

  // The background asks every frame of the tab; only a frame with a selection answers.
  browser.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== "get-selection") return;
    const info = getSelectionInfo();
    const text = info && info.text.trim();
    if (text) return Promise.resolve({ text, url: cfg.linkOpen ? urlFromText(text) : null });
  });
})();
