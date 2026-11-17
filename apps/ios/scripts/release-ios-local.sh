#!/usr/bin/env bash
# Local App Store build -> .ipa, opened in Transporter (replaces EAS build + submit; user 2026-11-17).
# Needs: Xcode signed in to the Apple Developer account (Settings > Accounts).
# Usage: scripts/release-ios-local.sh <buildNumber>   (must be higher than the last upload; #5 was EAS)
set -euo pipefail
BN="${1:?usage: $0 <buildNumber>}"
cd "$(dirname "$0")/.."
# CocoaPods crashes (Encoding::CompatibilityError) in a non-UTF-8 shell.
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

# ios/ is generated (gitignored): refresh it from app.json + plugins. expo
# prebuild swallows a failed pod install, so run it ourselves to fail fast.
npx expo prebuild --platform ios --no-install
(cd ios && pod install)
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BN" ios/MangoPet/Info.plist

rm -rf build/release
xcodebuild -workspace ios/MangoPet.xcworkspace -scheme MangoPet -configuration Release \
  -destination generic/platform=iOS -archivePath build/release/MangoPet.xcarchive \
  DEVELOPMENT_TEAM=5HGWLK54MK CODE_SIGN_STYLE=Automatic CURRENT_PROJECT_VERSION="$BN" \
  -allowProvisioningUpdates archive
xcodebuild -exportArchive -archivePath build/release/MangoPet.xcarchive \
  -exportPath build/release/ipa -exportOptionsPlist scripts/ExportOptions.plist -allowProvisioningUpdates

IPA=$(ls build/release/ipa/*.ipa)
echo "Built $IPA (1.0 build $BN). Opening Transporter — sign in and press Deliver."
open -a Transporter "$IPA"
