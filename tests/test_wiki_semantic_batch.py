"""Synthetic-only regressions for private semantic review compilation."""
import copy
import hashlib
import json
from collections import Counter
from pathlib import Path

import pytest

from scripts.wiki_semantic_batch import compile_batch


def sha(value):
    return hashlib.sha256(value).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


class Fixture:
    def __init__(self, root, *, tied_times=False):
        self.root = root
        self.paths = {name: root / (name + '.json') for name in
                      ('assignment', 'editorial', 'review', 'source-reading-proof', 'source-review-proof')}
        self.assignment = {'batch_id': 'synthetic-semantic', 'sources': []}
        self.editorial = {'full_text_read': True, 'read_source_ids': [], 'pages': []}
        self.review = {'editor': 'synthetic-editor', 'reviewer': 'synthetic-reviewer',
                       'full_text_read': True, 'verdict': 'pass', 'read_source_ids': [], 'pages': []}
        self.reading = {'reader': self.review['editor'], 'full_text_read': True, 'sources': []}
        self.proof = {'reviewer': self.review['reviewer'], 'full_text_read': True,
                      'read_source_ids': [], 'records': []}
        links, reviewed_links, claims, reviewed_claims = [], [], [], []
        for li, rid in enumerate(('abcdefghijk', 'lmnopqrstuv')):
            folder = root / rid
            folder.mkdir()
            segments = [{'text': f'Synthetic source {li}, complete quotation number {pi}.',
                         'start_seconds': float(10 + pi * 20), 'end_seconds': float(15 + pi * 20)}
                        for pi in range(3)]
            if tied_times:
                segments[1]['start_seconds'] = segments[0]['start_seconds']
                segments[1]['end_seconds'] = segments[0]['end_seconds']
            write_json(folder / 'segments.json', segments)
            (folder / 'source.txt').write_text('\n'.join(p['text'] for p in segments) + '\n')
            (folder / 'source.srt').write_text('Synthetic subtitles only.\n')
            write_json(folder / 'source.info.json', {'fixture': li})
            meta = {'resource_id': rid, 'title': f'Synthetic lesson {li}', 'segments': 3,
                    'txt_path': str(folder / 'source.txt'), 'srt_path': str(folder / 'source.srt'),
                    'forbidden_segment_indexes': []}
            for kind, filename in [('txt', 'source.txt'), ('srt', 'source.srt'),
                                   ('segments', 'segments.json'), ('info', 'source.info.json')]:
                meta[kind + '_sha256'] = sha((folder / filename).read_bytes())
            record = {'resource_id': rid, 'expected_title': meta['title'], 'revision': 1,
                      'status': 'source_checked_draft', 'transcript_sha256': meta['txt_sha256'],
                      'subtitles_sha256': meta['srt_sha256'], 'points': copy.deepcopy(segments)}
            self.assignment['sources'].append({'record': record, 'source': meta})
            refs = [{'resource_id': rid, 'revision': 1, 'point_index': pi,
                     **point, 'source_segment_indexes': [pi]} for pi, point in enumerate(segments)]
            self.reading['sources'].append({'resource_id': rid, 'txt_path': meta['txt_path'],
                'full_text_read': True, 'reused_full_read': False, 'full_segment_range_inclusive': [0, 2],
                'txt_equals_full_segment_text': True,
                'source_hash_checks': {kind: {'sha256': meta[kind + '_sha256'], 'matches_assignment': True}
                                       for kind in ('txt', 'srt', 'segments')},
                'published_point_context_reads': [{'point_index': pi, 'point_segment_indexes': [pi],
                    'context_segment_range_inclusive': [0, 2], 'text_matches': True, 'timing_matches': True,
                    'outside_forbidden': True, 'new_context_read': True} for pi in range(3)]})
            self.proof['records'].append({'resource_id': rid, 'full_text_read': True,
                'reused_full_read': False, 'new_full_read': True, 'read_segment_range': [0, 2],
                'source_txt_equals_all_indexed_segment_texts': True,
                'source_hash_checks': [{'file': str(folder / filename), 'expected': meta[kind + '_sha256'],
                    'actual': meta[kind + '_sha256'], 'verdict': 'pass'} for kind, filename in
                    [('txt', 'source.txt'), ('srt', 'source.srt'), ('segments', 'segments.json'), ('info', 'source.info.json')]],
                'point_checks': [{'point_index': pi, 'segment_indexes': [pi], **point, 'verdict': 'pass',
                    'exact_whole_source_segments': True, 'timestamps_cover_quote': True,
                    'published_triple_preserved': True, 'forbidden_indexes_excluded': True}
                    for pi, point in enumerate(segments)],
                'new_context_reads': [{'point_index': pi, 'segment_range': [0, 2], 'full_context_read': True}
                                      for pi in range(3)]})
            rationale = f'Synthetic lesson {li} explains its independently reviewed topic.'
            links.append({'resource_id': rid, 'relation': 'explains', 'rationale': rationale, 'point_indexes': [0]})
            reviewed_links.append({'link_index': li, 'resource_id': rid, 'relation': 'explains',
                'rationale': rationale, 'verdict': 'pass', 'rationale_verdict': 'pass',
                'reason': 'Synthetic source context supports this relationship.', 'new_full_context_read': True,
                'point_refs': [refs[0]], 'quote_checks': {'verdict': 'pass', 'source_hashes': 'pass',
                    'exact_published_text_start_end': True, 'sorted_point_indexes': True,
                    'whole_source_segments': True, 'forbidden_indexes_excluded': True}})
            text = f'This synthetic statement is supported by lesson {li} in its own context.'
            claims.append({'text': text, 'evidence_indexes': [li]})
            reviewed_claims.append({'claim_index': li, 'text': text, 'evidence_indexes': [li],
                'verdict': 'pass', 'reason': 'Synthetic quotation and its context support this claim.',
                'point_refs': [refs[0]]})
        ids = [s['record']['resource_id'] for s in self.assignment['sources']]
        for doc in (self.editorial, self.review, self.proof):
            doc['read_source_ids'] = ids.copy()
        self.editorial['pages'] = [{'concept_id': 'synthetic-topic', 'kind': 'topic', 'title': 'Synthetic topic',
            'aliases': [], 'revision': 1, 'status': 'source_checked_draft', 'claims': claims, 'links': links}]
        self.review['pages'] = [{'concept_id': 'synthetic-topic', 'kind': 'topic', 'title': 'Synthetic topic',
            'verdict': 'pass', 'reason': 'Every synthetic claim and link has a review.',
            'claims': reviewed_claims, 'links': reviewed_links,
            'aliases_check': {'verdict': 'pass', 'reason': 'No synonyms were introduced.', 'aliases': []}}]
        self.save()

    def save(self):
        write_json(self.paths['assignment'], self.assignment)
        assignment_hash = sha(self.paths['assignment'].read_bytes())
        for proof in (self.reading, self.proof):
            proof['assignment_sha256'] = assignment_hash
        write_json(self.paths['source-reading-proof'], self.reading)
        write_json(self.paths['source-review-proof'], self.proof)
        self.editorial['source_reading_proof_sha256'] = sha(self.paths['source-reading-proof'].read_bytes())
        write_json(self.paths['editorial'], self.editorial)
        self.review['editorial_sha256'] = sha(self.paths['editorial'].read_bytes())
        self.review['source_review_proof_sha256'] = sha(self.paths['source-review-proof'].read_bytes())
        write_json(self.paths['review'], self.review)

    def compile(self, **kwargs):
        return compile_batch(self.paths['assignment'], self.paths['editorial'], self.paths['review'], **kwargs)


