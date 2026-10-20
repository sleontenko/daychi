# Native material joint-test staging —20October2026

Operator authorized publication of the reminder draft and a separate synthetic
material API, with joint Cabinet preparation. Production and current TestFlight
are explicitly excluded. No real account/grant/status/outage operation is inferred.

## Sources and completed preparation

- Reminder [draft PR19](https://github.com/sleontenko/daychi/pull/19): source
  ea464efefd93d700ad80860d9c39b3694b932597, tree61f48b9 equals local6f812fd.
  [CI39327431138](https://github.com/sleontenko/daychi/actions/runs/39327431138)
  passed backend/app/wiki. No merge or feature activation.
- Material product/client source remains published PR18
  bb7295f824909029ed8a39eb1a12822f662f012d. No practice_api or app source changed.
- Dedicated bootstrap/config/tests at published
  f8c28dc0d194f7ddff6421672f56b68e093b0131 on
  codex/native-materials-staging-20261020. [Deployment scope](../../deploy/native-materials-staging/README.md).
  Local296 backend tests pass, including four runtime-bootstrap regressions.
  Source guard passed673 tracked files. Docker builds with the existing pinned
  top-level requirements; unchanged transitive dependency resolution is not a
  claim that the whole image or all dependencies are locked by digest.
- Ordinary iOS Router/Hermes export at the actual test origin passed fixture-marker
  checks. New Debug container built/installed on dedicated iOS27 Simulator,92.9s,
  version1.0.0(18), existing bundle ID/callback unchanged. The full-parent Wiki tab
  displays the real signed-out Cabinet gate ([screen](installed-signed-out.jpg)).
  There is no synthetic session/storage/Metro resolver in this client.
  [Build/config/export receipt](client.json). No real login or protected success
  was executed; this is a configured installed client, not joint acceptance.

## Infrastructure and current blocker

Only project daychi-wiki-staging/b66820ff-8c51-4e67-b1cd-e0b88220662e,
its sole environment staging/e26503e9-3bb5-4e30-9397-4acf23733789 and new service
daychi-native-materials-test/bdb1c01d-4060-4030-bc30-6b2a7e3cebeb were configured.
No inherited shared variables/volumes/credentials/corpus. One replica,
0.25vCPU/250MB, CDN disabled, no external tracing, no access logs.

Origin allocated: https://daychi-native-materials-test-staging.up.railway.app.
Source pin in committed config is f8c28dc, independent of later docs pushes.
Start command is python /app/deploy/native-materials-staging/run.py; Dockerfile
is deploy/native-materials-staging/Dockerfile. Only five nonsecret variables
are set (PORT and the native staging/web/public flags); bootstrap fixes all data
paths to the private ephemeral directory. Real per-read Cabinet checks are active
only when the app can start; there is no bypass or fixture HTTP mutation endpoint.

First deployment25e18008-540c-4f30-bf27-dda33ae50832 built93f6d29 successfully but
failed before serving due to an incorrect Path.chown call. Fixed to os.chown in
f8c28dc, with privilege-drop ordering coverage and the full296-test run. Config
and source updates committed successfully, but no replacement deployment was
created: a direct attempt returned **Deploys have been paused temporarily**.
Railway environment status confirms offline/no pending work. Do not claim that
the corrected deployment is running or queued. HTTPS health currently returns
Railway edge404/public max-age5, not application200/no-store. Real runtime
anonymous/invalid-bearer smoke and Linux UID10001 proof remain pending startup.

An earlier unscoped live-source call was rejected by automatic approval review
for possible all-environment impact. The complete project inventory then proved
there is only staging; the re-evaluated call was allowed but Railway refused it
with the platform pause above. That approval-review issue is resolved by the
verified scope; the remaining blocker is Railway's deployment pause. No CLI,
alternate service/account/platform, plan change or indirect bypass was attempted.
The original browser staging remains SUCCESS at d8f2d41d-da62-4a37-8d5f-fd419c28ae39.

## Next execution, already scoped by the operator

1. When Railway permits deploys, re-verify sole staging environment and exact
   dedicated service; connect the pinned f8c28dc source to cause a fresh build.
   Do not use redeploy on the failed93f6d29 image. Inspect actual deployment commit,
   startup UID10001 and all-nine-alias anonymous/invalid checks before healthy status.
2. Cabinet owns matching authorized account/grant/status/failure arrangements under
   native-content-session@ce4aebc. Request two grants plus surviving browser context,
   revoke only the tested grant, and use owner-isolated block/unblock and temporary
   failure/recovery. Keep retained Teacher/Developer roles; no account deletion,
   live aging, global logout, quota restart test or repeated account8 proof.
3. Reuse this ordinary installed source/config for actual protected synthetic
   library/material/concept/graph and recording-bearing response checks. Preserve
   other grant/browser observations and credential retention on403/transient errors.
   Keep credentials/account/profile and recording links out of public artifacts.
4. Report one sanitized provider/client/build/runtime/result mapping in original16,
   linked to15/11. Browser DNS and reminder17 are not prerequisites.

Temporary Metro8126 and the Debug app are stopped. Initial sandbox pod install
could not fetch Hermes; the authorized network retry completed. The first client
launch had no script URL because sandbox Metro could not bind; a dedicated
authorized loopback Metro launch then loaded the ordinary full Router successfully.
These failed attempts are not counted as content evidence. Production, external
TestFlight18, other simulators, existing browser deployment and account roles were
not modified. No source PR merge, release or live fixture operation occurred.
