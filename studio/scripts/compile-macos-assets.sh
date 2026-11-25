#!/bin/sh
set -eu

# Keep Finder's document badges and the layered app icon in the same catalog.
studio=$(pwd -P)
output="$studio/src-tauri/target/macos-assets"
mkdir -p "$output"
xcrun actool --compile "$output" \
	--output-format human-readable-text --warnings --notices \
	--output-partial-info-plist "$output/Info.plist" \
	--app-icon mac --platform macosx --target-device mac --minimum-deployment-target 15.0 \
	"$studio/assets/mac.icon" "$studio/assets/LogBadges.xcassets"
