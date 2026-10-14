"""Coexisting Drive archive articles, reviewed as machine text, never as audio."""
import re
from typing import Annotated, Literal

from pydantic import Field, model_validator

from .wiki_article_models import (
    Article, ArticleDocument, Concept, Digest, Evidence, Identity, Link, Review,
    Source, StrictModel, readable, unique,
)

ArchiveResource = Annotated[str, Field(pattern=r'^(?:[A-Za-z0-9_-]{11}|drive:[A-Za-z0-9_-]{10,200})$')]
DriveResource = Annotated[str, Field(pattern=r'^drive:[A-Za-z0-9_-]{10,200}$')]
DraftStatus = Literal['source_checked_draft', 'text_reviewed_asr_draft']


class ArchiveAlias(StrictModel):
    resource_id: DriveResource
    title: str = Field(min_length=1, max_length=1000)
    original_sha256: Digest
    original_bytes: int = Field(strict=True, gt=0, le=100_000_000_000)

    @model_validator(mode='after')
    def safe(self):
        readable(self.title)
        return self


class PairedHashes(StrictModel):
    turbo: Digest
    parakeet: Digest


class CorrectedASR(StrictModel):
    full_text_sha256: dict[Identity, Digest] = Field(min_length=2, max_length=2)
    model_ids: dict[Identity, str] = Field(min_length=2, max_length=2)
    provenance_sha256: Digest
    quarantine_sha256: Digest

    @model_validator(mode='after')
    def named_pair(self):
        if set(self.full_text_sha256) != set(self.model_ids):
            raise ValueError('Corrected ASR hashes require their exact model identities')
        for model in self.model_ids.values():
            if not 1 <= len(model) <= 200:
                raise ValueError('Invalid corrected model identity')
            readable(model)
        return self


class ArchiveOrigin(StrictModel):
    collection_id: str = Field(pattern=r'^[a-z][a-z0-9-]{1,79}$')
    cohort: Literal['neidan', 'retreat2016', 'retreat2017']
    aliases: list[ArchiveAlias] = Field(min_length=1, max_length=20)
    pcm_sha256: Digest
    pcm_seconds: float = Field(strict=True, gt=0, le=100000)
    paired_asr_sha256: PairedHashes
    provenance_sha256: Digest
    quarantine_sha256: Digest
    source_warnings: list[Identity] = Field(default_factory=list, max_length=50)
    corrected_asr: CorrectedASR | None = None

    @model_validator(mode='after')
    def consistent(self):
        unique(self.aliases, lambda a: a.resource_id)
        unique(self.source_warnings)
        if len({(a.original_sha256, a.original_bytes) for a in self.aliases}) != 1:
            raise ValueError('Archive aliases must be pinned binary duplicates')
        return self


class ArchiveSource(Source):
    resource_id: ArchiveResource
    archive: ArchiveOrigin | None = None

    @model_validator(mode='after')
    def source_kind(self):
        if self.resource_id.startswith('drive:'):
            if not self.archive or self.resource_id != min(a.resource_id for a in self.archive.aliases):
                raise ValueError('Drive source requires complete aliases and their canonical smallest identity')
            if not re.fullmatch(r'[0-9a-f]{32}', self.material_id):
                raise ValueError('Archive material identity must be opaque')
        elif self.archive is not None:
            raise ValueError('Existing YouTube sources retain the v1 content authority')
        return self


class EvidenceAdmission(StrictModel):
    basis: Literal['paired_asr_text_supported']
    source_basis: Literal['original_pair', 'corrected_pair'] = 'original_pair'
    reason: str = Field(min_length=30, max_length=2000)
    clip_ids: list[Identity] = Field(min_length=1, max_length=30)
    source_warning_codes: list[Identity] = Field(default_factory=list, max_length=50)
    clip_warning_codes: list[Identity] = Field(default_factory=list, max_length=100)
    unresolved_issue_codes: list[Identity] = Field(default_factory=list, max_length=50)
    audio_verified: Literal[False] = False

    @model_validator(mode='after')
    def supported(self):
        readable(self.reason)
        for values in (self.clip_ids, self.source_warning_codes, self.clip_warning_codes,
                       self.unresolved_issue_codes):
            unique(values)
        if self.unresolved_issue_codes:
            raise ValueError('Unresolved meaning, term, negation or timing cannot support a published claim')
        return self


