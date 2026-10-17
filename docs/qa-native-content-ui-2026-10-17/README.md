# Native Cabinet reader mounting — 17 October 2026

Continuation of [PR18 preparation](../qa-native-content-current-2026-10-17/README.md)
under [Workshop16](https://github.com/dveyarangi/xuanxue-workshop/issues/16) and
native-content-session@a07f08747aa7d97e4d3496e87e1d8319db413698.
The operator requested connecting the adapter to the current wiki screen and
finishing consumer work. The earlier unmounted preparation statements describe
the preceding source; this update mounts a distinct, explicitly enabled host.

## Behavior

EXPO_PUBLIC_CABINET_CONTENT_ENABLED=1 selects CabinetWikiScreen on native platforms.
Account opt-in is also required. Flag-off native and browser use their previous
hosts. The public allowlist remains unchanged. Credentials/profile stay native;
the private bridge accepts only its nine read routes and validated query options.
Every backend read still performs the fixed-profile authoritative Cabinet check.

The current shared library, structured material/concept pages, Sigma graph,
bookmarks and recent-ID storage keys are retained. Before SPA navigation, a fresh
protected category read validates retained catalog data. Article caches are cleared
on each protected route; external recording/source opening requires a fresh read
of its originating DTO and an exact current URL match, including rendered timecodes.
No arbitrary URL or Cabinet-authorized Zoom opening is accepted.

Account changes, renewal/checking, logout, background, inactive tab and private-read
failure invalidate the host generation and destroy its WebView. Late responses
cannot repopulate it. Same-account restoration retains bounded in-memory hash,
query/filter, scroll, navigation stack and graph camera metadata, then reloads
through authoritative reads. No private body/recording URL/profile is persisted.
Optional structured article404 retains the existing v1 fallback without treating
the account as unavailable. Invalid401 clears the matching current credential;
blocked403 and temporary/rate failures retain it and expose recovery UI.

Online-class entry opens a separate legacy-authorized Zoom-only sheet. Cabinet
success alone shows the existing legacy access prompt. Each actual Zoom opening
would recheck legacy access; no live meeting was opened during these checks.

## Executed checks

- **292 backend tests**, **141 app tests**, **31 shared wiki tests**, TypeScript and Expo lint passed.
  New cases exercise generation teardown/late replies, source exact-match and
  removed-source refusal, timecode binding, optional404, checkpoint/account isolation
  and retained native Back history. Existing native/public boundary tests pass.
- Both shared bundles regenerated; normal Expo Router iOS/Hermes exports with
  Cabinet content disabled and enabled passed (see [hashes](export-receipt.json))
  after restoring package.json and removing the temporary QA Metro configuration;
  neither bundle contains the synthetic fixture token, loopback origin or QA entry.
- Actual iOS27 Simulator Debug containers ran the actual protected component and
  generated WKWebView on a dedicated iPhone and a clean dedicated iPad13-inch.
  The fixture used actual session-core/client and mounted FastAPI aliases with a
  synthetic provider; only the fixture transport resolves backend.test to loopback.
  No real Cabinet credential, account acquisition or private corpus was used.
- Native container WebView linkage was initially missing; local pod install repaired
  the ignored container. Ignored generated tablet settings were reconciled to existing
  app.json. Final iPhone/iPad builds succeeded with existing third-party warnings.
  No dependency/configuration/build-number change was committed.
- Phone: sign-in gate/account entry, library, structured material, saved state,
  graph/WebGL, inactive-tab teardown/return, real Home/foreground return,
  cold-launch bookmark retention, invalid401, blocked403, offline503,
  provider429→Daychi503 with disabled seven-second retry and recovery all observed.
- iPad: library, material, inline concept/Back, portrait→landscape material retention,
  final width-bounded sign-in gate and logout clearing observed. The gate was narrowed
  to600points after the first tablet capture; final screenshot23 records that fix.
- Independent Zoom sheet refused Cabinet-only access and displayed only synthetic
  Zoom data after separate legacy authorization. The material/article route never
  received the Zoom payload through the Cabinet transport.
- The route-only loopback journal recorded native graph/categories/material/article
  reads200, categories401/403/503 during refusal/failure, concept-article200 and a
  separately authorized legacy material200. It logged no credentials or bodies.

The first sandboxed full app run could not bind existing loopback tests (EPERM).
The exact app-test command rerun with loopback permission passed141/141. Narrow
machine-local command rules were installed separately at the operator's request;
no security configuration or rule file is part of this PR.

## Visual evidence and limits

The [state/transition candidate](../../design/candidates/native-cabinet-reader-2026-10-17/README.md)
precedes implementation. Current owner-selected Claude iteration3 markup, graph
and existing phone/iPad composition are retained; schedule build5 is untouched.
Private accepted library390/reader360 references were compared alongside native
runtime captures locally. Their corpus frames remain outside Git. Synthetic
replacement text, counts and missing fixture dates are not new design references.

Published [capture hashes](screenshots.json) cover only synthetic runtime frames:

| State | Evidence |
| --- | --- |
| Phone signed out | [01](screenshots/01-signed-out.jpg) |
| Material, saved and restored | [04](screenshots/04-tab-restored.jpg) |
| Temporary failure / recovery | [05](screenshots/05-offline.jpg), [06](screenshots/06-recovered.jpg) |
| Blocked / rate delay / invalid | [07](screenshots/07-blocked.jpg), [08](screenshots/08-rate-delay.jpg), [14](screenshots/14-invalid-token.jpg) |
| Graph / independent Zoom gate | [09](screenshots/09-graph.jpg), [15](screenshots/15-zoom-independent-locked.jpg) |
| iPad library / article / concept | [19](screenshots/19-ipad-library.jpg), [20](screenshots/20-ipad-article.jpg), [21](screenshots/21-ipad-concept.jpg) |
| iPad landscape / final logout gate | [22](screenshots/22-ipad-landscape.jpg), [23](screenshots/23-ipad-final-gate.jpg) |

The small top toolbar is fixture-only and never included in normal Expo Router
exports. Installed checks cover the actual protected component, not the complete
production ScheduleScreen/Expo Router entry sequence. Android hardware Back logic
uses the retained native history, but Android runtime was unavailable. Exact graph
camera restoration under an arbitrary drag and all full-parent navigation paths
remain binary-acceptance QA. No new design reference is promoted. No physical-phone
installation/notification-delivery claim is made.

## What remains before activation

Daychi source is now mounted and locally verified, default off. Cabinet15 still
owes deployed source/capacity proof C09–C12 and authorized staging fixture access.
Then execute the real protected material/recording read, next-read grant revoke
refusal with other grant/browser surviving, and authorized block/outage/recovery
observations. The synthetic run is not a substitute for that joint evidence.
No provider acceptance, runtime activation, production deployment, PR merge or new
native/TestFlight release is claimed. Existing externally available build18 is unchanged.
Web13 temporary-origin/DNS and shared selections/reminders17 remain separate.

Reproduction: [isolated fixture instructions](../../scripts/qa-native-reader/README.md).


## Later full-parent continuation

The [full native navigation report](../qa-native-navigation-2026-10-17/README.md)
supersedes the earlier full-parent/Android/dragged-camera QA limitations above.
It records three fixes, actual phone/iPad/Android checks and preserved activation
gates. The preceding component-only observations retain their original scope.
