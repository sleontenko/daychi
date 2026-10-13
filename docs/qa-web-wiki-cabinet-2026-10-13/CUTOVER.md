# Web reader exposure and cutover inventory

This is a preparation inventory for Workshop #13 / contract 25def59e, not a deployment receipt. All runtime mutations and publication still need Daychi operator release approval. Provider #12 and the #9 anonymous-access transition remain dependencies.

| Surface | Observed current delivery | Prepared enforcement / remaining proof |
| --- | --- | --- |
| wiki.xuanxue.su | TLS, HTML/JS/public categories 200; same fingerprints as direct Railway | Canonical production reader host must receive shared session and use fixed production profile; retest every reader anonymously and with controlled accounts |
| daychee-api-production.up.railway.app | Direct HTML/JS/public categories 200 | Every /api/public/wiki alias is protected in the enabled boundary, regardless of Host; direct private bearer API remains native-owned, not a web invitation fallback |
| app.xuanxue.su | TLS health 200 | Inspect its actual routing/reader exposure before activation; health is not a content/cache closure proof |
| wiki.staging.xuanxue.su | HTTPS ConnectError on 13 October | Provision/reach an independent staging backend with the staging profile; do not alias production; verify TLS and Host preservation |
| Other aliases/origins | Complete control-plane inventory unavailable | Connected Cloudflare returned no matching accessible xuanxue.su zone; owning operator must enumerate other aliases/routes and caches |
| /api/wiki/* at canonical wiki | Existing private reader source paths | Every GET/HEAD checks Cabinet; wiki session handshake also checks; POST login/logout refused; legacy bearer/native flag cannot authorize canonical wiki reads |
| /api/public/wiki/* on all origins | Existing anonymous v1/semantic/article readers | Every GET/HEAD checks active Cabinet cookie before routing; no direct-origin anonymous escape |
| /api/admin/*, /api/access/*, feedback, schedule at canonical wiki | Shared backend owns other capabilities | Unavailable at canonical wiki; native/owner backend authority remains unchanged elsewhere |
| /wiki, /wiki/graph, / | Empty application shells / website | Wiki shell contains no catalog/account credentials; canonical root redirects to /wiki; script fetches protected same-origin API |
| /wiki-graph-assets/* | Public compiled code/CSS | Retain only generic application assets, no catalog/recording payload. New bundle is built from source and included; re-fetch/hash after deployment |
| Public site/support/privacy/invite/assets | Existing nonreader delivery | Source has no /api/public/wiki fetch or service-worker registration; do not publish embedded school corpus in assets. Retest actual aliases, not just main hostname |
| Historical native APK/bundled snapshots | Existing release surface outside this web contribution | No new binary or corpus upload here; preserve native compatibility, separately inspect/migrate any controlled old corpus snapshots before claiming complete exposure closure |
| Browser preferences | Bookmarks/opened IDs and navigation | New auth layer stores no token/profile/text/recording; old web token key removed in new mode. Hidden/BFCache/stale requests discard reader content |
| CDN/browser/proxy/service-worker caches | Current sampled replies are no-store | Headers do not prove old entries were purged. Cloudflare rules/cache contents were not accessible; no cache purge performed. Source declares no wiki service worker; inventory other controlled delivery caches |

The complete registered router set is in [route-inventory.json](route-inventory.json): 19 existing GET reader routes plus the new request-checked /api/wiki/session handshake. Public/private article, concept, material, category, recent and graph paths are included. Their anonymous refusal is enumerated by backend tests using actual registered routes, not only a graph smoke check.

## Required activation sequence

1. Obtain Cabinet #12 report for the same immutable contract: separate profile account/key stores, shared active cookies, exact session-check operation/status/deadline/no-store, rolling renewal, existing sign-in entry/return and Cabinet-site logout. Do not substitute native me, a profile body, role/payment/invitation flags or another issuer.
2. Inventory all actual web aliases and direct origins with their owners, including Cloudflare zone/rules/caches and existing native public-reader consumers. Coordinate #9 prospectively; existing article release remains valid history. New all-origin public gating necessarily changes the current anonymous native read path; preserve native private authority and agree its reader transition before activation.
3. Prepare independent staging hosting/data/routing/TLS, explicitly configure DAYCHI_WEB_CABINET_ENABLED=1 and DAYCHI_WEB_CABINET_PROFILE=staging, and retain canonical staging Host through any trusted internal proxy. Provider URL and frontend entry/logout are selected from this fixed configuration only. Untrusted client profile/native/forwarded-host claims cannot select authority.
4. Review the UX candidate and prepared source. Obtain project release approval for concrete hosting/configuration/source/cache actions. The local environment example remains disabled and contains no secret. No deployment authorization is inferred from TestFlight build18 approval.
5. Close anonymous paths and controlled old cache entries as part of the approved cutover. Fetch every registered reader from canonical/direct/alias origins, plus static/embedded/cached paths. Repeat with missing, duplicate, valid, forged, expired, deleted, blocked/unblocked and cross-profile cookies. Failures must expose no title/body/recording/credential.
6. Run the contract's actual same-browser joint proof with Cabinet-owned controlled accounts, both sign-in orders, original path/query/hash, legacy cleanup, independent renewal/logout, next-read refusal, recovery/stale response/BFCache and many readers behind one backend. Record exact sources, deployment profile, origins/TLS, cache actions and both recipient reports; do not persist raw cookies/profile/account data.
7. Stage production separately with its fixed production profile after acceptance/release approval; run the same exposure and lifecycle proof. Report partial delivery as partial and leave Workshop #13 open until Workshop acknowledges it.

After first access cutover, do not roll back by disabling the boundary, deploying the old anonymous reader, restoring invitation-based web login or re-enabling old public caches. Retain protected routing in a reviewed rollback artifact or serve a content-free unavailable/maintenance response. Provider failure already fails closed while preserving the cookie.