class ArchiveEvidence(Evidence):
    resource_id: ArchiveResource
    admission: EvidenceAdmission | None = None

    @model_validator(mode='after')
    def admission_required(self):
        if self.resource_id.startswith('drive:') and self.admission is None:
            raise ValueError('Archive evidence needs a specific independent text admission')
        if not self.resource_id.startswith('drive:') and self.admission is not None:
            raise ValueError('Legacy evidence retains its existing review profile')
        return self


class ArchiveArticle(Article):
    resource_id: ArchiveResource
    status: DraftStatus = 'text_reviewed_asr_draft'
    coverage_note: str = Field(default='', max_length=2000)

    @model_validator(mode='after')
    def truthful_status(self):
        if self.resource_id.startswith('drive:'):
            if self.status != 'text_reviewed_asr_draft' or len(self.coverage_note.strip()) < 30:
                raise ValueError('Archive article requires its text-only draft status and coverage caveat')
            readable(self.coverage_note)
        elif self.status != 'source_checked_draft' or self.coverage_note:
            raise ValueError('Existing YouTube article status is unchanged')
        return self


class ArchiveConcept(Concept):
    status: DraftStatus = 'text_reviewed_asr_draft'


class ArchiveLink(Link):
    resource_id: ArchiveResource


class ArchiveDocument(ArticleDocument):
    format: Literal['daychi-wiki-archive-articles/1']
    sources: list[ArchiveSource] = Field(min_length=1, max_length=100)
    articles: list[ArchiveArticle] = Field(min_length=1, max_length=100)
    concepts: list[ArchiveConcept] = Field(default_factory=list, max_length=100)
    links: list[ArchiveLink] = Field(default_factory=list, max_length=300)
    evidence: list[ArchiveEvidence] = Field(min_length=1, max_length=1000)

    @model_validator(mode='after')
    def archive_context(self):
        sources = {s.resource_id: s for s in self.sources}
        if not any(s.archive for s in self.sources):
            raise ValueError('Archive version must include a real Drive source')
        unique([a.resource_id for s in self.sources if s.archive for a in s.archive.aliases])
        private_ids = {a.resource_id[6:] for s in self.sources if s.archive for a in s.archive.aliases}
        public_texts = [s.expected_title for s in self.sources]
        public_texts += [text for a in self.articles for text in
                        [a.coverage_note, *(c.text for c in a.claims), *(s.heading for s in a.sections),
                         *(r.reason for r in a.related)]]
        public_texts += [text for c in self.concepts for text in
                        [c.id, c.title, *c.aliases, *(claim.text for claim in c.claims)]]
        public_texts += [l.rationale for l in self.links] + [e.text for e in self.evidence]
        if any(identity in text for identity in private_ids for text in public_texts):
            raise ValueError('Reader text cannot expose a private Drive alias identity')
        for quote in self.evidence:
            source = sources[quote.resource_id]
            if source.archive:
                if quote.end_seconds > source.archive.pcm_seconds:
                    raise ValueError('Archive evidence exceeds its PCM source')
                if set(quote.admission.source_warning_codes) != set(source.archive.source_warnings):
                    raise ValueError('Archive evidence cannot drop source diagnostics')
                if quote.admission.source_basis == 'corrected_pair' and source.archive.corrected_asr is None:
                    raise ValueError('Corrected evidence requires the pinned corrected pair')
        by_id = {e.id: e for e in self.evidence}
        for concept in self.concepts:
            if any(by_id[i].resource_id.startswith('drive:') for c in concept.claims for i in c.evidence_ids):
                if concept.status != 'text_reviewed_asr_draft':
                    raise ValueError('Archive-supported concept must disclose its machine-text basis')
        return self


class ArchiveBatch(ArchiveDocument):
    review: Review
