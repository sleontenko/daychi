# Cabinet source synchronization — 17 October 2026

The operator requested an audit and Git synchronization before the next app/design version.
This isolated candidate combines existing published branches and recovers omitted release
source. [Published draft PR16](https://github.com/sleontenko/daychi/pull/16), source commit
883f5d6cc1b69cbc8da8dbc9c18ba0a6c97aa8a3. The initial permission blocker is resolved. It does not deploy, activate SSO/content access, merge main or upload a new app.

## Current functionality and unfinished work

| Area | Verified state | Remaining work |
|---|---|---|
| Native Cabinet account | Workshop accepted client and complete joint-native outcome in [#8](https://github.com/dveyarangi/xuanxue-workshop/issues/8#issuecomment-6234027930), tested d1a85fe / Debug18 / staging5ea9a8b. Account/protocol/callback source is preserved exactly. | No recipient work remains for accepted #8. A new changed binary needs its own release validation. |
| Cabinet schedule | Read-only dated-lesson source retained alongside School. Anonymous staging GET returned200 and64 rows for17–31October school midnights, including the DST offset change. Internal TestFlight18 availability was freshly checked in the preceding release task. | [#6](https://github.com/dveyarangi/xuanxue-workshop/issues/6#issuecomment-6213541453) is still open: remaining version-bound native/ordinary-state proof and the separately unresolved live corrupt-row case. Manual refresh meets the present contract; foreground refresh is [Daychi14](https://github.com/sleontenko/daychi/issues/14). |
| Standalone web wiki | Published opt-in consumer from PR13 is included. Fresh staging Cabinet /api/auth/session returns401/no-store anonymously; direct Daychi staging health/minimal preview200/no-store. | Canonical wiki.staging.xuanxue.su still has no DNS result; production Cabinet check404. DNS owner/private verification handoff, TLS, authorized joint browser/account/renewal/logout and reader/cache cutover remain [#12/#13](https://github.com/dveyarangi/xuanxue-workshop/issues/13#issuecomment-6179412624). Production wiki HTML200 does not prove SSO. |
| Protected wiki in native app | Accepted account login remains separate from content authorization. The original build18 public/native reader and legacy protected link path are retained. | Uncommitted opt-in candidate for [#16](https://github.com/dveyarangi/xuanxue-workshop/issues/16) remains in its occupied native-content worktree; its36 changed/new files were hash-inventoried and not modified/copied into this candidate. Paired Cabinet capacity/provider [#15](https://github.com/dveyarangi/xuanxue-workshop/issues/15), actual mounted joint proof and activation remain. |
| Selected lessons/reminders | Existing device storage and local OS reminder path retained. | Shared account synchronization awaits the full executable contract in [#17](https://github.com/dveyarangi/xuanxue-workshop/issues/17). The public schedule pilot is not selection synchronization. |

Operator requires retaining the staging Teacher/Developer roles. No account, role,
grant, fixture, DNS or production data was changed. No recurring automation is claimed.

## Consolidated source

- Base main: c7af6f6682d86618f258129b457db9c6c35698e6.
- Web boundary: PR13 / dfed3203c3c8b55ed077a07ed456d02704ae7e2a, including published server/site privacy/retention/restore sources.
- Archive label: PR12 /03b110d6e63c3b3dc9de1c31a794a4d0e19a2293.
- Accepted native account and schedule: PR15 /d1a85fe28e86b60ca6271a2e75871d6360b9f25a.
- Missing native implementation/tests restored from sanitized historical build18 source da5570347d7b23de7cf3e56a472859cba33b3d1b: privacy/delete, settings, shared WebView reader, recording redaction and iPad configuration. Existing dependency versions/lockfile restored; no upgrades or new build number.
- [Native source parity](native-source-parity.json):81 of82 public app implementation/configuration files match the archive byte-for-byte. The only difference is native-html.ts, rebuilt from the newer shared reader. Current structured articles, Cabinet browser safeguards and archive labels are retained rather than reverted to the older archive.
- The sole branch-merge conflict was the generated web graph bundle; it was rebuilt from the automatically merged source. No generated catalog, corpus, Zoom, credentials, native build or private QA frames were copied.

The account/schedule release opt-ins retain their existing defaults and staging origins;
the web opt-in stays off. Historical uploaded build18 used explicit staging/account flags.
This source branch does not identify the installed binary from the16October iPhone
schedule report. The full tested account source/evidence and its acceptance remain pinned.

## Local WIP and Git

Root main remains at5f9ba44,17 commits behind fetched origin/main, with64 tracked
changes and456 untracked files (520 total). It is occupied historical WIP and was not
stashed, reset, switched or overwritten. [Area inventory](workspace-summary.json):91 files
already match this consolidated candidate exactly;429 retain different/local content,
mostly historical design/QA/documentation plus older backend/editorial preparation.
They are preserved, not silently committed or declared unfinished product features.

Full file/hash inventories for root and the occupied native-content checkout stay in
ignored local data/git-sync-2026-10-17. Existing source branches and worktrees are retained.
Old editorial scripts in root are historical remnants; new editorial work belongs to
Daychi Knowledge and is not being republished into the app repository.

Use codex/sync-cabinet-baseline-20261017 for the next source review/design task.
Source publication and local/remote tree equality are confirmed below. This does not claim
that main or every local historical QA file has been synchronized/cleaned. Original
PR12/13/15 remain open; this candidate contains their exact published heads for review.

## Verification and release limits

[Executed checks](validation.json):241 backend,125 app and30 shared-web tests pass;
TypeScript/Expo lint pass; merged web bundle and native UI regenerated. iOS JavaScript/
Hermes export succeeds. Tests used existing local dependency installations via ignored
symlinks; fresh-install Node22 GitHub CI is recorded separately after publication.
The initial app HTTP suite needed loopback permission outside the sandbox, then all125
passed. Existing Node module-type and Starlette deprecation warnings remain.

[Anonymous runtime receipt](anonymous-runtime-check.json) contains no credentials or
protected data. No successful native scenario from accepted #8 was repeated.

Fresh synthetic Chrome checks compare the inherited web reference and merged reader
at390x844. Library/article composition is retained; the expected runtime logout link
uses Cabinet. [Library reference](screenshots/reference-library-390.png) /
[runtime](screenshots/runtime-library-390.png), [article reference](screenshots/reference-article-390.png) /
[runtime](screenshots/runtime-article-390.png). [Invalid-session refusal](screenshots/runtime-refused-390.png)
clears content and retains the article destination in Cabinet entry; [recovery](screenshots/runtime-recovered-390.png)
returns to the reader. All visible material/recording identifiers are synthetic fixtures.
Temporary browser tabs/server are removed after this check.

Fresh phone/iPad/Android UI/navigation/reference pairs for the fully consolidated
native candidate are still required before binary acceptance. Automated checks,
source parity and browser-sized screenshots do not establish a native install,
physical notification delivery, production SSO or a new TestFlight release.


## Historical publication blocker — resolved after operator reauthorization

Source reconciliation is committed locally at4ad34ed and this clean isolated branch
is ready for publication. `git push` could not obtain HTTPS credentials; the saved
terminal GitHub login is invalid. The available GitHub connector separately returned
403 “Resource not accessible by integration” for its Git blob write operation.
No write alternative was attempted after that explicit permission denial. No remote
branch, PR, main merge, deploy or release was created/changed by this attempt.
[Sanitized access receipt](publication-status.json).

The remaining Git step requires restoring operator-authorized repository write access,
then pushing this existing branch and opening the draft PR. All source/QA preparation
is complete locally. Remote CI and remote branch equality are **not verified** and
must not be claimed until publication succeeds. Original PR12/13/15 remain open.


## Connector access restored — 17 October 2026

After operator repository reauthorization, the same Git blob write succeeded.
The preceding403/push report remains historical. Publication now proceeds through
the GitHub connector; no terminal credentials are extracted or copied. The source
and previously executed checks are unchanged. Published branch and tree equality are confirmed in the current receipt;
main merge, deployment and binary release remain separate.


## Published source and local synchronization

The operator reauthorized repository access. GitHub connector publication created
[PR16](https://github.com/sleontenko/daychi/pull/16) at source883f5d6, with main plus the
published PR12/13/15 heads as ordered parents. Its complete tree f31b643b2ced4f9c4e7206043f450e333e49218f
matches the verified local candidate byte-for-byte. Local branch was aligned only
after clean-status/tree equality checks; the prior local authoring history remains
on codex/sync-cabinet-local-before-connector-20261017. No force push or root reset.

The [publication receipt](publication-status.json) tracks CI for this exact source.
[Image provenance](image-provenance.json) records the synthetic fixture and byte hashes,
including the resolved automatic-review hold. Original successful native account
runs and local app/backend/browser tests were not repeated for Git publication.
Original PR12/13/15 remain open; source publication does not establish merged main,
authenticated web SSO, protected native Cabinet content or a new app release.


Exact source883f5d6 CI [39048278308](https://github.com/sleontenko/daychi/actions/runs/39048278308)
passed all three jobs: backend, app and wiki. This includes clean Python/npm installs,
repository guard, TypeScript, lint, tests and deterministic web bundle rebuild. GitHub
reports the draft mergeable against main. This follow-up changes documentation only;
source, configuration, bundles and previously verified runtime behavior are unchanged.
