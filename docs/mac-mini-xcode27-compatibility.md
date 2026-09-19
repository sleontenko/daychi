# Quiet Practice: Mac mini / Xcode 27 migration

Date: 2026-09-19. Working repository: `/Users/mac-mini-server/projects/quiet-practice`.

## Verified failure

The first Release simulator build completed, but two real launches on the iOS 27.0 simulator exited immediately. UIKit logged `UIScene life cycle is required for apps built with this SDK`. Screenshot showed SpringBoard, not a functioning app. Therefore the first successful build did not prove the migration complete.

MacBook uses Xcode 26.6; Mac mini has Xcode 27.0 (27A266a). The previous locked Expo version was 57.0.15. The simulator device used for verification is iPhone 18 Pro, `DC75CEAF-7FCA-410C-99AA-B1843D8B39D2`.

## Compatibility change on Mac mini

- Updated Expo within SDK 57 to a patch supporting scene lifecycle (minimum 57.0.23).
- Added `expo-build-properties` and configured `ios.enableSceneSupport: true` in `apps/practice-app/app.json`.
- Regenerated the ignored native iOS project using Expo prebuild; installed pods.
- Changes are limited to app.json, package.json and package-lock.json; no product UI changes, no version/build-number bump, no TestFlight upload, no commit or push.
- TypeScript, lint and all 14 schedule JavaScript tests passed after the change.
- Installed versions: Expo 57.0.24, expo-build-properties 57.0.21. Release rebuild for iphonesimulator completed with exit code 0.
- Installed and launched the rebuilt app. PID 12823 remained alive after 21 seconds; screenshot `quiet-practice-mini-running.png` visibly shows the Today screen with the dated class schedule. The earlier UIScene launch crash is fixed. This is a startup smoke check, not full navigation/notification/device QA.

Official compatibility guidance: https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md#staying-on-sdk-57-with-xcode-27 and https://docs.expo.dev/versions/v57.0.0/sdk/build-properties/ .

## Remaining gates

Latest verified result (2026-09-19): owner allowed codesign to access the imported key. Archive retry completed with **exit 0**. `/Users/mac-mini-server/Archives/quiet-practice/migration-import-validation-20260919.xcarchive` is 169 MiB. `codesign --verify --deep --strict --verbose=2` passed on Products/Applications/Tihayapraktika.app. Identifier is ai.mypraxis.quietpractice, team 92HWGZCSS4, authority Apple Development: Stanislav Leo (Z6H8Z58FR2). Thus simulator startup, device archive compilation, and development signing are verified on Mac mini. App Store distribution export/upload and real-device QA have NOT been verified; do not equate development archive success with TestFlight delivery. No local Xcode deletion performed at this milestone.

Update after manual export/import on 2026-09-19: the GUI import failed with OSStatus -26276 while Local Items was selected. Explicit `security import` into the login keychain completed with exit 0 after the owner entered the export passphrase locally. The transferred identity SHA-1 42972EC942805ACFE116ECAFCFB8A3633931894B is now reported as **valid** on Mac mini. No certificate was revoked. The GUI-session archive retry is running; result files are `/private/tmp/quiet-practice-signing.YpeSCt/archive.log` and `archive.exit`. Target archive: `migration-import-validation-20260919.xcarchive`. Temporary encrypted export copies still need cleanup after successful verification; do not expose passwords or private-key material.

After owner entered the login-keychain password, the GUI archive retry exited 65 with a different error: Apple reports an existing Apple Development certificate for this machine, but the corresponding private key is absent from the mini keychain. Xcode suggested revocation; **no certificate was revoked**. Missing provisioning profile is also reported. Prefer transferring the existing appropriate signing identity from MacBook, if present, rather than revoking anything. Simulator development remains working.

Owner confirmed Apple Account login. First signed archive attempt over SSH failed with `User interaction is not allowed` and a missing development provisioning profile. Opened `/private/tmp/quiet-practice-xcode-setup.X3yDGK/verify-signing.command` in Terminal on Mac mini: it unlocks the login keychain interactively, then retries archive with `-allowProvisioningUpdates`, team 92HWGZCSS4, without export/upload. Result will be in `/private/tmp/quiet-practice-gui-signed-archive.exit` and `.log`. Do not assume this succeeded until checked. Existing export-options.plist has destination `upload` and MUST NOT be used for a local export test unchanged.

- Startup smoke check passed. Broader navigation, selection persistence and real-device notification checks remain separate from this startup result.
- Verify signing on Mac mini: `security find-identity -v -p codesigning` currently reports zero valid identities. Owner must sign in to Apple Account in Xcode; never send passwords or 2FA to chat.
- Verify a signed device archive before claiming TestFlight capability has migrated. Publishing is a separate owner-approved action.
- Keep MacBook Xcode until the user's condition (working full migration) is met.
- In Xcode 27 the simulator UI is `/Applications/Xcode.app/Contents/Applications/DeviceHub.app`, not the old `Developer/Applications/Simulator.app` path.
