# Quiet Practice

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

Every subsequent version must be checked against the original design archive and
screen references in docs/DESIGN.md before release. Preserve explicitly approved
screen-specific revisions (including build-5 schedule). Record the reference,
screenshots compared, justified data/native differences, and actual QA result.
Do not introduce visual departures without owner agreement.

Build 7 is an owner-authorized closed beta with a private bundled wiki snapshot
and no manual login. Generated catalog stays ignored by Git. Do not publish web
exports or widen distribution of this snapshot; restore server authorization
before a broader release. See docs/wiki-closed-beta.md.
