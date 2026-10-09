# Knowledge pipeline moved · 2026-10-09

The operator approved separate product and knowledge repositories.
Continue source indexing, transcription, editorial batches, review, registry and
work-plan updates in [daychi-knowledge](https://github.com/sleontenko/daychi-knowledge).
Local checkout: `/Users/mac-mini-server/projects/daychi-knowledge`.
Read that repository's AGENTS.md and README.md before resuming an old assignment.
Keep current stable IDs, batch assignments and manual register edits.

Daychi retains the app, website, wiki UI, server, authorization and runtime/import
endpoints. Existing content v1 JSON imports are retained; no deployment or new
production import is authorized by this repository migration.

Existing pipeline branches preserve historical work. They are not the location
for new pipeline changes. Transfer any unfinished pipeline edits to a dedicated
branch in daychi-knowledge; application/server changes still target Daychi.
Private data never enters either Git repository. On the coordinator's Mac Mini,
old pipeline data paths resolve through compatibility symlinks to the new local
data directory, preserving absolute paths recorded in proofs and assignments.

The initial knowledge snapshot includes current workspace versions as listed in
`migration/source-manifest.json`; Daychi's unrelated uncommitted work is preserved.
