#!/usr/bin/env bash
#
# dump-skip.sh — capture the Skip courier app's current screen UI hierarchy and
# print every element that has a resource-id, text, or content-description.
#
# Use it to discover the real selectors for SkipSelectors.kt. Run it while the
# Skip app is showing the screen you care about — ESPECIALLY while a real run is
# visible on the Open Runs page, to capture the run card + claim button.
#
# Usage:  ./scripts/dump-skip.sh
#
set -euo pipefail

ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$ANDROID_HOME/platform-tools/adb"
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/.dumps"
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
XML="$OUT_DIR/skip-$STAMP.xml"

echo "Foreground app:"
"$ADB" shell dumpsys window 2>/dev/null | grep "mCurrentFocus" | head -1 || true

echo "Dumping UI hierarchy..."
"$ADB" shell uiautomator dump /sdcard/window_dump.xml >/dev/null 2>&1
"$ADB" pull /sdcard/window_dump.xml "$XML" >/dev/null 2>&1
echo "Saved raw dump: $XML"
echo

python3 - "$XML" <<'PY'
import sys, xml.etree.ElementTree as ET
root = ET.parse(sys.argv[1]).getroot()
rows = []
for n in root.iter('node'):
    rid = n.get('resource-id') or ''
    txt = n.get('text') or ''
    cd  = n.get('content-desc') or ''
    if not (rid or txt or cd):
        continue
    cls = (n.get('class') or '').split('.')[-1]
    flags = []
    if n.get('clickable') == 'true':  flags.append('CLICK')
    if n.get('scrollable') == 'true': flags.append('SCROLL')
    rows.append((rid, txt, cd, cls, ' '.join(flags), n.get('bounds') or ''))

print(f"{len(rows)} nodes with id/text/desc:\n")
for rid, txt, cd, cls, fl, bounds in rows:
    parts = []
    if rid: parts.append(f"id=[{rid}]")
    if txt: parts.append(f'text="{txt}"')
    if cd:  parts.append(f'desc="{cd}"')
    parts.append(f"<{cls}>")
    if fl:  parts.append(f"({fl})")
    parts.append(bounds)
    print("  " + " ".join(parts))
PY
