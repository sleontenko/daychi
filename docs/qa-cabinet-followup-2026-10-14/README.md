# Cabinet / Workshop follow-up · 14 October 2026

The operator requested regular checks and autonomous handling of ordinary technical
assignments/comments, with questions for new product decisions. This check discovered
Cabinet entry/return/logout progress and the accepted public homepage overview.
Shared authority now d689c24af9e848cae8db81e4cc5701f9cb7a610c; its exact #13
BOUNDARY_SUMMARY is installed in both the operator checkout and isolated candidate.
The Cabinet wire, native/private/Zoom/owner/import authority are unchanged.

## Current evidence

[Read-only HTTPS receipt](read-only.json), 16:31 UTC / 19:31 Moscow: staging health
reports e0e823c/Mongo up; anonymous and synthetic-invalid session checks are 401/
no-store with no cookies. Guest entry is 303/no-store to login with encoded path,
query and graph fragment; an external destination is 400/no-store. GET /logout
is 200 without no-store or cookie mutation. Production session check remains 404
without no-store; staging wiki is ConnectError, so reader reachability/TLS is not
established. Health/page cache headers alone are not a session-wire failure claim.
Chrome verifies [guest login controls](staging-login.png) and the [logout page](staging-logout-page.png)
with one «Выйти» button. No sign-in/provider form, logout POST, real account or
credential was submitted or saved. Own test tabs are closed.

## Technical action

Fetched current published Daychi main c7af6f6 and integrated it into the isolated
Cabinet candidate, retaining adb4b76/c7af6f6 archive contracts/import/storage/readers,
legacy DTO format and active-publication metadata. Resolved overlapping Docker/
stage/public-projection changes and regenerated the bundle from merged sources.
This prevents the older d2-based candidate from reverting the newly published
archive. Existing web Cabinet checks, minimal public overview, published Android4
and privacy/retention/restore remain present; mobile checkout/source are untouched.

One meaningful integration regression surfaced: the old Cabinet material projection
would omit archive-specific drive_recording links even after successful authentication.
It now permits those links only for authenticated recording delivery, a known archive
row and the expected Drive host. Default public projection still redacts them,
including mislabeled documents; Zoom and secret-bearing links remain excluded.
A synthetic owner import + actual reader-route test verifies preview redaction,
anonymous material/article refusal, authenticated Drive delivery and redacted public
DTOs. An additional empty/cookie/query variation test addresses the amended preview
acceptance criteria. Early fixture/insertion failures were fixed; final suites pass.

**237 backend / 23 web tests passed**, bundle rebuilt (242.6 KB), repository private-
artifact/credential guard passed. A fresh [61-file source stage](stage-manifest.json)
parses all 27 Python files and contains no DB/env/key/bytecode or QA provider.
APK4 hash is unchanged. No Docker build, source push, PR, DNS/cache write, deployment,
release/import/provider fixture mutation or new Apple status is claimed. Historical
13/14 October QA receipts are retained; 59-file packages are superseded for current
preparation and must not be deployed as if they contained current archive code.

## Remaining work / scheduling

Workshop source review still needs an operator-authorized accessible immutable
candidate/QA; this branch remains local. Matching independent staging reader hosting,
Cabinet-owned authorized accounts and actual login/migration/renewal/logout proof,
production rollout, native public-reader coordination and controlled cache/alias
inventory remain outstanding. The accepted preview exception is a shared policy,
not consumer conformance or release approval. Native #8/#11 and schedule #5/#6
received no new resolution relevant to their known pending evidence in this check.

A proposed hourly, quiet-unless-actionable task prompt is saved in the operator
workspace at docs/handoffs/cabinet-workshop-recurring-check.md. **No automation is
active**: automation_update is unavailable here and computer use refuses Codex UI.
Official Scheduled documentation says CLI cannot manage Scheduled; no private app
storage, cron or custom unattended agent was installed as a substitute. Task creation,
enabled state and next run still need the supported Scheduled interface/tool.

## Published-source review and UTF-8 follow-up · 14 October

Source was published at bdc3cf7 in [draft Daychi PR13](https://github.com/sleontenko/daychi/pull/13)
with explicit operator approval. [Workshop's source review](https://github.com/dveyarangi/xuanxue-workshop/issues/13#issuecomment-6175265222)
resolved the source-access gap, found no shared-contract defect in the inspected
scope and independently reproduced 23 web tests, 39 boundary tests in UTF-8 mode,
the bundle hash and 119 protocol/exposure observations. This is scoped source
review, not deployed joint acceptance. Workshop reported staging 75a6262, production
session-check 404 and unresolved staging DNS at 18:04–18:14 UTC; these are their
observations, not a new Daychi live probe.

Their concrete Windows finding was an unqualified read of the known UTF-8 wiki
HTML. The shell read now explicitly uses UTF-8, so cp1252 is never used to decode
that asset. Four regression cases emulate Windows' default cp1252 at this asset
read on both production/staging and /wiki /wiki/graph: all four failed before the
fix with UnicodeDecodeError and pass afterward, preserving Cyrillic text, profile
marker and UTF-8 response type. This is an emulated default-encoding regression,
not a native Windows execution claim. The shared wire, accepted layout, source HTML,
compiled frontend bundle and release/activation state are unchanged.

Final local checks: **43 boundary / 241 full backend tests passed**. A fresh
61-file stage parses 27 Python files and preserves APK4 hash; [updated module
checksum](utf8-stage-check.json). The previous 23 web-test result remains applicable
because frontend source/bundle is unchanged; no additional UI or Windows-device
acceptance is claimed. The runtime fix is limited to the HTML read. Original QA
and earlier source/local-only checkpoints above are historical. No merge/deployment,
fixture/account/cache mutation, release or complete joint acceptance occurred.
