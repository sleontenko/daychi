# External TestFlight18 — 17 October 2026

The operator explicitly authorized opening the existing build18 to external testers.
Existing 1.0.0(18), uploaded12October, was assigned to the existing public group
and submitted to Beta App Review. Fresh Apple API reads confirmed APPROVED,
external IN_BETA_TESTING, autoNotifyEnabled=true, and build18 in that group.
Apple returned submittedDate=null; no submission time is inferred from that field.

The public link is unchanged: https://testflight.apple.com/join/GW9GB7mS .
Build15 remains assigned; the internal group still contains18. No new binary,
new group, invitation, public-link limit, production API or DNS change was made.
Reviewer contact/demo credentials were preserved and excluded from this report.
Review notes and Russian What to Test now accurately describe the optional staging
Cabinet account, local selections/reminders and separate existing protected access.

## Source and verification

This exposes the original12October binary, not the current source main c146326.
Its frozen archive/source provenance and executed UI/build checks remain in
[the original release report](https://github.com/dveyarangi/xuanxue-workshop/issues/8#issuecomment-6124512660).
The frozen390-file manifest SHA256 is d22dbcf357e12622c2f47a15131906311be970ad9cae1adf256b75dd68a0fa8b;
base5f9ba442 plus recorded dirty source;
there is no new tag or clean-commit claim for that historical binary.
Accepted native account parity with d1a85fe was checked in the internal release
follow-up on17October (local source inventory retained). The original archive
passed125 app /19 shared-wiki tests, TypeScript/lint, Release Simulator build,
signed device archive, IPA export and codesign verification. Published source
reconciliation and its separate validation are in
[the source report](../qa-git-sync-2026-10-17/README.md).
Today's executed checks are Apple metadata/group/status reads and write/readback;
no new device installation or physical notification delivery is claimed.

[Sanitized Apple receipt](apple-receipt.json). Raw Apple review details remain
ignored local operator data. Account acceptance does not complete native-content
Workshop15/16, browser12/13, schedule6 or shared selections/reminders17.
