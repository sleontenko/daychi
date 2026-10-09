# Legacy wiki PR reconciliation · 2026-10-09

The operator requested merging the remaining wiki PRs after the repository split.
Editorial history is retained in [daychi-knowledge](https://github.com/sleontenko/daychi-knowledge),
with exact original heads and per-file SHA-256 in `migration/legacy-prs.json`.
Historical variants are archived separately; they do not replace current protocols.

- [PR #4](https://github.com/sleontenko/daychi/pull/4): batch 09, already imported;
  its journal and QA are in knowledge. The historical total of 176 does not replace
  the later 476 summary snapshot. This merge does not import content again.
- [PR #6](https://github.com/sleontenko/daychi/pull/6): batches 10–19, already
  imported (300 summaries / 900 excerpts). All ten journals, individual QA and
  the combined QA are retained in knowledge. The cumulative snapshot is
  476 summaries / 1428 excerpts; 431 independently reviewed, 45 still requiring
  independent review. This merge preserves that history without another import.

The product repository keeps forwarding documentation. New editorial work,
assignments, review and batch QA belong to knowledge. Runtime and wiki UI changes
remain here. Repository merges do not authorize deployment or production imports.
