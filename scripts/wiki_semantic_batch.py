"""Compile a private reviewed semantic draft using existing published quote anchors."""
import argparse
import hashlib
import json
import os
from pathlib import Path

from practice_api.wiki_semantics import SemanticBatch, folded


class Snapshots:
    """Parse and hash the same bytes, even if an input is replaced during compilation."""
    def __init__(self):
        self.cache = {}

    def bytes(self, path):
        path = Path(path).resolve()
        if path not in self.cache:
            self.cache[path] = path.read_bytes()
        return self.cache[path]

    def sha(self, path):
        return hashlib.sha256(self.bytes(path)).hexdigest()

    def json(self, path):
        return json.loads(self.bytes(path))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def same(actual, expected, message):
    # JSON booleans must not impersonate integer point/claim indexes.
    require(json.dumps(actual, sort_keys=True) == json.dumps(expected, sort_keys=True), message)


def indexed(values, key, expected, label):
    require(isinstance(values, list), f'{label} must be a list')
    result = {}
    for value in values:
        require(isinstance(value, dict) and key in value, f'{label} missing {key}')
        identity = value[key]
        require(type(identity) in (str, int), f'{label} invalid identity')
        require(identity not in result, f'{label} duplicate identity')
        result[identity] = value
    require(set(result) == set(expected), f'{label} coverage differs')
    return result


def passed(value, label):
    require(isinstance(value, dict) and value.get('verdict') == 'pass', f'{label} requires pass')
    require(isinstance(value.get('reason'), str) and value['reason'].strip(), f'{label} requires reason')


def point_segments(point, segments, forbidden):
    matches = []
    for start, segment in enumerate(segments):
        if not point['text'].startswith(segment['text']):
            continue
        text = ''
        for end in range(start, len(segments)):
            text += (' ' if text else '') + segments[end]['text']
            if text == point['text']:
                matches.append(list(range(start, end + 1)))
                break
            if len(text) >= len(point['text']):
                break
    require(len(matches) == 1, 'Published point must match unique whole source segments')
    ids = matches[0]
    require(not set(ids) & set(forbidden), 'Published point intersects forbidden segments')
    require(point['start_seconds'] <= segments[ids[0]]['start_seconds'] + 1e-6 and
            point['end_seconds'] >= segments[ids[-1]]['end_seconds'] - 1e-6,
            'Published interval does not cover source quotation')
    return ids


def context_read(context, ids, count, range_key, flag_key):
    require(context.get(flag_key) is True, 'New point context was not read')
    span = context.get(range_key)
    require(isinstance(span, list) and len(span) == 2 and all(type(i) is int for i in span),
            'Invalid context range')
    require(0 <= span[0] <= ids[0] <= ids[-1] <= span[1] < count,
            'Context range does not cover quotation')


