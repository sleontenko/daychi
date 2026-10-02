# Daychi / Дейчи

Read README.md, docs/PRODUCT.md, docs/DESIGN.md and docs/TESTFLIGHT_CHANGELOG.md
before product changes. The Expo app also has local AGENTS.md instructions.

Preserve the approved design. Treat `/prototype` as mock content, not shipped
functionality. Do not expose the private corpus API or commit credentials/data.
Keep the schedule timezone Asia/Jerusalem, distinct from the device timezone.

For each TestFlight build update the changelog with added/fixed/changed behavior,
tests actually run, limitations, Apple status and source commit/tag. Do not claim
real-device delivery from simulator evidence. Ask before releasing a new build
unless the current task already authorizes it. Once a TestFlight release is
authorized, automatically distribute it to all members of the existing internal
group «Личное тестирование» (ed8a05aa-a6db-41e9-93e6-299c8f36c7c2), without
asking for another confirmation. This is the owner’s standing instruction from
2026-09-19, including build 6. Verify group assignment and Testing status.
Keep roadmap items separate from completed work. Never rewrite past release facts.

Wiki content batches: maintain docs/wiki-work-plan.md after each batch with
completed/remaining scope, actual time/token usage when available, estimates
and next scope. Use docs/wiki-contributor-pipeline.md for delegated content work;
keep source data and credentials private, imports with the coordinator.
Primary editable content ledger: data/wiki-workspace/outputs/2026-10-02/wiki-materials.xlsx.
See docs/wiki-team-pipeline.md for stable source IDs, snapshot periods and updates.
Preserve participant inputs when updating the ledger; never regenerate over them.

Every subsequent version must be checked against the original design archive and
screen references in docs/DESIGN.md before release. Preserve explicitly approved
screen-specific revisions (including build-5 schedule). Record the reference,
screenshots compared, justified data/native differences, and actual QA result.
Do not introduce visual departures without owner agreement.

Build 7 is an owner-authorized closed beta with a private bundled wiki snapshot
and no manual login. Generated catalog stays ignored by Git. Do not publish web
exports or widen distribution of this snapshot; restore server authorization
before a broader release. See docs/wiki-closed-beta.md.

## Design acceptance and navigation — owner instruction 2026-09-24

Implementation is not accepted just because it builds. Before handing off a
UI change, compare EACH affected screen and state with the latest owner-approved
Claude Design export identified in docs/DESIGN.md. Save paired reference/runtime
screenshots, list discrepancies and fix them; do not infer complete fidelity from
one schedule screenshot. Include «Мои занятия»: empty, regular series, next date,
skipped/restored date, one-off dates, and a series absent from the loaded window.
A new designer candidate is not automatically an approved reference.

Exercise every affected back arrow/close control and Android Back through its
actual entry points. Check nested screens, direct shortcuts, tab changes and
scrolling: return to the real previous screen with selection, filters, scroll
position and draft preserved. Back controls must stay reachable inside safe areas.
Record actual results and untested paths in the QA report. A known visual or
navigation mismatch blocks acceptance/release; do not call the design fully ported.

Missing UX is assigned to Claude Design in a separate candidate, with entry/exit,
loading/offline/error/recovery states and transition table, before implementation.
Keep real wiki content, invitation credentials and Zoom links out of design prompts.
