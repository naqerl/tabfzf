#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
FIREFOX_DIR="$DIST_DIR/firefox"
CHROMIUM_DIR="$DIST_DIR/chromium"

rm -rf "$DIST_DIR"
mkdir -p "$FIREFOX_DIR" "$CHROMIUM_DIR"

cp "$ROOT_DIR/manifest.json" "$FIREFOX_DIR/manifest.json"
cp "$ROOT_DIR/manifest.chromium.json" "$CHROMIUM_DIR/manifest.json"
cp -r "$ROOT_DIR/popup" "$FIREFOX_DIR/popup"
cp -r "$ROOT_DIR/popup" "$CHROMIUM_DIR/popup"
cp -r "$ROOT_DIR/icons" "$FIREFOX_DIR/icons"
cp -r "$ROOT_DIR/icons" "$CHROMIUM_DIR/icons"

(
  cd "$FIREFOX_DIR"
  zip -rq tabfzf-firefox.xpi manifest.json popup icons
)

(
  cd "$CHROMIUM_DIR"
  zip -rq tabfzf-chromium.zip manifest.json popup icons
)

echo "Build complete: dist/"
echo "Package ready: dist/firefox/tabfzf-firefox.xpi"
echo "Package ready: dist/chromium/tabfzf-chromium.zip"
