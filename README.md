# Select, Middle-Click, Search

A Firefox extension. Select some text on a page and middle-click it to search it with your default search engine.

<p align="center">
    <a href="https://addons.mozilla.org/en-US/firefox/addon/select-middle-click-search/"><img alt="Get it for Firefox" src="./images/firefox-addons-banner.png"/></a>
</p>

## What it does

- Middle-click on selected text (or close to it) searches that text. The result opens in a new background tab.
- Middle-click anywhere else works as usual: scrolling, opening links in a new tab, and so on.
- If the selected text is a web address (like `https://example.com` or `example.com`), it opens the address instead of searching. You can turn this off.
- If you select the text of a link and middle-click it, the text is searched. The link is not followed.
- Text selected inside input fields and text areas works too. Password fields are never used.
- There is also a keyboard shortcut for the same action. No key is assigned by default.

## Settings

Open them in `about:addons` -> the extension -> Preferences.

- Hit radius: how far from the selected text a middle-click still counts (default 25 px, 0 = only directly on the text)
- Minimum length of the selected text
- Open selected text that looks like a URL instead of searching
- Ignore text selected in input fields
- Open results in a new tab or in the current tab (default: new tab)
- Open new tabs in the background (default: on)
- Modifier key (Shift, Ctrl or Alt, default Shift): hold it while middle-clicking to do the opposite of the new/current tab setting

To set the keyboard shortcut, open `about:addons`, click the gear icon and choose Manage Extension Shortcuts.

## Limits

Firefox does not run extensions on some pages, like `about:` pages and addons.mozilla.org. It probably does not work in the built-in PDF viewer either.

## Privacy

The extension does not collect or send any data. The selected text is only passed to Firefox's search, so it goes to your default search engine like any other search.

## Files

- `manifest.json`: extension description and permissions
- `defaults.js`: default settings, shared by all scripts
- `content.js`: runs in pages, finds the middle-click on the selection
- `background.js`: opens the search or the address in a tab
- `options.html`, `options.js`: settings page
- `_locales/`: translations
- `icons/`: icons

## How it was made

Parts of the code and text, including this file, were written with the help of generative AI tools (Claude, by Anthropic).

## License

[MIT](LICENSE)
