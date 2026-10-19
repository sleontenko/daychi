# Reminder synchronization preparation — 19 October 2026

Original assignment: [Workshop17](https://github.com/dveyarangi/xuanxue-workshop/issues/17).
Accepted wire: [reminder-sync at 67bb5dde5489a8e6594a9d978e5ed8d3ad703724](https://github.com/dveyarangi/xuanxue-workshop/blob/67bb5dde5489a8e6594a9d978e5ed8d3ad703724/docs/contracts/reminder-sync.md).
This supersedes the former proposed-wire dependency. Implementation, installed-device
coverage and joint proof remain open; this report is a local preparation receipt.

## Source and isolation

Branch `codex/cabinet-reminder-sync-20261019`, isolated worktree
`data/worktrees/cabinet-reminder-sync-20261019`, exact base
`c146326c7ea552772d8c804b3a08ad5637ca5eb0` (merged source main).
The separate default-off native-content PR18 at bb7295f remains with its existing
checkout. No PR18 merge or source publication is part of this preparation.
Historical root WIP and occupied worktrees were not edited or reindexed.

New `apps/practice-app/src/features/cabinet-reminders/protocol.ts` is unmounted.
It validates complete snapshots, exact current account identity, canonical sorted
selection/catalogue ObjectIds, slot/timezone fields and numeric bounds. It preserves
out-of-window or absent-catalogue choices, ignores additive response fields and
returns a detached public projection. Snapshot revision comparison uses decimal
strings, including values beyond JavaScript's safe integer range. Lower revisions
retain confirmed settings; equal revisions refresh school/catalogue metadata.

The encoder emits only version1 specified-key PATCH bodies. It rejects unknown or
missing fields, noncanonical IDs, nonboolean selections, duplicate changed keys,
unsupported leads and batches outside1..64. Canonical output is ASCII and its
maximum64-key form is below128KiB. Cabinet still owns existence checks, transaction
ordering, the resulting50-class bound and authoritative saved snapshots.

This module performs no IO, stores no credentials/settings, schedules nothing,
chooses no local queue size and adds no retries, polling, imports or product UI.
Its snapshot helper is not issuer/session fencing: the future credential owner
must supply the expected account and reject stale issuer/session generations.
Raw provider bodies/identities are not interpolated into errors.

## Executed checks

- Eight new protocol tests passed: empty/complete state, malformed success,
  canonical/complete selections, safe catalogue projection, arbitrary-precision
  revision ordering, equal-revision metadata, deliberate PATCH encoding and
  invalid/oversized-batch refusal.
- All133 app tests passed (125 existing +8 new), `npm run typecheck` passed and
  ESLint passed on both added source/test files.
- The first full app run hit sandbox EPERM binding its existing synthetic HTTP
  fixture to127.0.0.1. The same app suite passed after loopback authorization.
  No real account/provider was contacted by the suite.
- Fixed lockfile dependencies installed in this new checkout using
  `npm ci --offline --ignore-scripts --no-audit --fund=false`; no dependency,
  lockfile, native identity or release metadata changed.
- The required Expo57 versioned SDK reference was read before code changes.

No complete shared conformance row or integrated consumer is claimed from these
protocol-only checks. There is no installed-native/device delivery evidence here.

## Source-grounded next work

| Obligation | Current source / next consumer work |
| --- | --- |
| Authenticated GET/PATCH | `cabinet-account/session-core.ts` owns credentials but base exposes no request hook. Add scoped operations through that owner; map reminder-route envelopes separately, never replay PATCH through renewal. Do not put a bearer in schedule state. |
| Online confirmation / uncertainty | Add a serial controller with confirmed state, refresh-before-new-save recovery after uncertain outcomes, and issuer/account/session/revision fencing. Keep this protocol module independent of IO. |
| Guest/account transition | `schedule/use-schedule.ts` owns device-wide legacy PREFS/CACHE. Add separate issuer/account cache and notification ownership; never upload/normalize guest choices. Explicit logout restores guest state and cancels only account reminders. |
| Real calendar identity | `schedule/cabinet-pilot.ts` and `use-cabinet-schedule.ts` are read-only and separate. Account planning must consume validated Cabinet windows/IDs; successful partial/empty windows replace rows, failed reads retain them. No slot-generated IDs or HTML fallback. |
| Leads / no skips | Legacy `use-schedule.ts` restores only0/15/30/60; `attendance.ts` supports skips. Keep guest behavior independent and implement account0/120/null/default45 without per-date skips. |
| OS capacity | `schedule/reminder-plan.ts` throws above60 before reconciliation; `local-reminders.ts` mounts that planner. Add account queue handling that preserves complete choices and applies removals/moves before replenishment, then measure supported-device coverage. No shared fixed60 cap is accepted. |
| Presentation | Describe account editing/offline/uncertain-save/recovery transitions as a separate synthetic design candidate before touching screens. Retain approved schedule5 and phone/iPad references. |
| Joint proof | Cabinet supplies matching deployed GET/PATCH/web and owner-authorized fixtures. Daychi supplies an identified installed consumer build; publication, fixture mutation and release/activation retain separate approval. |

Next preparation can continue in this exact worktree after checking its state. The
hourly monitor does not run builds again merely because this local work is pending.
No source push, external code artifact, deployment, activation, account/grant/role
change, notification permission change or native/TestFlight upload occurred.
