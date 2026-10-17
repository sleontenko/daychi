# Public homepage graph · 14 October 2026

Operator correction: the homepage overview remains visible before login; click
offers Cabinet entry. This supersedes hiding the graph in the 13 October candidate.
Historical records remain unchanged. Local branch codex/cabinet-web-wiki, after
4e9f68e; no source push, deployment, DNS/cache mutation, binary or Apple-status change.

The published renderer now reads GET /api/site/wiki-graph. Allowed fields: public
section names/counts, anonymous node IDs/types/section membership, structural/series
edges. Nonsection labels are empty; section names use existing text redaction.
Original IDs are replaced while preserving sort order/layout. No material/subtopic
titles, dates, links, recording IDs/URLs, bodies, annotations, articles or concept
slugs are exposed. Cookies and article/semantic query flags never expand the DTO.
The response/browser fetch are no-store and the fetch omits credentials. This route
is public at the site/backend and unavailable at the canonical wiki host under the
enabled boundary. Existing /api/public/wiki/* and protected reader APIs remain gated.

The visible preview is a keyboard-accessible link to app.xuanxue.su/wiki#view=graph.
Existing fixed-profile alias routing leads to wiki/Cabinet entry with the fragment.
Native/private/Zoom/owner authority and Android4 remain unchanged. This narrow public
projection is an operator-requested exception for Workshop exposure reconciliation,
not a relaxation of existing readers or a claim of shared acceptance.

**201 backend / 21 web tests passed** (37 Cabinet-boundary tests). New checks cover
anonymous preview without provider calls, invalid/blocked/unavailable providers,
ignored query flags/cookies, no source IDs/recordings/private text, valid graph
membership and continued reader refusal. Chrome used only 80 synthetic materials:
actual 390/1440 widths, 245/370px graph heights, 88 rendered nodes, no horizontal
overflow, click and Enter → Cabinet entry, retained fragment, Back, loading, empty,
503 error and successful retry without navigation. No real account/shared-cookie
proof or offline-device test. Published typography, graph geometry and colors are
preserved; extra Cabinet and footer copy are inherited intentional changes.

Pairs: [phone reference](reference/ready-phone.jpg) / [runtime](runtime/ready-phone.jpg),
[desktop reference](reference/ready-desktop.jpg) / [runtime](runtime/ready-desktop.jpg),
[loading reference](reference/loading-desktop.jpg) / [runtime](runtime/loading-desktop.jpg),
[empty reference](reference/empty-phone.jpg) / [runtime](runtime/empty-phone.jpg),
[error reference](reference/error-desktop.jpg) / [runtime](runtime/error-desktop.jpg).
[Recovery](runtime/recovered-desktop.jpg), [click entry](runtime/click-cabinet-desktop.jpg),
[keyboard entry](runtime/keyboard-cabinet-phone.jpg). Reference uses frozen published
markup/JS and equivalent synthetic geometry. No unplanned styling discrepancy was
observed. Own browser tabs/server closed and viewport reset; QA controls/provider
are excluded from packaging. Accepted references are not promoted.

Fresh [59-file stage manifest](stage-manifest.json) and [25 Python syntax / forbidden
payload checks](stage-check.json). No Docker build/upload. Android4 SHA256 remains
701b65fd9de995c3947c705a938909292a3299621496f1210fbe9bf0c09dc6db.

Workshop's 14 October review reports staging session-check implemented, browser
entry/logout/full lifecycle still pending. Independent anonymous HTTPS at **11:43
UTC** confirms production 404 without no-store, staging 401/no-store; staging wiki
yields ConnectError, so reachability/TLS is unverified. [Receipt](live-check.json).
No cookies or account bodies persisted. Accessible immutable source requested by
Workshop remains unpublished. Joint provider/browser proof, native public-reader
migration and complete aliases/controlled old-cache closure still precede cutover.
