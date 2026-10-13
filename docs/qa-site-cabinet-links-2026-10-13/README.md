# Site / wiki links follow-up · 13 October 2026

The operator supplied https://app.xuanxue.su/ and https://app.xuanxue.su/wiki and requested the public site/new wiki entry to use Cabinet. Chrome confirmed both HTTPS pages are reachable and the current /wiki still shows the invitation form. Cabinet's production and staging /api/auth/session were rechecked at 11:08 UTC; both returned 404 without no-store. Staging wiki HTTPS remains unverified. This is local preparation, not publication.

## Prepared behavior

- Homepage wiki, graph, download, support/privacy and canonical links use app.xuanxue.su. The browser-wiki brand returns to the same public site. Support no longer instructs browser users to obtain an invitation; privacy distinguishes Cabinet web sessions from the installed app's native access.
- With the prepared Cabinet boundary enabled, /wiki and /wiki/graph on app/direct entry aliases redirect to the contract-fixed wiki.xuanxue.su; staging redirects only to its fixed staging wiki. Query is retained and browser fragments inherit. The redirect does not authorize, renew, expire or forward a session. Canonical readers retain the per-read Cabinet checks and authenticated recordings from the earlier candidate.
- The public homepage no longer loads an anonymous school graph or embeds corpus. The existing graph frame presents a link to the protected wiki, including without JavaScript. An already open homepage therefore has no protected graph state to restore after logout. This access-state change is described in the [candidate](../../design/candidates/site-cabinet-links-2026-10-13/README.md); accepted references are not promoted/replaced.

## Exact production baseline preserved

The earlier prepared branch began at published Git article source d2cde6, while the live service also contained separately published native privacy/lifecycle and Android4/site updates. Before preparing a deployable package, the saved c964041f-096b-4c5c-bf05-8a068ea6cca9 publication stage was verified against every non-APK manifest hash and carried forward. This prevents reverting site CSS/fonts/image, APK attachment4, invitation session-details, retention/restore or deletion behavior. [Baseline receipt](published-baseline.json) identifies carried files. Existing matching tests were copied from the operator workspace because those source files exactly match the published snapshot; they are [inherited tests](inherited-tests.json), not newly invented assertions.

An initial test run exposed four stale pre-publication assertions: three expected the superseded deletion witness behavior and one expected draft support copy. No runtime behavior was changed to satisfy them. The existing current-source tests were restored and passed, alongside current native retention/review-access regressions.

## Verification / package

- Full backend: **198 passed**, including fixed-origin/query redirect, absence of cookie mutation/provider calls during alias entry, no anonymous homepage fetch, preserved native session-details and recording/Zoom/owner authority. The later privacy-copy change passed the public-pages test again. The prior 21 web tests/bundle remain unchanged; no native source or new binary was built.
- Existing website CSS, font and TestFlight destination retained. Android4 is unchanged: SHA256 701b65fd9de995c3947c705a938909292a3299621496f1210fbe9bf0c09dc6db. Attachment remains daychee-1.0.0-4.apk.
- A fresh **59-file** allowlisted server package is prepared privately under data/releases/2026-10-13/site-cabinet-candidate/server-stage in the isolated checkout. [Manifest](stage-manifest.json); [25 Python source syntax checks / no DB/env/key/bytecode payload](stage-check.json). It contains no QA provider. Full Docker build/upload was not run.
- Chrome: homepage → full graph → fixed wiki fixture → Cabinet entry preserves #view=graph; browser Back returns to the site. The new gate has no invitation input, Cabinet returnTo includes the original wiki hash, and its brand points to app.xuanxue.su. Hero buttons/copy and 360/390/768/1440 actual widths fit without horizontal overflow.

Paired [desktop reference](reference/home-desktop.jpg) / [candidate](runtime/home-desktop.jpg), [phone reference](reference/home-phone.jpg) / [candidate](runtime/home-phone.jpg). Also [closed graph](runtime/closed-graph-desktop.jpg), [Cabinet entry reached from site](runtime/site-to-cabinet-entry-phone.jpg), [360](runtime/home-360.jpg), [tablet](runtime/home-tablet.jpg). Reference markup/JS is the frozen published source; its synthetic preview shows the existing graph recovery state, not production graph/corpus data. The runtime page intentionally shows the new protected entry state. No unplanned hero/style discrepancy was observed.

The loopback-only apps/wiki-graph/qa/site-cabinet.py fixture serves reserved localhost origins and translates fixed app/wiki targets solely for browser QA. HTTP tests verify actual production/staging redirect URLs; fixture success does not prove public routing, shared cookies or actual Cabinet login. Start it with python -m uvicorn --app-dir apps/wiki-graph/qa site-cabinet:app --host 127.0.0.1 --port 38915 --no-access-log. No real account, invitation, logout or credentials were submitted. Test tabs and servers are closed after QA.

## Publication dependency

The production site remains unchanged. Working Cabinet login cannot be published while the settled provider check is unavailable: a valid shared cookie would receive 503 rather than materials. Actual Cabinet entry/return also remains unverified. Cabinet #12 deployed conformance, actual joint browser proof, native public-reader transition under #9 and complete alias/controlled cache closure remain required before the coordinated access cutover. [Existing cutover inventory](../qa-web-wiki-cabinet-2026-10-13/CUTOVER.md). app/wiki is an entry alias; this does not replace the agreed wiki origin or introduce a different authentication wire. No DNS, cache purge, deployment, source push, Apple upload or mobile release was performed.

Packaging whitespace note: the hash-preserved published Golos OFL license has one original trailing space. It is retained verbatim; scoped source whitespace checks exclude that unchanged vendor text.
