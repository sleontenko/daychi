# Isolated native material staging

Operator authorized20October2026: publish the reminder draft PR and deploy a
separate synthetic native-content API, then prepare joint checks with Cabinet.
Production and current TestFlight are explicitly excluded.

Product modules and installed-consumer source remain PR18
`bb7295f824909029ed8a39eb1a12822f662f012d`. This branch adds deployment/bootstrap
files and tests only. It is not the reminder implementation in draft PR19.

The runtime seeds two synthetic source/material/article records, one concept and
their reviewed-fixture graph links. Placeholder video URLs are non-school test
data and must not be opened as recordings. The fixture imports the existing
repository's synthetic formats; it is not an editorial content import to Daychi.
Synthetic IDs are stable across disposable redeployments. No corpus, old database,
volume, admin password, Cabinet credential or role/account replica is installed.

`run.py` creates an ephemeral private directory, drops to UID/GID10001, seeds
0700/0600 files and invokes the unchanged Daychi factory. Native content uses
the fixed staging profile and real per-read verified HTTPS checks at Cabinet's
`/api/auth/native/me`, with the presented bearer only. The HTTP surface is GET
health and existing native wiki aliases; every other route/method returns404.
There is no HTTP fixture control, bypass, service token, positive authorization
cache, public/legacy fallback, access logging or recording/profile logging.

Deploy the dedicated Dockerfile with requirements pinned by PR18. Set its path
directly on the new Railway service; no deprecated Config-as-Code file is used.
Only staging project `daychi-wiki-staging` / b66820ff-8c51-4e67-b1cd-e0b88220662e,
environment e26503e9-3bb5-4e30-9397-4acf23733789, and dedicated service
`daychi-native-materials-test` / bdb1c01d-4060-4030-bc30-6b2a7e3cebeb are in scope.
Use one replica, 0.25CPU/0.25GB limits, no CDN, no volume, and a pinned source
commit rather than branch-following deployment. Existing browser staging stays
at deployment d8f2d41d-da62-4a37-8d5f-fd419c28ae39.

Local verification:295 backend tests pass, including all existing native boundary
cases plus three bootstrap/surface/stable-ID regressions. The first bootstrap
test exposed missing legacy-semantic fixture activation; it is enabled/seeded so
all nine existing protected aliases return synthetic data under injected local
success. Refusal, recovery and read-only surface checks pass. Runtime real-account
success remains a separate joint test; local injection is never exposed over HTTP.

After deploying, record source/deployment/domain/config and anonymous/invalid
bearer no-store checks. Configure an ordinary PR18 Debug client at the issued
HTTPS origin with native account/content flags on, preserving its bundle ID and
callback. Never enable the synthetic Metro/session resolver in a joint test.
Cabinet owners must supply the matching authorized account/grant/status/outage
arrangements before real revocation/block/outage cases. Reuse accepted account8
proof; browser DNS, reminders17 and restart quota persistence are not new gates.
Report sanitized mapping and missing arrangements in original Workshop16.