@pytest.fixture
def bundle(tmp_path):
    return Fixture(tmp_path)


def test_valid_bundle_selects_sorted_points_and_binds_exact_review_bytes(bundle):
    for source in bundle.assignment['sources']:
        source['record']['points'].reverse()
    bundle.save()
    batch = bundle.compile()
    for link in batch.pages[0].links:
        assert link.points[0].start_seconds == 10
    assert batch.review.editorial_sha256 == sha(bundle.paths['editorial'].read_bytes())
    assert batch.review.review_sha256 == sha(bundle.paths['review'].read_bytes())


def test_equal_time_points_use_text_as_canonical_tiebreaker(tmp_path):
    bundle = Fixture(tmp_path, tied_times=True)
    for source in bundle.assignment['sources']:
        source['record']['points'].reverse()
    bundle.save()
    batch = bundle.compile()
    for link in batch.pages[0].links:
        assert link.points[0].text.endswith('quotation number 0.')


def test_every_input_is_read_once_even_when_files_are_replaced_after_read(bundle, monkeypatch):
    original = Path.read_bytes
    expected_review_hash = sha(original(bundle.paths['review']))
    reads = Counter()
    def read_once(path):
        resolved = path.resolve()
        reads[resolved] += 1
        value = original(path)
        if resolved == bundle.paths['review'].resolve():
            path.write_text('{"verdict":"blocked"}')
        return value
    monkeypatch.setattr(Path, 'read_bytes', read_once)
    result = bundle.compile()
    assert result.review.review_sha256 == expected_review_hash
    assert all(count == 1 for count in reads.values())
    assert set(bundle.paths.values()) <= set(reads)


