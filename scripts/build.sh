#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

cp "$ROOT_DIR/manifest.json" "$DIST_DIR/manifest.json"
cp -r "$ROOT_DIR/popup" "$DIST_DIR/popup"
cp -r "$ROOT_DIR/icons" "$DIST_DIR/icons"

(
  cd "$DIST_DIR"
  zip -rq tabfzf.xpi manifest.json popup icons
)

echo "Build complete: dist/"
echo "Package ready: dist/tabfzf.xpi"
