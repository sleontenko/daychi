# Cabinet web wiki preparation · 13 October 2026

Local implementation under [Workshop #13](https://github.com/dveyarangi/xuanxue-workshop/issues/13), against the amended [shared contract 25def59e](https://github.com/dveyarangi/xuanxue-workshop/blob/25def59e25fc847764cc43de8d963bf62a16512e/docs/contracts/web-wiki-session.md). This prepares Daychi's contribution; it is not deployed or jointly accepted.

Source: isolated branch codex/cabinet-web-wiki, based on published article source d2cde6b93ef79734e4de0438ddc2e138698214af. Checkout: data/worktrees/cabinet-web-wiki-2026-10-13 inside the original workspace. Unrelated native/iPad/account work in the main checkout was preserved. No native source, source IDs/revisions, v1 DTO, content import or existing private invitation authority was replaced.

## Delivered candidate

The backend validates every protected web read with Cabinet. Only an empty 204 authorizes delivery. Missing/ambiguous active cookies refuse locally; current 401/403 retain their distinction. Unexpected bodies/statuses, redirects, rate limits, upstream/transport failure, invalid renewal and the total five-second deadline produce 503 with no protected content. There is no retry, redirect following or positive authorization cache. Only the active cookie is forwarded; valid active-name shared renewal is relayed. Refusal/failure never clears browser cookies. Identity, expiry, signing and logout remain Cabinet-owned.

The canonical wiki origin uses cookie-only private article/material/graph readers, including recording links. Its nonreader APIs are unavailable and POST wiki login/logout is refused. Request-scoped authorization cannot authorize Zoom, owner/import or access redemption. All public reader aliases are gated on every backend origin when the candidate is enabled. Retained public DTOs still redact recordings; authenticated private material DTOs allow YouTube while excluding Zoom/credentials. Ordinary backend private/native bearer APIs retain their own authority. Routing must preserve that audience split; a browser-provided native flag is not authority.

Browser UI replaces invitation entry with top-level Cabinet entry and original relative path/query/hash, and replaces local logout with a Cabinet logout-page link. It never reads HttpOnly cookies or persists account/session credentials. It removes the obsolete web bearer key only in the new web mode; native bridge behavior is unchanged. Hidden/pagehide/BFCache transitions discard protected DOM/runtime and pending requests. Cached-route rendering first validates the server session. Epoch/abort guards prevent old responses from restoring content. Route, scroll, search draft, selected IDs and nonsecret bookmarks remain navigation/preferences.

## Explicit environment profiles

| Profile | Wiki host | Fixed Cabinet | Active cookie/domain |
| --- | --- | --- | --- |
| Production | wiki.xuanxue.su | https://xuanxue.su | session / xuanxue.su |
| Staging | wiki.staging.xuanxue.su | https://staging.xuanxue.su | session_staging / staging.xuanxue.su |

The deployment must explicitly set DAYCHI_WEB_CABINET_PROFILE to production or staging when DAYCHI_WEB_CABINET_ENABLED=1. Missing/unknown runtime profile fails startup. NODE_ENV, Host aliases, browser query/hash and incoming cookies do not select/fallback to another provider. A deployment refuses the other wiki hostname. Duplicate refusal counts only the active cookie name; inactive names and their renewals are ignored, never forwarded or expired. Cookie attributes are validated against the fixed profile. Both entry/return and logout use the same selected Cabinet. The default remains disabled before a coordinated initial cutover; these values have not been changed in production.

## Verification

- Backend: 180 passed, including 30 new boundary/transport/profile cases over the published 150-test baseline. Per-read valid → invalid → blocked → unavailable → recovery, every registered public/private GET reader, duplicate cookie/raw Host, no bearer/native-flag bypass on wiki, current-account refusal, renewal/redaction, no reader DB writes, many readers, malformed/profile/HTML/redirect/429/5xx/transport failure and a real five-second cancellation deadline are covered.
- Both profiles: exact provider URL and active-cookie-only request; inactive-only cookie refuses without calling the other provider; both cookie orders and duplicate inactive values succeed independently; duplicate active values refuse; relabeled cross-profile credentials are refused by the controlled provider; wrong renewal domain is 503, inactive renewal is not relayed, wrong wiki host refuses. This is controlled consumer proof, not actual Cabinet signature/account/lifecycle proof.
- Web: 21 passed, including six new cookie-only, stale-response, background/deadline, v1 fallback and fixed production/staging return/logout cases. npm run build passed; the generated server bundle is included.
- Packaging: all 22 Docker Python source inputs are in the 50-file staging allowlist and explicitly admitted by Docker exclusions. The new checker and already-published article modules are included; httpx2 is pinned to the tested 2.13.0. Full Docker image build/deployment was not performed. Existing APK/private runtime data are not copied into these artifacts.
- Chrome plugin runtime: synthetic library → article → concept → Back; bookmark/Saved; graph and zoom/fit; invalid/blocked/503 with protected content removed; retry recovers without another fixture login; background return preserves the search draft and rechecks. Login href retains original route/query/hash, and production/staging logout targets were inspected without invoking real logout. Staging's fixture login exposes the same article/YouTube links with its own cookie/profile.
- Actual sizes: 360×800 runtime, 390×844 phone, 768×1024 tablet, 1920×817 desktop; checked views had no horizontal overflow. Viewport changes were measured from DOM and image dimensions, then reset; test tabs and servers were closed. No physical-device or iOS release proof is implied.

## Visual references

[UX candidate](../../design/candidates/cabinet-web-session-2026-10-13/README.md) remains a candidate. Existing accepted references in DESIGN.md are unchanged. Synthetic screenshots contain no school corpus/account data. Frozen reference JS/CSS/HTML comes from the published source before edits; no reference is promoted automatically.

| View | Reference | Runtime | Observed difference |
| --- | --- | --- | --- |
| Article, 390×844 | [reference](reference/article-390-final.jpg) | [runtime](runtime/article-390-final.jpg) | Same article/typography/navigation; bookmark state matched |
| Article, desktop | [reference](reference/article-desktop-final.jpg) | [runtime](runtime/article-desktop-final.jpg) | Same content layout; Cabinet logout link is intentional |
| Library, desktop | [reference](reference/library-desktop-final.jpg) | [runtime](runtime/library-desktop-final.jpg) | Same catalog/opened rows; Cabinet logout link is intentional |
| Graph, desktop | [reference](reference/graph-desktop-final.jpg) | [runtime](runtime/graph-desktop-final.jpg) | Same graph/controls; Cabinet logout link is intentional |
| Entry | [old invitation](reference/signed-out-desktop.jpg) | [Cabinet staging entry](runtime/staging-signed-out-final.jpg) | Input and code help replaced by the described Cabinet link |

Additional [blocked](runtime/blocked-desktop.jpg), [refused read](runtime/invalid-after-read.jpg), [unavailable](runtime/unavailable-390.jpg), [tablet](runtime/article-768-final.jpg), [staging entry](runtime/staging-signed-out-390-final.jpg) and [staging article](runtime/staging-article-390-final.jpg) frames support the state checks. The desktop article frame precedes the profile amendment; final library/graph and staging article frames use the amended bundle. No CSS change occurred in that amendment. Historical captures with requested but unapplied sizes were renamed/audited rather than represented as tablet proof.

## Actual runtime and remaining joint proof

[Live origins](live-origins.json): wiki.xuanxue.su and the Railway direct origin returned identical hashes for HTML, JS and anonymous categories on 13 October, with TLS verified. app.xuanxue.su/health was reachable. This establishes observed delivery equivalence for those files, not an exact backend source/configuration.

[Latest profile check](live-profiles.json), 10:37 UTC: both xuanxue.su/api/auth/session and staging.xuanxue.su/api/auth/session returned 404 without no-store. wiki.staging.xuanxue.su/wiki produced ConnectError; its HTTPS/routing is unverified. [Cloudflare readback](cloudflare-readback.json): connected API succeeded, but GET zones filtered by xuanxue.su returned zero accessible zones. No DNS/cache rules, cache contents or purge are established by that connection; no mutation was performed.

Cabinet #12 must supply conforming endpoints/entry/renewal/logout and controlled account fixtures. Actual same-browser production/staging sign-in in both orders, legacy migration/cleanup, independent renewal/logout, real signature/current-account checks, actual return after existing login and multi-reader capacity remain joint proof. Loopback fixtures deliberately use synthetic host-only HTTP cookies; they do not prove shared Secure/Domain cookie delivery or Cabinet's account logic.

See [exposure and cutover inventory](CUTOVER.md). Activation also needs staging routing/TLS, complete aliases/cache closure and coordination of existing anonymous native readers through #9. Their public read path would be refused by the new all-origin public gate; preserved native/private bearer APIs are a different scope. The native common-content adapter/caller-trust/capacity work in #11 remains unresolved and is not implemented here. No production deployment, cache purge, DNS change, new TestFlight upload, release tag or Apple status change occurred. Workshop #13 remains open for joint acceptance.

## Reproduce the controlled QA

Use the project Python/Node environment from README. Run python -m pytest -q at the checkout root, then npm test and npm run build in apps/wiki-graph. Recreate the frozen reference files before running the loopback fixture (they are intentionally outside Git):

```python
from pathlib import Path
import subprocess
folder = Path("data/web-cabinet-qa/baseline")
folder.mkdir(parents=True, exist_ok=True)
for name in ("index.html", "graph.js", "graph.css"):
    data = subprocess.check_output(["git", "show", "d2cde6b93ef79734e4de0438ddc2e138698214af:practice_api/wiki_graph_web/" + name])
    (folder / name).write_bytes(data)
```

```sh
python -m uvicorn --app-dir apps/wiki-graph/qa web-session:app --host 127.0.0.1 --port 38913 --no-access-log
```

A separate process uses QA_WEB_PROFILE=staging and port 38914. Open daychi-web-qa.localhost:38913/wiki or daychi-web-staging-qa.localhost:38914/wiki; /qa/login issues only a disposable fixture cookie. /qa/state?value=ok|invalid|blocked|unavailable|delay|profile controls only the fake provider. daychi-web-reference.localhost at the same ports serves the frozen synthetic reference; its invitation input accepts a fake test code. These paths are not production login/logout/session endpoints, are excluded from the server package and must remain loopback-only. Real Cabinet links are inspected rather than used to mutate real account sessions during fixture QA.
