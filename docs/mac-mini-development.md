# iOS development on Mac mini

Migration started on 2026-09-18 at the owner's request.

## Working locations

- SSH host: `mac-mini`.
- Active app repository: `/Users/mac-mini-server/projects/quiet-practice`.
- Local source/reference: `/Users/samurai/quiet-practice`.
- Legacy ingestion/corpus repository: `practice_bot`. Do not overwrite its local uncommitted work or merge it into the app automatically.
- Live schedule service: `/Users/mac-mini-server/projects/quiet-practice-release`. This is a separate production directory; do not develop there.
- Release backups: `/Users/mac-mini-server/Archives/quiet-practice/quiet-practice-release-{1,2,3,4,5}.xcarchive`.
- Original generated native configuration: `/Users/mac-mini-server/Archives/quiet-practice/native-build5` (Pods, build products and machine-specific `.xcode.env.local` excluded).

## Verified during preparation

- Copied full Git history, retained origin `https://github.com/sleontenko/quiet-practice.git`.
- Local and remote source HEAD: `7e393bd4bf16ad5e07ab311d58856affa19e60a3`.
- `npm ci`, TypeScript, lint and all 14 schedule tests passed on Mac mini.
- `CI=1 npx expo prebuild --platform ios --no-install` succeeded without tracked source changes.
- CocoaPods installed on Mac mini through Homebrew.
- All five release archive copies passed `rsync -acn --itemize-changes` comparison with no differences.

## Still required before declaring native migration complete

2026-09-19 runtime update: the original Xcode 27 build crashed at launch because Expo 57.0.15 lacked the required UIScene lifecycle. On the Mac mini working repository, upgraded within SDK 57 to Expo 57.0.24 and added expo-build-properties 57.0.21 with `ios.enableSceneSupport: true`. app.json, package.json and package-lock.json are modified, uncommitted; MacBook source was not overwritten. Regenerated iOS/pods, rebuilt Release successfully, installed and launched on iPhone 18 Pro / iOS 27.0. Screenshot shows the Today screen with real schedule entries; process remained alive. TypeScript, lint and all 14 JS tests passed. See `mac-mini-xcode27-compatibility.md` for the evidence and scope. Owner Apple Account login and signed archive verification are still outstanding; do not claim TestFlight signing migrated or delete local Xcode yet. Owner explicitly authorized simulator boot and routine migration steps without further questions.

2026-09-19 build verification: iOS 27.0 Simulator runtime (24A434) installed successfully. `pod install` completed. Native `xcodebuild` Release / iphonesimulator / generic destination with `CODE_SIGNING_ALLOWED=NO` and DerivedData `QuietPractice` completed with exit code 0 on Mac mini. Dependency warnings remain; no application source changes were made. All simulators were Shutdown, so permission to boot one was requested per the iOS debugger skill. App launch and smoke checks, physical-device signing and TestFlight are still unverified. Do not remove the MacBook toolchain yet.

2026-09-19 update: administrator setup completed. `xcode-select -p` now returns `/Applications/Xcode.app/Contents/Developer`; Xcode is 27.0 (27A266a); `xcodebuild -checkFirstLaunchStatus` returned successfully. `xcrun simctl list runtimes` is empty. The next step is installing an iOS simulator runtime, then pods/build/run verification. Earlier license/selection blockers below are resolved.

Update from the subsequent storage audit: `/Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild -version` now reports Xcode 27.0, build 27A266a. Installation is present. System `xcode-select` still points at Command Line Tools. Skip reinstalling; continue with selection/first launch and native verification below. Local Xcode is 26.6, so account for the version difference.

1. Xcode installation is present: 27.0, build 27A266a. Latest read-only check still reports an unaccepted license; simulator enumeration is blocked by that license gate. No valid signing identities were found. Pods and the planned `DerivedData/QuietPractice` directory were not found. The earlier incomplete transfer remains at `/Users/mac-mini-server/Archives/quiet-practice/Xcode-transfer-incomplete.app`; do not use it. Local Xcode is 26.6, so native compatibility must be verified before removing it.
2. Verify its version and code signature.
3. On Mac mini, run the following in Terminal, entering the administrator password there:

   ```sh
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   sudo xcodebuild -runFirstLaunch
   ```

4. Install an iOS simulator runtime using Xcode Settings → Components. Prefer only the runtime needed for current testing.
5. Install pods and build:

   ```sh
   export PATH=/opt/homebrew/bin:$PATH
   cd /Users/mac-mini-server/projects/quiet-practice/apps/practice-app/ios
   pod install
   xcodebuild -workspace Tihayapraktika.xcworkspace -scheme Tihayapraktika \
     -configuration Debug -sdk iphonesimulator \
     -destination 'generic/platform=iOS Simulator' \
     -derivedDataPath /Users/mac-mini-server/Library/Developer/Xcode/DerivedData/QuietPractice \
     CODE_SIGNING_ALLOWED=NO build
   ```

6. Launch and smoke-test the app in Simulator on Mac mini. A generic simulator build alone does not prove runtime behavior or real-device notification delivery.
7. For signed archives/TestFlight, configure Apple Developer account/certificate/profile on Mac mini. No signing identity existed during initial check; no private keys were copied. Release still requires owner approval.
8. After native build/runtime verification, remove remaining local Xcode installation and simulator runtimes if no other projects need them.

## Local cleanup already performed

- Removed unused Practice Bot/Quiet Practice DerivedData from `/private/tmp` and Xcode DerivedData.
- Removed Biomatica DerivedData after owner confirmed that project is no longer needed.
- Removed unusable duplicate iOS 26.5 runtime `CAFE6730-BD36-428B-8BFA-6127AC253CBE` through `simctl`.
- Kept local source repositories, signed release archives, working Xcode and working simulator runtimes until native migration verification.
- MacBook free space after this pass: approximately 72 GiB (live value may change).

Do not assume copying Xcode constitutes a completed migration. Check the remaining steps against live machine state.