def test_unreviewed_parse_cannot_be_bound_to_replacement_editorial_sha(bundle, monkeypatch):
    path = bundle.paths['editorial']
    reviewed_bytes = path.read_bytes()
    unreviewed = copy.deepcopy(bundle.editorial)
    unreviewed['pages'][0]['claims'][0]['text'] = 'An unreviewed synthetic claim replacing the reviewed statement.'
    write_json(path, unreviewed)
    original = Path.read_bytes
    def replace_after_read(input_path):
        value = original(input_path)
        if input_path.resolve() == path.resolve():
            path.write_bytes(reviewed_bytes)
        return value
    monkeypatch.setattr(Path, 'read_bytes', replace_after_read)
    with pytest.raises(ValueError, match='matching independent'):
        bundle.compile()


@pytest.mark.parametrize('mutation', ['bare-verdicts', 'duplicate-claim', 'duplicate-link', 'duplicate-page',
    'claim-text', 'claim-evidence', 'claim-refs', 'link-resource', 'link-relation', 'link-rationale',
    'point-text', 'point-time', 'point-revision', 'point-segments', 'rationale-verdict', 'quote-verdict',
    'quote-flag', 'no-context', 'reviewer-source-coverage', 'page-title', 'aliases'])
def test_review_must_identify_every_exact_claim_link_and_quote(bundle, mutation):
    page = bundle.review['pages'][0]
    claim, link = page['claims'][0], page['links'][0]
    if mutation == 'bare-verdicts':
        page['claims'] = [{'verdict': 'pass'}] * 2
        page['links'] = [{'verdict': 'pass'}] * 2
    elif mutation == 'duplicate-claim': page['claims'][1] = copy.deepcopy(claim)
    elif mutation == 'duplicate-link': page['links'][1] = copy.deepcopy(link)
    elif mutation == 'duplicate-page': bundle.review['pages'].append(copy.deepcopy(page))
    elif mutation == 'claim-text': claim['text'] += ' A different claim.'
    elif mutation == 'claim-evidence': claim['evidence_indexes'] = [1]
    elif mutation == 'claim-refs': claim['point_refs'] = []
    elif mutation == 'link-resource': link['resource_id'] = 'lmnopqrstuv'
    elif mutation == 'link-relation': link['relation'] = 'practices'
    elif mutation == 'link-rationale': link['rationale'] += ' A different rationale.'
    elif mutation == 'point-text': link['point_refs'][0]['text'] += ' Fabricated.'
    elif mutation == 'point-time': link['point_refs'][0]['start_seconds'] += 1
    elif mutation == 'point-revision': link['point_refs'][0]['revision'] += 1
    elif mutation == 'point-segments': link['point_refs'][0]['source_segment_indexes'] = [1]
    elif mutation == 'rationale-verdict': link['rationale_verdict'] = 'needs_changes'
    elif mutation == 'quote-verdict': link['quote_checks']['verdict'] = 'blocked'
    elif mutation == 'quote-flag': link['quote_checks']['forbidden_indexes_excluded'] = False
    elif mutation == 'no-context': link['new_full_context_read'] = False
    elif mutation == 'reviewer-source-coverage': bundle.review['read_source_ids'] = []
    elif mutation == 'page-title': page['title'] = 'Different topic'
    elif mutation == 'aliases': page['aliases_check']['aliases'] = ['A different concept']
    bundle.save()
    with pytest.raises(ValueError): bundle.compile()


@pytest.mark.parametrize('mutation', ['review-proof-hash', 'editor-proof-hash', 'assignment-hash',
    'source-bytes', 'source-revision-refs', 'published-source-hash', 'forbidden', 'editor-full-range',
    'reviewer-full-range', 'editor-coverage', 'reviewer-coverage', 'point-context-coverage',
    'point-source-segments', 'proof-source-hash', 'editor-identity', 'reviewer-identity'])
