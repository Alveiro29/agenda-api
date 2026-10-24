#!/bin/bash
# Compila Pulso.app en build/ (universal: Apple Silicon + Intel).
# Requisito único: Command Line Tools de Xcode →  xcode-select --install
# Uso:  ./build-app.sh            → build/Pulso.app
#       ./build-app.sh --install  → además la copia a /Applications
set -euo pipefail
cd "$(dirname "$0")"

APP=build/Pulso.app
rm -rf build && mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

FLAGS=(-O -swift-version 5 -framework Cocoa -framework WebKit -framework Security)
echo "→ Compilando…"
if swiftc "${FLAGS[@]}" -target arm64-apple-macos12 mac/main.swift -o build/Pulso-arm64 \
  && swiftc "${FLAGS[@]}" -target x86_64-apple-macos12 mac/main.swift -o build/Pulso-x86_64; then
  lipo -create build/Pulso-arm64 build/Pulso-x86_64 -output "$APP/Contents/MacOS/Pulso"
  rm build/Pulso-arm64 build/Pulso-x86_64
else
  echo "  (sin binario universal; compilando solo para esta Mac)"
  swiftc "${FLAGS[@]}" mac/main.swift -o "$APP/Contents/MacOS/Pulso"
fi

cp mac/Info.plist "$APP/Contents/Info.plist"
cp -R web "$APP/Contents/Resources/web"

# Ícono: AppIcon.png (1024×1024) → AppIcon.icns
if [ -f mac/AppIcon.png ]; then
  ICONSET=build/AppIcon.iconset
  mkdir -p "$ICONSET"
  for s in 16 32 128 256 512; do
    sips -z $s $s mac/AppIcon.png --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
    sips -z $((s*2)) $((s*2)) mac/AppIcon.png --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
  done
  iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"
  rm -rf "$ICONSET"
fi

# Firma local (ad-hoc): suficiente para usarla en tus Macs
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || true

echo "✓ Listo: $(pwd)/$APP"
if [ "${1:-}" = "--install" ]; then
  rm -rf /Applications/Pulso.app
  cp -R "$APP" /Applications/
  echo "✓ Instalada en /Applications/Pulso.app"
  open /Applications/Pulso.app
fi
