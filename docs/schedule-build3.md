# Build 3: restore the schedule experience

## Scope and decisions — 2026-09-17

User rejected the build-2 technical screen, manual device code and TLS failure.
Restore the approved organic prototype's visual language and implement the
website timetable → select dated classes → saved choices → iOS reminders flow.

- Reuse prototype typography, colors, weekly rows, day chips and bottom navigation.
  The functional release exposes Today / Schedule / My classes. Mock Map/Wiki and
  mock practice progress remain in `/prototype`, not presented as real features.
- Use local, date-based iOS notifications instead of requiring manual APNs pairing.
  One system permission prompt; configurable 0/15/30/60-minute lead; test button.
  Never claim automatic Telegram cancellations or background timetable updates.
- Native loading races two HTTPS paths: existing isolated server and the school's
  public HTML. Both validate seven weekday blocks and preserve server occurrence
  IDs. No TLS bypass, DNS migration, credentials or private Telegram data involved.
- Cache shows its actual timestamp offline. Selected dates remain available;
  notifications already scheduled on iOS work while the app is closed.
- Existing paired build-2 devices must acknowledge server opt-out before scheduling
  local reminders, then retire the old local credential to avoid duplicate delivery.
- iOS notification capacity capped at 60; no undated infinite weekly repeats.
  If the chosen lead time has already passed, UI tells user to choose at-start.

## Verification so far

- All three public Funnel relays returned HTTPS health 200. Earlier screenshot's
  TLS error is real but not reproducible consistently; do not call root cause fixed.
  The independent direct-source path removes that single point of failure.
- Live HTML and server import agree on all 60 occurrence IDs, titles and instants.
- 12 JS tests pass: parsing, source drift, DST, stable IDs after move, reminder
  planning, idempotency, rescheduling, deselection, failure propagation.
- TypeScript and Expo lint pass. 36 relevant backend tests pass (backend unchanged).
- Browser select → My classes → reload preserves choice.
- Signed Release simulator (iPhone 17 Pro / iOS 26.5) loads the live timetable.
  First selection asks standard iOS permission, creates one pending notification,
  survives process termination/relaunch, changes lead without duplication, and
  deselection reduces pending count to zero. Test date notification delivered on
  the simulator lock screen while the app was backgrounded.
- Native direct-source fallback verified with the server URL deliberately compiled
  as `https://schedule-unreachable.invalid` (simulator only): embedded bundle
  confirmed the override; timetable refreshed from the school at 22:08 Israel time.
  Production archive must explicitly restore the actual Funnel URL.
- Signed device archive succeeded at `/private/tmp/quiet-practice-release-3.xcarchive`;
  verified bundle ID `ai.mypraxis.quietpractice`, build `3`, production Funnel URL
  (no test override), and code signature. Export/upload completed with exit 0,
  `Uploaded Tihayapraktika` / `EXPORT SUCCEEDED`. Apple processing completed;
  build `27740b08-c0ff-4737-82d8-e7b449f1570c` is **Testing** in the existing
  `Личное тестирование` group (two testers, including `ddrboss@gmail.com`). Russian
  What to Test saved with no-code steps and explicit Telegram/date limits.
  User's previous build 2 remains installed until they update; build 3 receipt on
  their phone is not claimed. Export remains internal-only for team `92HWGZCSS4`.
- Simulator evidence: [schedule](qa-build3/schedule-ios.jpg),
  [saved dated class](qa-build3/my-classes-ios.jpg),
  [delivered notification](qa-build3/notification-ios.jpg).
  Calendar day 14 and notification off/on also verified; test class choices removed
  afterward (zero class reminders remain on the simulator).

## Remaining limits

Telegram exceptions remain unintegrated. Local notification contents update only
when the app runs and successfully refreshes. No receipt on the user's physical
iPhone claimed until they test the new build. Existing transitive dependency audit
findings and missing third-party dSYMs remain follow-ups.