def validate_sources(snap, assignment, editor_proof, reviewer_proof, editor, reviewer):
    source_ids = [s['record']['resource_id'] for s in assignment['sources']]
    sources = {}
    for item in assignment['sources']:
        rid = item['record']['resource_id']
        require(rid not in sources, 'Duplicate assigned source')
        sources[rid] = item
    require(editor_proof.get('reader') == editor and reviewer_proof.get('reviewer') == reviewer,
            'Reading proof identities differ')
    for proof in (editor_proof, reviewer_proof):
        require(proof.get('full_text_read') is True, 'Reading proof requires full source reading')
        require(proof.get('assignment_sha256') == assignment['_snapshot_sha256'],
                'Reading proof assignment hash differs')
    same(sorted(reviewer_proof.get('read_source_ids', [])), sorted(source_ids), 'Reviewer proof source coverage differs')
    er = indexed(editor_proof.get('sources'), 'resource_id', source_ids, 'Editor proof sources')
    rr = indexed(reviewer_proof.get('records'), 'resource_id', source_ids, 'Reviewer proof sources')
    result = {}
    for rid, item in sources.items():
        source, record = item['source'], item['record']
        require(source['resource_id'] == rid and source['title'] == record['expected_title'], 'Assigned source identity differs')
        require(record['status'] == 'source_checked_draft', 'Source is not published checked content')
        folder = Path(source['txt_path']).parent
        paths = {'txt': Path(source['txt_path']), 'srt': Path(source['srt_path']),
                 'segments': folder / 'segments.json', 'info': folder / 'source.info.json'}
        for kind, path in paths.items():
            require(snap.sha(path) == source[kind + '_sha256'], 'Source snapshot hash differs')
        same(record['transcript_sha256'], source['txt_sha256'], 'Published transcript hash differs')
        same(record['subtitles_sha256'], source['srt_sha256'], 'Published subtitles hash differs')
        segments = snap.json(paths['segments'])
        require(len(segments) == source['segments'], 'Segment count differs')
        require(snap.bytes(paths['txt']).decode().strip() == '\n'.join(s['text'] for s in segments).strip(),
                'TXT differs from complete indexed segments')
        points = sorted(record['points'], key=lambda p: (p['start_seconds'], p['end_seconds'], p['text']))
        require(len(points) == 3, 'Pilot requires three published points')
        require(len({json.dumps(p, sort_keys=True) for p in points}) == len(points), 'Duplicate published points')
        ids = [point_segments(p, segments, source['forbidden_segment_indexes']) for p in points]
        ed, rev = er[rid], rr[rid]
        for proof, range_key, equality_key in ((ed, 'full_segment_range_inclusive', 'txt_equals_full_segment_text'),
                                               (rev, 'read_segment_range', 'source_txt_equals_all_indexed_segment_texts')):
            require(proof.get('full_text_read') is True and proof.get(equality_key) is True,
                    'Full indexed source reading is missing')
            same(proof.get(range_key), [0, len(segments) - 1], 'Full read range differs')
        require(Path(ed['txt_path']).resolve() == paths['txt'].resolve(), 'Editor proof TXT path differs')
        for kind in ('txt', 'srt', 'segments'):
            check = ed.get('source_hash_checks', {}).get(kind, {})
            require(check.get('matches_assignment') is True and check.get('sha256') == source[kind + '_sha256'],
                    'Editor proof source hash differs')
        if ed.get('reused_full_read') is True:
            require(snap.sha(ed['prior_read_artifact']) == ed.get('prior_read_artifact_sha256'),
                    'Prior full-read artifact hash differs')
        checks = rev.get('source_hash_checks', [])
        require(isinstance(checks, list), 'Reviewer hash checks missing')
        by_path = {str(Path(c['file']).resolve()): c for c in checks}
        require(len(by_path) == len(checks), 'Duplicate reviewer hash check')
        for kind in ('txt', 'srt', 'segments'):
            check = by_path.get(str(paths[kind].resolve()), {})
            require(check.get('verdict') == 'pass' and check.get('expected') == source[kind + '_sha256'] and
                    check.get('actual') == snap.sha(paths[kind]), 'Reviewer proof source hash differs')
        if str(paths['info'].resolve()) in by_path:
            check = by_path[str(paths['info'].resolve())]
            require(check.get('verdict') == 'pass' and check.get('expected') == source['info_sha256'] and
                    check.get('actual') == snap.sha(paths['info']), 'Reviewer metadata hash differs')
        ec = indexed(ed.get('published_point_context_reads'), 'point_index', range(3), 'Editor point contexts')
        rc = indexed(rev.get('point_checks'), 'point_index', range(3), 'Reviewer point checks')
        contexts = indexed([c for c in rev.get('new_context_reads', []) if 'point_index' in c],
                           'point_index', range(3), 'Reviewer point contexts')
        refs = []
        for pi, point in enumerate(points):
            same(ec[pi].get('point_segment_indexes'), ids[pi], 'Editor point segments differ')
            for flag in ('text_matches', 'timing_matches', 'outside_forbidden'):
                require(ec[pi].get(flag) is True, 'Editor point check failed')
            context_read(ec[pi], ids[pi], len(segments), 'context_segment_range_inclusive', 'new_context_read')
            require(rc[pi].get('verdict') == 'pass', 'Reviewer point requires pass')
            same(rc[pi].get('segment_indexes'), ids[pi], 'Reviewer point segments differ')
            for key in ('text', 'start_seconds', 'end_seconds'):
                same(rc[pi].get(key), point[key], 'Reviewer published triple differs')
            for flag in ('exact_whole_source_segments', 'timestamps_cover_quote', 'published_triple_preserved', 'forbidden_indexes_excluded'):
                require(rc[pi].get(flag) is True, 'Reviewer point check failed')
            context_read(contexts[pi], ids[pi], len(segments), 'segment_range', 'full_context_read')
            refs.append({'resource_id': rid, 'revision': record['revision'], 'point_index': pi,
                         **point, 'source_segment_indexes': ids[pi]})
        result[rid] = (record, points, refs)
    return result


