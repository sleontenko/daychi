# Cabinet selections and reminders — local implementation

Operator requested implementation19October; verification continued20October.
Implementation commit: `f9cd053126a996611da9b20044cca92d130ecefa`.
Branch `codex/cabinet-reminder-sync-20261019`, parent preparation8c29b73 on main
c146326. Source is local/unpublished. [Original Workshop17](https://github.com/dveyarangi/xuanxue-workshop/issues/17),
[accepted authority c270a198](https://github.com/dveyarangi/xuanxue-workshop/blob/c270a198cffb28c521e1cce70d6da6b5f64a2459/docs/contracts/reminder-sync.md).
Provider shared definitions were compared at Cabinet dda189de. Source/CI progress
in603/604/606 and delivery candidate607 do not establish coordinated deployment.

## Implemented

- Credential-owner GET/PATCH at its fixed matching issuer; no bearer in schedule
  state, cookies, redirects or automatic mutation/renewal replay. Route errors map
  HTTP401/403 into existing native lifecycle without changing its auth parser.
- Serialized online confirmed saves, uncertain-outcome authoritative readback,
  Retry-After, complete snapshot validation and revision ordering. Epoch/account/
  issuer/grant fencing also covers asynchronous native network preflight.
- Separate account cache and grant-to-account cache binding; guest choices are
  neither converted nor uploaded. Guest reminder work is paused/fenced while the
  account owns the calendar; explicit logout cancels account reminders and restores
  guest operation. Authentication failure retains confirmed cache read-only.
- Cabinet public calendar replaces account window rows after success, including
  empty arrays, and retains good rows after failure. Selections outside that window
  or missing catalogue remain removable. Class/individual union has no date skips.
- Personal0/15/30/60/120 and actual school default; device delivery stays local.
  Bounded earliest-first queue removes obsolete/moved/cancelled entries before
  refill and never truncates account choices. Current policy schedules at most60
  pending account entries, respecting other pending iOS entries within64. This is
  a device queue policy, not an account selection limit or unlimited-delivery claim.
- Existing phone/iPad parent navigation, settings and split panes host a separate
  [account UX candidate](../../design/candidates/cabinet-reminders-2026-10-19/README.md).
  The school-date key function reuses the already published PR18 Gregorian/Latin
  correction; no new diagnosis of the earlier physical network incident is made.

Default off: `EXPO_PUBLIC_CABINET_REMINDERS_ENABLED=0`. Enabling also requires the
existing native account flag. Use the account's issuer; no separate sync origin.
Native dependency expo-network~57.0.2 matches the installed Expo57 manifest and
provides actual connectivity refusal/listening. No identity or release metadata changed.

## Executed verification

- All159 app tests pass: existing account/loopback HTTP and guest/reader regressions,
  protocol checks and new controller/transport/queue cases. TypeScript and full
  Expo lint pass. Initial sandbox HTTP listeners failed with EPERM; the same suite
  passes with local loopback authorization. No real provider/account in these tests.
- Cases cover offline/no intent replay, specified-key serial saves, committed lost
  responses plus concurrent readback, malformed/lower success, equal-revision
  metadata,429 delay, explicit logout, other issuer/account/grant/generation,
  cache-hydration race, unknown grant binding, invalid IDs and refusal recovery.
- Normal Router/Hermes iOS off/on and Android on exports pass. [Hashes and marker
  checks](exports.json) show no QA account/token/origin/entry strings in the bundles.
  Temporary package main/Metro overrides were restored exactly. Source guard passed
  on633 staged implementation files; later documentation is scanned separately.
- A new local iOS Debug container built successfully with actual expo-network.
  Installed full-parent iPhone/iPadOS27 tests used only the local synthetic server
  and in-memory account/storage shims. Actual network module reported connected
  ETHERNET/reachable. This is not a real Cabinet credential/HTTPS/account test.
- iPhone: actual class selection, separate individual selection with a committed
  lost reply, disabled edits during uncertainty, explicit readback recovering both
  choices, My Classes and tab/detail navigation. React Compiler initially cached a
  nonreactive canEdit getter: installed UI exposed disabled controls after successful
  loading. Reactive derivation fixed it and actual selection/readback then passed.
- iPad: installed parent/sidebar and split panes, portrait/landscape, regular and
  individual choices, absent catalogue/out-of-window IDs, nested Settings/Back,
  school-default45 and saved120-minute lead. The real pending-notification API
  confirmed60 entries for100 future eligible rows. After first-row cancellation and
  actual Home/icon foreground return, that ID disappeared and ID61 refilled its
  place, still60. Successful empty calendar removed all pending entries while both
  selected classes and both individual IDs remained. Explicit logout returned the
  guest UI, cleared transient account state and left zero account notifications.

Raw synthetic receipts/journal remain ignored in root
`data/reminder-sync-20261019`. Public-safe summary is [device-queue.json](device-queue.json).
Original synthetic screenshots are in [screenshots.tar.gz](screenshots.tar.gz),
verified against [screenshots.json](screenshots.json). The unchanged build5 reference
is in [screenshots/](screenshots/). Comparison retained day groups/time column, palette,
parent safe areas/sidebar and split pane. Oversized week navigation initially
wrapped; replaced with the existing compact arrow/date-range arrangement. New
account controls remain a development candidate, not a promoted design reference.

The Xcode input driver reported taps without navigation on the selected device;
those attempts/timeouts are excluded. Device Hub actions and correct-device
screenshots/readbacks supplied the actual UI evidence. Native launch first failed
because Metro bound IPv6 localhost while launch selected127.0.0.1; using localhost
loaded normally. Build warnings originate in dependencies; no compiler error.

## Limits and next acceptance

No Android device/adb was available in the current inventory. Android JS export
passes; installed Android Back and queue measurements remain before binary
acceptance. Physical notification delivery/suspension, every new error-state visual
pair and populated guest cold-start transitions are not claimed from the installed
run. Pure controller/storage tests and the documented UI subset have distinct scope.

No Cabinet web/native joint save, real fixture mutation, code push, main merge,
runtime activation, deployment or TestFlight upload occurred. Cabinet still owns
web validation/Retry-After correction, seeding/legacy writer separation, delivery
and coordinated deployment. Those enable joint acceptance, not local development.
Next material-access preparation is [native-content-next.md](native-content-next.md).
Do not repeat accepted account8 or schedule6 evidence.

Consolidated progress was reported in the original assignment:
[Workshop17 receipt](https://github.com/dveyarangi/xuanxue-workshop/issues/17#issuecomment-6277450997).
The report explicitly identifies local/unpublished source and the limits above.