def test_reading_proofs_bind_all_sources_and_new_point_contexts(bundle, mutation):
    if mutation == 'review-proof-hash':
        bundle.proof['new_field'] = 'changed after independent review'
        write_json(bundle.paths['source-review-proof'], bundle.proof)
    elif mutation == 'editor-proof-hash':
        bundle.reading['new_field'] = 'changed after editorial'
        write_json(bundle.paths['source-reading-proof'], bundle.reading)
    elif mutation == 'source-bytes':
        Path(bundle.assignment['sources'][0]['source']['txt_path']).write_text('Changed source.\n')
    else:
        if mutation == 'assignment-hash': bundle.proof['assignment_sha256'] = '0' * 64
        elif mutation == 'source-revision-refs': bundle.assignment['sources'][0]['record']['revision'] = 2
        elif mutation == 'published-source-hash': bundle.assignment['sources'][0]['record']['transcript_sha256'] = '0' * 64
        elif mutation == 'forbidden': bundle.assignment['sources'][0]['source']['forbidden_segment_indexes'] = [0]
        elif mutation == 'editor-full-range': bundle.reading['sources'][0]['full_segment_range_inclusive'] = [1, 2]
        elif mutation == 'reviewer-full-range': bundle.proof['records'][0]['read_segment_range'] = [1, 2]
        elif mutation == 'editor-coverage': bundle.reading['sources'].pop()
        elif mutation == 'reviewer-coverage': bundle.proof['records'].pop()
        elif mutation == 'point-context-coverage': bundle.proof['records'][0]['new_context_reads'][0]['segment_range'] = [1, 2]
        elif mutation == 'point-source-segments': bundle.proof['records'][0]['point_checks'][0]['segment_indexes'] = [1]
        elif mutation == 'proof-source-hash': bundle.proof['records'][0]['source_hash_checks'][0]['actual'] = '0' * 64
        elif mutation == 'editor-identity': bundle.reading['reader'] = 'someone-else'
        elif mutation == 'reviewer-identity': bundle.proof['reviewer'] = 'someone-else'
        bundle.save()
        if mutation == 'assignment-hash':
            bundle.proof['assignment_sha256'] = '0' * 64
            write_json(bundle.paths['source-review-proof'], bundle.proof)
            bundle.review['source_review_proof_sha256'] = sha(bundle.paths['source-review-proof'].read_bytes())
            write_json(bundle.paths['review'], bundle.review)
    with pytest.raises(ValueError): bundle.compile()


def test_editor_proof_accepts_existing_format_without_top_level_editorial_hash(bundle):
    del bundle.editorial['source_reading_proof_sha256']
    write_json(bundle.paths['editorial'], bundle.editorial)
    bundle.review['editorial_sha256'] = sha(bundle.paths['editorial'].read_bytes())
    write_json(bundle.paths['review'], bundle.review)
    assert len(bundle.compile().pages) == 1


@pytest.mark.parametrize('protected', ['txt', 'segments', 'proof', 'prior-read'])
def test_output_cannot_replace_any_read_source_or_proof(bundle, protected):
    if protected == 'txt':
        output = Path(bundle.assignment['sources'][0]['source']['txt_path'])
    elif protected == 'segments':
        output = Path(bundle.assignment['sources'][0]['source']['txt_path']).parent / 'segments.json'
    elif protected == 'proof':
        output = bundle.paths['source-reading-proof']
    else:
        output = bundle.root / 'prior-read.json'
        write_json(output, {'synthetic_prior_full_read': True})
        proof = bundle.reading['sources'][0]
        proof['reused_full_read'] = True
        proof['prior_read_artifact'] = str(output)
        proof['prior_read_artifact_sha256'] = sha(output.read_bytes())
        bundle.save()
    before = output.read_bytes()
    with pytest.raises(ValueError, match='every input, source and reading artifact'):
        bundle.compile(output_path=output)
    assert output.read_bytes() == before


def test_output_may_target_a_separate_artifact(bundle):
    output = bundle.root / 'compiled-batch.json'
    assert len(bundle.compile(output_path=output).pages) == 1
    assert not output.exists()  # Compilation itself does not write the artifact.


def test_link_point_indexes_must_follow_the_declared_sorted_order(bundle):
    bundle.editorial['pages'][0]['links'][0]['point_indexes'] = [1, 0]
    rid = bundle.assignment['sources'][0]['record']['resource_id']
    points = bundle.assignment['sources'][0]['record']['points']
    refs = [{'resource_id': rid, 'revision': 1, 'point_index': i, **points[i],
             'source_segment_indexes': [i]} for i in [1, 0]]
    bundle.review['pages'][0]['links'][0]['point_refs'] = copy.deepcopy(refs)
    bundle.review['pages'][0]['claims'][0]['point_refs'] = copy.deepcopy(refs)
    bundle.save()
    with pytest.raises(ValueError, match='unordered published quotation'):
        bundle.compile()
