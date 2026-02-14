# Tab FZF (Firefox Extension)

Keyboard-first tab search popup.

## Features

- Toolbar click opens popup with tab search.
- Search over open tab titles and switch with Enter.
- Settings view (gear button in bottom-right) to manage shortcut.
- Keyboard navigation:
  - `ArrowDown` / `Ctrl+N` / `Ctrl+J`
  - `ArrowUp` / `Ctrl+P` / `Ctrl+K`
  - `Enter` to confirm
  - `Esc` to close
- Selecting a match activates that tab and focuses its window.

## Install (Temporary)

1. Run `npm run build`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...**
4. Select `dist/tabfzf.xpi` (recommended for Flatpak Firefox).

## Notes

- Requires the `tabs` permission to read tab titles.
- If `Ctrl+Shift+K` conflicts on your setup, change it in:
- Flatpak note: loading only `manifest.json` via file portal can hide sibling files (`popup/`, `icons/`).
  Use `dist/tabfzf.xpi` so all extension files are bundled.
