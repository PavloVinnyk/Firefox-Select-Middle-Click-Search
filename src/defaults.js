// Default settings, shared by the background, content and options scripts.
// Each key has an input with the same id on the options page.
const DEFAULTS = {
  radius: 25,          // px around the selected text that still counts as a hit (0 = exact)
  minLength: 1,        // minimum selection length in characters
  linkOpen: true,      // open selected text that looks like a URL instead of searching
  openIn: "new",       // where results open: new | current
  background: true,    // a new tab opens in the background
  reverseKey: "shift", // modifier that reverses openIn (new <-> current): none | shift | ctrl | alt
  skipFields: false,   // ignore text selected in input fields / textareas
};
