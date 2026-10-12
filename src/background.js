// Background script: opens a search or a link in a tab.

// Only these schemes are ever opened (never javascript:, file:, data:, ...).
const SCHEMES = new Set(["http:", "https:", "ftp:"]);

async function openResult({ text, url, reverse }, tab) {
  const { background, openIn } = await browser.storage.sync.get(DEFAULTS);

  let target = null;
  if (url) {
    const u = new URL(url); // throws on garbage; the caller logs it
    if (!SCHEMES.has(u.protocol)) return;
    target = u.href;
  }
  const query = String(text || "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (!target && !query) return;

  // Current tab or new tab: the setting, reversed while the modifier key is held.
  if ((openIn === "current") !== Boolean(reverse)) {
    return target
      ? browser.tabs.update(tab.id, { url: target })
      : browser.search.search({ query, tabId: tab.id });
  }

  // New tab right next to the current one.
  const props = { active: !background, openerTabId: tab.id, index: tab.index + 1 };
  if (target) return browser.tabs.create({ ...props, url: target });
  if (!background) return browser.search.search({ query, disposition: "NEW_TAB" });
  // browser.search cannot open a background tab itself: create a blank one and search in it.
  const blank = await browser.tabs.create({ ...props, url: "about:blank" });
  return browser.search.search({ query, tabId: blank.id });
}

// Middle-click, sent by the content script.
browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === "open" && sender.tab) openResult(msg, sender.tab).catch(console.error);
});

// Hotkey (assign it in about:addons -> gear -> Manage Extension Shortcuts).
browser.commands.onCommand.addListener(async (name) => {
  if (name !== "trigger-action") return;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  try {
    // Only the frame that has a selection answers; the first answer wins.
    const selection = await browser.tabs.sendMessage(tab.id, { type: "get-selection" });
    if (selection) await openResult(selection, tab);
  } catch {
    // Page without a content script (about:*, addons.mozilla.org, ...): nothing to do.
  }
});
