#!/bin/bash
# Instala Cahier como app de Mac: /Applications/Cahier.app + ícono en el Dock.
# Uso:  bash ~/Downloads/instalar-cahier.sh
# Generado por scripts/build-cahier.js — no editar a mano.
set -euo pipefail

if [ "$(uname)" != "Darwin" ]; then echo "Este instalador es para Mac."; exit 1; fi

echo "→ Preparando Cahier…"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
APP="$TMP/Cahier.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

base64 -D > "$APP/Contents/Resources/Cahier.html" <<'__HTML__'
@@HTML@@
__HTML__

base64 -D > "$TMP/icon.png" <<'__ICON__'
@@ICON@@
__ICON__

base64 -D > "$TMP/Cahier.swift" <<'__SWIFT__'
@@SWIFT@@
__SWIFT__

# Ícono (.icns) con las herramientas que trae macOS
SET="$TMP/icon.iconset"; mkdir -p "$SET"
for s in 16 32 128 256 512; do
  sips -z $s $s "$TMP/icon.png" --out "$SET/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2)); sips -z $d $d "$TMP/icon.png" --out "$SET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o "$APP/Contents/Resources/icon.icns"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Cahier</string>
  <key>CFBundleDisplayName</key><string>Cahier</string>
  <key>CFBundleIdentifier</key><string>app.cahier.mac</string>
  <key>CFBundleExecutable</key><string>Cahier</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.education</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST

# App nativa (ventana propia) si hay compilador; si no, se abre en el navegador.
NATIVA=no
if xcode-select -p >/dev/null 2>&1 && xcrun --find swiftc >/dev/null 2>&1; then
  echo "→ Compilando la app…"
  if xcrun swiftc -O "$TMP/Cahier.swift" -o "$APP/Contents/MacOS/Cahier" 2>"$TMP/swift.log"; then
    NATIVA=si
  else
    echo "  (no compiló; uso el modo navegador)"; sed 's/^/    /' "$TMP/swift.log" | head -20
  fi
fi
if [ "$NATIVA" = no ]; then
  cat > "$APP/Contents/MacOS/Cahier" <<'LANZADOR'
#!/bin/bash
F="$(cd "$(dirname "$0")/../Resources" && pwd)/Cahier.html"
for B in "Google Chrome" "Brave Browser" "Microsoft Edge"; do
  if [ -d "/Applications/$B.app" ]; then
    open -na "$B" --args --app="file://$F" --window-size=560,880; exit 0
  fi
done
open "$F"
LANZADOR
  chmod +x "$APP/Contents/MacOS/Cahier"
fi
codesign --force --deep -s - "$APP" >/dev/null 2>&1 || true

# Instalar
DEST=/Applications
[ -w "$DEST" ] || { DEST="$HOME/Applications"; mkdir -p "$DEST"; }
pkill -x Cahier 2>/dev/null || true
rm -rf "$DEST/Cahier.app"
mv "$APP" "$DEST/Cahier.app"
xattr -dr com.apple.quarantine "$DEST/Cahier.app" 2>/dev/null || true
touch "$DEST/Cahier.app"

# Dock (solo si no está ya)
if ! defaults read com.apple.dock persistent-apps 2>/dev/null | grep -q "Cahier.app"; then
  defaults write com.apple.dock persistent-apps -array-add \
    "<dict><key>tile-data</key><dict><key>file-data</key><dict><key>_CFURLString</key><string>file://$DEST/Cahier.app/</string><key>_CFURLStringType</key><integer>15</integer></dict></dict></dict>"
  killall Dock 2>/dev/null || true
fi

open "$DEST/Cahier.app"
echo ""
echo "✓ Cahier instalada en $DEST/Cahier.app y agregada al Dock."
if [ "$NATIVA" = no ]; then
  echo ""
  echo "  Ahora se abre en el navegador. Para que tenga su propia ventana:"
  echo "    1) xcode-select --install     (instala las herramientas de Apple, ~5 min)"
  echo "    2) vuelve a correr este instalador"
fi
