# Workshop collaboration installation evidence — 2026-10-07

Assignment: [Workshop #2](https://github.com/dveyarangi/xuanxue-workshop/issues/2).
Recipient: `project:daychi`; reporting GitHub account: `sleontenko`.

## Installed source and instructions

Both distributable files come from Workshop revision
[`e209d27239391be3af2be71b898c79f453851c01`](https://github.com/dveyarangi/xuanxue-workshop/commit/e209d27239391be3af2be71b898c79f453851c01):

- [`.agents/skills/collaborate/SKILL.md`](../.agents/skills/collaborate/SKILL.md)
- [`.agents/skills/collaborate/workshop-issue-format.md`](../.agents/skills/collaborate/workshop-issue-format.md)

The installed skill sets `project:daychi`, records its immutable source revision,
and removes the upstream installation section. Its companion link resolves locally.
The companion's Workshop-only relative contract-shape link is replaced by an absolute
URL at the same immutable revision. A comparison with `git show` of the two source
files passed after these exact installation adaptations; no other differences exist.

[AGENTS.md](../AGENTS.md#workshop-collaboration) preserves the existing rules and adds
the supplied boundary summary with local module paths and the required invocation
conditions: startup, boundary work and Workshop coordination. [README.md](../README.md#workshop-collaboration)
provides an explicit entry point for agents arriving through the repository link.
The recorded operator authorization for #6 requires explicit Workshop acceptance
and completed closure of #2; it does not authorize a release or deployment.

## Host installation consistency

The installed instructions were read over SSH on the authorized Mac Mini. SHA-256
values matched the MacBook installation and the isolated review checkout:

| File | SHA-256 |
|---|---|
| `AGENTS.md` | `b1566c3be5df5742d06119a0f57bf53f6e8168065baa5a74bbb40021b85d1b5b` |
| `SKILL.md` | `4ffa49c83cf6c6d1c10ac283be1332e135ced36ead644d39ba74444df943169a` |
| `workshop-issue-format.md` | `7c5690528589be6675c5ef3f7aa48e4f37baa1d6a9f178e9764544e684af261d` |

The Mac Mini's working checkout and the MacBook's working checkout both contain
unrelated application work. This evidence is prepared separately from upstream
`e1ab559c8d5db3dbd7db95aa7400941381ada12a`; that work is excluded from this change.

## Boundary review

Local source confirms the supplied summary: native schedule loading reads Daychi's
`/api/v1/schedule` and the school's public HTML (`load.ts`, `source.ts`), with public
Telegram timing corrections (`zoom.ts`). Native access/wiki clients and the web
wiki read Daychi APIs (`request-client.ts`, `api.ts`, `graph.js`, `library.js`).
The Cabinet client/backend connections remain explicitly marked as targets;
installation does not claim application integration. Daychi retains the content API.

## Verification and limits

A separate `codex exec --ephemeral --ignore-user-config` invocation completed
on 2026-10-07 in the isolated review checkout, without this conversation's history.
The audit was instructed to remain read-only; networking was enabled for public
GitHub reads. It read the root startup instructions, invoked the installed skill,
read its companion, and checked the referenced local boundary modules. No messages,
application changes or persistent chat were created by that audit.

The first audit was limited by sandbox network access. The successful repeat used
public REST, rather than claiming authenticated CLI discovery inside the sandbox.
`--ignore-user-config` avoided an incompatible model setting in the installed CLI;
no saved user configuration was changed.

Observed label query (HTTP 200; no pagination link):

```sh
curl -sS -H 'Accept: application/vnd.github+json' \
  'https://api.github.com/repos/dveyarangi/xuanxue-workshop/issues?state=all&labels=project%3Adaychi&per_page=100'
```

| Addressed issue | Observed state | Discussion read |
|---|---|---|
| #2 collaboration installation | open | both comments, IDs `6022524764`, `6022727525` |
| #4 contract contribution | closed / not planned (withdrawn) | empty |
| #6 native public schedule pilot | open | empty |

The fresh audit correctly concluded that #2 has no Workshop acceptance and that
#6 must remain unstarted. It recognized the distinction between client development
and the #5 provider/fixture evidence required for actual integration completion.
This observation is not an acceptance claim.

The independent audit's conclusion on source comparison was: installed hashes
differ from distributable hashes only through the expected installation adaptations.
The submitting session also verified exact transformed-source equality, matching
host hashes, relative links, `git diff --cached --check`, and
`python3 scripts/check_repository.py --staged` (458 Git files; passed).

Authenticated `gh api user --jq .login` returned `sleontenko` on both MacBook and
Mac Mini. The final report is sent from the Mac Mini into original issue #2, which
provides an observable authenticated return path. Repository access/grant policy
and final acceptance remain Workshop-owned.

This change affects agent instructions and evidence only. No app/API behavior,
production data, controlled fixture, DNS, deploy or TestFlight state is changed.
Workshop owns evidence review, acceptance acknowledgement and assignment closure.

## Reconciliation note · 2026-10-09

The observations above describe the 2026-10-07 audit. Workshop subsequently
acknowledged installation acceptance and closed issue #2 as completed. The
recorded operator authorization therefore permits beginning #6 under its current
dependencies; the old audit's "unstarted" observation is not a current gate.
Knowledge preparation now belongs to `sleontenko/daychi-knowledge`; current
startup instructions preserve that boundary alongside the Workshop block.
