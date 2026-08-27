#!/usr/bin/env bash
# Build unsigned device IPA for Sideloadly (re-signs on install).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS="$ROOT/ios"
BUILD="$IOS/build"
APP_NAME="PyreChat"

rm -rf "$BUILD"
mkdir -p "$BUILD"

xcodebuild \
  -project "$IOS/PyreChat.xcodeproj" \
  -scheme PyreChat \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$BUILD/DerivedData" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  build

APP_PATH="$(find "$BUILD/DerivedData" -path "*/Build/Products/Release-iphoneos/${APP_NAME}.app" -print -quit)"
if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "Could not find ${APP_NAME}.app in build output" >&2
  exit 1
fi

PAYLOAD="$BUILD/Payload"
rm -rf "$PAYLOAD"
mkdir -p "$PAYLOAD"
cp -R "$APP_PATH" "$PAYLOAD/"

IPA="$BUILD/${APP_NAME}.ipa"
rm -f "$IPA"
(cd "$BUILD" && zip -qr "$(basename "$IPA")" Payload)

echo "Built: $IPA"
ls -lh "$IPA"
