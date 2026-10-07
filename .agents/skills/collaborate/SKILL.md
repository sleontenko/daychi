---
name: collaborate
description: >-
  Use at session startup to check cross-project assignments, before every change
  affecting documented project boundaries, and whenever coordinating across
  projects or communicating with Workshop.
---

[Workshop](https://github.com/dveyarangi/xuanxue-workshop) coordinates development
across the school's projects and maintains their shared boundary agreements.

Project label: `project:daychi`

Source revision: [e209d27239391be3af2be71b898c79f453851c01](https://github.com/dveyarangi/xuanxue-workshop/commit/e209d27239391be3af2be71b898c79f453851c01).

Use [Workshop Issues](https://github.com/dveyarangi/xuanxue-workshop/issues) for
cross-project collaboration and messages to Workshop, following
[the issue format](workshop-issue-format.md). Internal project work uses the
project's own tracker and rules.

## Check addressed work

In [Workshop Issues](https://github.com/dveyarangi/xuanxue-workshop/issues), find
issues carrying your project label. Read relevant assignments, discussions and
dependencies, including follow-up on reported results. Follow your project's
operator instructions when choosing and executing work.

When an assignment supplies `BOUNDARY_SUMMARY`, use its marked content to update
the summary in the collaboration block of `AGENTS.md` or `CLAUDE.md`, checking it
against the local code and preserving the surrounding rules. If a required summary
is missing or ambiguous, request clarification in the assignment issue.

## Coordinate a boundary change

Read the relevant
[boundary agreements](https://github.com/dveyarangi/xuanxue-workshop/blob/HEAD/docs/boundaries.md),
the [current-state evidence](https://github.com/dveyarangi/xuanxue-workshop/blob/HEAD/docs/current-system.md),
and the owning project's executable definitions. Apply the
[contract-evolution agreement](https://github.com/dveyarangi/xuanxue-workshop/blob/HEAD/docs/agent-contract.md#contract-evolution):
work within the active contract can proceed under your project's authority;
a new version can coexist while the active contract remains fulfilled.

For a new version, open a migration-coordination issue addressed to
`project:workshop`. Coordinate
an incompatible replacement before implementing it; retire the old version only
after all known consumers confirm their transition.

Update the short boundary summary in `AGENTS.md` or `CLAUDE.md` when affected
and include those changes in your report for Workshop reconciliation.

## Discuss problems and report results

Discuss assignment problems in the original assignment issue.

For problems with Workshop itself, use the issue format's duplicate check and address
new issues to `project:workshop`.

Report results and answer follow-up questions in the original assignment issue.

Workshop reviews evidence, updates its records, acknowledges acceptance and
closes the assignment. A project-side closed state does not establish acceptance.
The [agent contract](https://github.com/dveyarangi/xuanxue-workshop/blob/HEAD/docs/agent-contract.md)
owns the shared responsibilities and recipient labels.
