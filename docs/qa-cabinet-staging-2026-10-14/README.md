# Independent Cabinet wiki staging — 14 October 2026

Operator authorized preparation/deployment of independent integration staging after the published-source review. Production deployment, PR merge, account/fixture mutation and mobile release remain separate.

Source is pinned to `9677210c2d0e19222ba8d6a6eb1061f713233a1b`, Daychi draft PR13, under accepted shared contract `d689c24`. The existing Dockerfile/server are used with the explicit synthetic bootstrap in `startup.json`; the runtime override is separate from the pinned source. It seeds one integration-only material with no recording, source URL or real school content, then invokes `/app/run.py` and drops to UID/GID10001. Directory/file permissions are 0700/0600. The initial bootstrap omitted parent-directory ownership; first launch failed with PermissionError before startup. The first redeploy reused the earlier bootstrap and also failed. A fresh source-triggered deployment with the recorded override succeeded; its STAGING_BOOTSTRAP_V3 log confirms parent/fixture ownership10001 and directory/file modes0700/0600. The reviewed product source is unchanged.

- Railway project: `daychi-wiki-staging`, `b66820ff-8c51-4e67-b1cd-e0b88220662e`.
- Only environment: `staging`, `e26503e9-3bb5-4e30-9397-4acf23733789`.
- Service: `daychi-wiki`, `ec1ffbeb-db51-4d8c-beca-318ca8c7d730`.
- Deployment: `d8f2d41d-da62-4a37-8d5f-fd419c28ae39` — SUCCESS at19:27UTC.
- Direct address: `https://daychi-wiki-staging.up.railway.app`.
- Contract browser address: `https://wiki.staging.xuanxue.su`.
- One replica in `us-east4-eqdc4a`; resource limits 0.25 vCPU / 0.25GB.
- No mounted volume, shared variables, cloned production databases, admin/Cabinet credentials or private corpus. Synthetic state is ephemeral and may reset on redeploy.
- `DAYCHI_WEB_CABINET_ENABLED=1`, `DAYCHI_WEB_CABINET_PROFILE=staging`. `WIKI_INDEX`, `WIKI_DATABASE`, `DAYCHEE_ACCESS_DATABASE` point inside `/data/daychee`; no default repo data is used. Public wiki routes remain behind the Cabinet middleware. Article mode, access requests, deletion and retention are disabled for this disposable fixture deployment. No admin password is configured. `PORT=8080`.

## DNS owner action

The connected Cloudflare API returned zero matching xuanxue.su zones (200); Chrome is at Cloudflare sign-in. No zone/nameserver changes were made. Railway custom domain `c68643b4-1b93-440c-854c-9f2b4516cfbb` is attached to this independent staging service at port8080 and awaits ownership/certificate validation.

| Type | Host in xuanxue.su zone | Required value |
| --- | --- | --- |
| CNAME | wiki.staging | om0wj6tn.up.railway.app |
| TXT | _railway-verify.wiki.staging | Private owner-verification value held outside Git; give directly to zone owner |

Configure a DNS-only CNAME initially, then verify canonical DNS and Railway TLS. These newly generated values belong only to staging, not the production domain records from9October. A direct Railway address cannot carry the contract's staging.xuanxue.su browser cookie and is not an SSO substitute.

## Remaining joint proof

After canonical DNS/TLS, Cabinet owns authorized staging-account/status/renewal fixtures and browser sign-in/logout evidence. Daychi will verify real protected reads with a current valid session, refusal after expiry/logout/blocked/deleted status, renewal, original path/query/hash return and environment isolation. No successful authenticated-account proof or full joint acceptance is claimed by infrastructure preparation. No production/global-public-reader cutover, native migration, old-cache mutation, release or assignment closure is included.

## Executed runtime checks

At19:27:51UTC, [direct-host smoke](smoke.json) returned health200/no-store, minimal synthetic site graph200/no-store, anonymous public categories/graph401/no-store and native/private graph401/no-store. Public categories with deliberately invalid staging/production cookies also returned401, without Set-Cookie. Direct-host /wiki and /wiki/graph returned307/no-store to the fixed staging hostname, retaining the query. The synthetic preview contains one section and one unlabeled material node; no material body/title/source/recording identifiers. These sampled direct-host results do not establish that a Cabinet cookie was forwarded or checked remotely: browser cookies and the canonical host are separate.

Cabinet staging anonymous session check is401/no-store; production remains404. Canonical DNS lookup failed. Diagnostic canonical-Host requests over the direct Railway HTTPS address returned Railway edge404, not application responses ([bounded observation](edge-smoke.json)); therefore no canonical-host API/entry, Cabinet transport, browser SSO or valid-session proof is claimed. Railway reports canonical ownership unverified and certificate validating ownership.

Public coordination request: [Workshop13 receipt](https://github.com/dveyarangi/xuanxue-workshop/issues/13#issuecomment-6176556384). Automatic approval review rejected the first attempted public report because it included the DNS ownership-verification token; that report was not posted. The accepted public report omits it. The exact value is retained only in ignored local operator data, outside this QA directory and Git.

The pinned server image deliberately does not contain the ignored production Android APK; staging is an authentication integration fixture, not a new download distribution. No new UI/reference acceptance is claimed; source HTML/frontend remain unchanged.
