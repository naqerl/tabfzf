# TabFZF

You like staying focused in your editor and using FZF for navigation. TabFZF brings that same keyboard-first flow to your browser tabs.

## Quick Demo

https://github.com/user-attachments/assets/b4d0135a-1b7b-4040-8860-c9c08dfe87eb

Fallback: [https://youtu.be/-RNFQ8brvkU](https://youtu.be/-RNFQ8brvkU)

## Features

1. [x] Trigger by configurable shortcut (default: `Ctrl+Shift+F`)
2. [x] Emacs-like binds
3. [x] Change themes
4. [ ] Change fuzzy algorithms (TODO)

## Supported Browsers

- [x] Firefox
- [x] Chromium-based browsers (Chrome, Edge, Brave)

## Installation Guide

Download Firefox package:
```bash
curl -L -o tabfzf-firefox.xpi https://github.com/naqerl/tabfzf/releases/latest/download/tabfzf-firefox.xpi
```
1. Open `about:addons` in Firefox.
1. Click the gear icon, then **Install Add-on From File...**
1. Select the downloaded `tabfzf-firefox.xpi`.

Download Chromium package:
```bash
curl -L -o tabfzf-chromium.zip https://github.com/naqerl/tabfzf/releases/latest/download/tabfzf-chromium.zip
```
1. Unzip `tabfzf-chromium.zip`.
1. Open `chrome://extensions` (or `edge://extensions`).
1. Enable **Developer mode**.
1. Click **Load unpacked** and select the unzipped folder.

## Shortcuts Notes

- Firefox: Use `about:addons` to manage extension shortcuts.
- Chromium browsers: Use `chrome://extensions/shortcuts` (or `edge://extensions/shortcuts`).
