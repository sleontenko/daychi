# Full native navigation QA — 17 October 2026

Continuation of [mounted PR18](../qa-native-content-ui-2026-10-17/README.md),
parent source `85c1812d9f65a627b8c5c9344ab88a4a05d9dc71`. This closes the disclosed
full-parent, Android Back and dragged-camera recipient QA gaps. It does not enable
Cabinet content or authorize a release. The full Expo Router entry, `_layout`,
ScheduleScreen, SettingsScreen, schedule model/storage and protected WebView ran
on installed development containers, with isolated synthetic transport/account data.

## Found and fixed

1. A resumed graph camera was overwritten by the initial asynchronous layout's
   fit animation. Restoration now waits for that initial layout even when the
   router reports the graph as already restored, checks the current generation/
   route, and replaces the pending fit animation. Ordinary fit behavior is retained.
2. WKWebView did not reliably retain `history.state.wikiScroll` after rebuilding
   the private host. The native checkpoint now supplies initial scroll directly;
   browser history remains the fallback. Long synthetic articles return to the
   exact saved offset after a main-app tab change.
3. With native Cabinet content enabled, the privacy introduction still promised
   wiki access without sign-in. That variant now describes Cabinet sign-in without
   a separate application for materials. The flag-off/browser policy is unchanged.

No navigation redesign, storage-key/bundle-ID/scheme change, backend authorization
change, new eligibility rule or Zoom admission change is included.

## Executed navigation

| Area | Actual result |
| --- | --- |
| iPhone main app | Schedule → lesson → weekly selection → My Classes; nearest date, skip/restore, one-off date, retained series outside the loaded 14-day window and recovery passed. Schedule detail/filter and tab return were retained. |
| iPhone settings | Nested About/Privacy/Back, reminders, access-data entry and unsent feedback draft retention passed. Cabinet entry worked both inside Settings and through the Router gate. |
| Direct entry | `quietpractice:///?tab=wiki` opened the expected wiki gate; sign-in and Back returned to the requested reader. The iOS Open-app confirmation was handled. Accepted live account8 evidence was not repeated. |
| iPhone reader | Material → inline concept → Back, saved material, root-toolbar hiding in detail, tab return, search draft/empty results/reset, long-article scroll and graph drag/return passed. |
| iPad full parent | Side panel and landscape two-column Schedule/detail, empty My Classes, weekly series, nearest/skip/restore, one-off date and series outside the loaded window passed. Nested Settings/About/Privacy/Account/Back returned correctly. |
| iPad reader | Library/material/concept/Back, saved state, long-article scroll, dragged graph, portrait/landscape safe areas, main-app tab return and real Home/icon foreground return passed. A synthetic authoritative403 removed private content; active/retry restored reading. |
| Android API36 | Installed Debug APK ran the full Router/parent UI. Schedule detail/system Back, Day/Calendar, reminders, nested About/Privacy Back, account gate/login/logout Back, unsent feedback draft, material/concept/Back, independent Zoom gate/Back, saved/graph Back passed. |
| Android final source | A single33-command run passed material → concept → system Back, scroll/tab return, bookmarks, graph drag/tab return, system Back and nested Cabinet privacy. Exact numeric restoration was also recorded. |

The [numeric receipt](restoration.json) records camera equality on all three devices
and scroll equality at377px (iPhone),1988px (iPad), and443.4285583496094px (Android).
The baseline camera check failed: x0.07407209743671878/y0.6233885822011462 returned
as x0.5/y0.5. The baseline iPad scroll check failed:1988px returned as0px.
Both before/after failures and successful fixes were observed in installed UI.

## Verification and artifacts

- **292 backend /141 app /31 wiki tests passed**, with TypeScript and Expo lint.
  The app tests require loopback permission; the initial sandboxed listener failed
  with EPERM, and the exact command passed after local loopback authorization.
- Both shared reader bundles regenerated. Normal Expo Router iOS/Hermes exports
  with content off/on passed after restoring package.json/removing the temporary
  Metro override. [Export receipt](exports.json) includes hashes and absence of
  fixture token/origin/entry markers. No version or dependency changed.
- [Synthetic screenshot archive](navigation-screenshots.zip) and its
  [per-file hashes](screenshots.json) preserve original captured PNG/JPEG files.
  No private corpus frames, live account details or credentials are included.
- Current Claude iteration3 reader/graph and build18 parent composition were
  compared locally; schedule build5 remains the accepted reference. Private
  reference/runtime pairs remain outside Git; this synthetic fixture is not a new
  design reference. See [visual mapping](visual-pairs.json).
- [Final Android flow](flows/android-final.yaml), [phone verification flow](flows/phone-final.yaml)
  and [full fixture reproduction](../../scripts/qa-native-reader/README.md).

The iOS automation service incorrectly reused its phone driver for an iPad device
argument. Those attempts were excluded. iPad checks used Device Hub with the
explicit tablet selected, visible UI/AX actions and tablet-specific simctl captures.
Several exploratory assertions also expected a library or a top Back button while
the correctly restored reader was in another wiki tab or already scrolled. Those
failed assertions were corrected; they are not counted as passed complete flows.

A development LogBox toast initially covered the phone tab bar. An experimental
parent-tab change was reverted completely after identifying that cause. Only the
fixture entry suppresses the known benign multiple-scheme development warning.
The ScheduleScreen product source is unchanged from the parent.

## Remaining release/activation gates

Navigation preparation is complete within this synthetic installed-device scope.
No physical-phone notification delivery, live recording opening, release archive,
TestFlight upload, production activation or end-to-end Cabinet-content acceptance
is claimed. Local notification permission on the dedicated iPad was granted only
after explicit operator approval. No messages/forms were submitted externally.

[Workshop's mounted-source review](https://github.com/dveyarangi/xuanxue-workshop/issues/16#issuecomment-6238564666)
accepts inspectable consumer progress and preserves account8 acceptance. Cabinet15
still owes deployed grant-isolated capacity and matching owner-authorized fixtures
before real material/recording delivery, next-read revoke/isolation and authorized
failure/recovery joint proof. Keep the content addition disabled until then.
Browser13/DNS and shared selections/reminders17 remain separate work.
