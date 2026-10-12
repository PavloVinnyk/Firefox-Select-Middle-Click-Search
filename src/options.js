// Options page: fills in translated strings and saves every change to storage.sync.
const $ = (id) => document.getElementById(id);

// Localization: an element with data-i18n="key" gets the message "key" from _locales/<lang>/.
for (const el of document.querySelectorAll("[data-i18n]")) {
  el.textContent = browser.i18n.getMessage(el.dataset.i18n);
}

// Each setting has an input whose id equals its key in DEFAULTS.
browser.storage.sync.get(DEFAULTS).then((cfg) => {
  for (const k in DEFAULTS) {
    const el = $(k);
    if (el.type === "checkbox") el.checked = cfg[k];
    else el.value = cfg[k];
  }
});

document.addEventListener("change", () => {
  const out = {};
  for (const k in DEFAULTS) {
    const el = $(k);
    if (el.type === "checkbox") out[k] = el.checked;
    else if (el.type === "number") out[k] = Math.min(+el.max, Math.max(+el.min, Number(el.value) || +el.min));
    else out[k] = el.value; // <select>
  }
  browser.storage.sync.set(out);
});