def compile_batch(assignment_path, editorial_path, review_path, *, reading_proof_path=None, review_proof_path=None,
                  output_path=None):
    snap = Snapshots()
    assignment, editorial, review = [snap.json(p) for p in (assignment_path, editorial_path, review_path)]
    assignment['_snapshot_sha256'] = snap.sha(assignment_path)
    require(review.get('full_text_read') is True and review.get('verdict') == 'pass' and
            review.get('editorial_sha256') == snap.sha(editorial_path),
            'Final editorial requires a matching independent full-text review')
    editor, reviewer = review.get('editor'), review.get('reviewer')
    require(isinstance(editor, str) and isinstance(reviewer, str) and editor.strip() and reviewer.strip() and
            folded(editor) != folded(reviewer), 'Independent reviewer identity required')
    proof_path = Path(reading_proof_path) if reading_proof_path else Path(editorial_path).parent / 'source-reading-proof.json'
    reviewer_path = Path(review_proof_path) if review_proof_path else Path(review_path).parent / 'source-review-proof.json'
    editor_proof, reviewer_proof = snap.json(proof_path), snap.json(reviewer_path)
    require(review.get('source_review_proof_sha256') == snap.sha(reviewer_path), 'Reviewer reading proof hash differs')
    if 'source_reading_proof_sha256' in editorial:
        require(editorial['source_reading_proof_sha256'] == snap.sha(proof_path), 'Editor reading proof hash differs')
    sources = validate_sources(snap, assignment, editor_proof, reviewer_proof, editor, reviewer)
    for document in (editorial, review):
        require(document.get('full_text_read') is True, 'Assigned full sources were not read')
        same(sorted(document.get('read_source_ids', [])), sorted(sources), 'Assigned source coverage differs')
    drafts = indexed(editorial.get('pages'), 'concept_id', [p['concept_id'] for p in editorial.get('pages', [])], 'Editorial pages')
    reviews = indexed(review.get('pages'), 'concept_id', drafts, 'Review pages')
    pages = []
    for cid, page in drafts.items():
        checked = reviews[cid]
        passed(checked, 'Page')
        for key in ('title', 'kind'):
            same(checked.get(key), page[key], 'Reviewed page identity differs')
        aliases = checked.get('aliases_check', {})
        passed(aliases, 'Aliases')
        same(aliases.get('aliases'), page.get('aliases', []), 'Reviewed aliases differ')
        claim_reviews = indexed(checked.get('claims'), 'claim_index', range(len(page['claims'])), 'Review claims')
        link_reviews = indexed(checked.get('links'), 'link_index', range(len(page['links'])), 'Review links')
        links, refs_by_link = [], []
        for li, link in enumerate(page['links']):
            require(link['resource_id'] in sources, 'Link uses unassigned source')
            record, points, refs = sources[link['resource_id']]
            indexes = link['point_indexes']
            require(isinstance(indexes, list) and indexes and len(set(indexes)) == len(indexes) and
                    all(type(i) is int and 0 <= i < len(points) for i in indexes) and indexes == sorted(indexes),
                    'Invalid or unordered published quotation selection')
            expected_refs = [refs[i] for i in indexes]
            checked_link = link_reviews[li]
            passed(checked_link, 'Link')
            for key in ('resource_id', 'relation', 'rationale'):
                same(checked_link.get(key), link[key], 'Reviewed link identity or rationale differs')
            same(checked_link.get('point_refs'), expected_refs, 'Reviewed link point refs differ')
            require(checked_link.get('rationale_verdict') == 'pass' and checked_link.get('new_full_context_read') is True,
                    'Link rationale and context require review pass')
            quote_checks = checked_link.get('quote_checks', {})
            require(quote_checks.get('verdict') == 'pass' and quote_checks.get('source_hashes') == 'pass',
                    'Link quotations require review pass')
            for flag in ('exact_published_text_start_end', 'sorted_point_indexes', 'whole_source_segments', 'forbidden_indexes_excluded'):
                require(quote_checks.get(flag) is True, 'Link quotation check failed')
            refs_by_link.append(expected_refs)
            links.append({'resource_id': link['resource_id'], 'expected_title': record['expected_title'],
                          'source_revision': record['revision'], 'transcript_sha256': record['transcript_sha256'],
                          'subtitles_sha256': record['subtitles_sha256'], 'relation': link['relation'],
                          'rationale': link['rationale'], 'points': [points[i] for i in indexes]})
        for ci, claim in enumerate(page['claims']):
            checked_claim = claim_reviews[ci]
            passed(checked_claim, 'Claim')
            for key in ('text', 'evidence_indexes'):
                same(checked_claim.get(key), claim[key], 'Reviewed claim text or evidence differs')
            indexes = claim['evidence_indexes']
            require(isinstance(indexes, list) and indexes and len(set(indexes)) == len(indexes) and
                    all(type(i) is int and 0 <= i < len(links) for i in indexes), 'Invalid claim evidence')
            expected_refs = [ref for i in indexes for ref in refs_by_link[i]]
            same(checked_claim.get('point_refs'), expected_refs, 'Reviewed claim point refs differ')
        value = {k: v for k, v in page.items() if k != 'links'}
        value['links'] = links
        pages.append(value)
    batch = SemanticBatch(batch_id=assignment['batch_id'], pages=pages, review={
        'editor': editor, 'reviewer': reviewer, 'editorial_sha256': snap.sha(editorial_path),
        'review_sha256': snap.sha(review_path), 'verdict': 'pass', 'full_text_read': True})
    if output_path is not None:
        require(Path(output_path).resolve() not in snap.cache,
                'Output must be separate from every input, source and reading artifact')
    return batch


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assignment', type=Path, required=True)
    parser.add_argument('--editorial', type=Path, required=True)
    parser.add_argument('--review', type=Path, required=True)
    parser.add_argument('--reading-proof', type=Path)
    parser.add_argument('--review-proof', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    batch = compile_batch(args.assignment, args.editorial, args.review,
                          reading_proof_path=args.reading_proof, review_proof_path=args.review_proof,
                          output_path=args.output)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    inputs = [args.assignment, args.editorial, args.review,
              args.reading_proof or args.editorial.parent / 'source-reading-proof.json',
              args.review_proof or args.review.parent / 'source-review-proof.json']
    if args.output.resolve() in {p.resolve() for p in inputs}:
        parser.error('output must be separate from inputs')
    temporary = args.output.with_name(args.output.name + '.tmp')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as out:
        out.write(batch.model_dump_json(indent=2))
    os.replace(temporary, args.output)
    args.output.chmod(0o600)
    print(f'Validated {len(batch.pages)} pages / {sum(len(p.links) for p in batch.pages)} source-bound semantic relations')


if __name__ == '__main__':
    main()
