"""Strict wire models for the separately requested structured wiki article layer."""
import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Identity = Annotated[str, Field(pattern=r'^[A-Za-z0-9_.:-]{1,160}$')]
Resource = Annotated[str, Field(pattern=r'^[A-Za-z0-9_-]{11}$')]
Digest = Annotated[str, Field(pattern=r'^[0-9a-f]{64}$')]
Revision = Annotated[int, Field(strict=True, ge=1, le=100000)]
Text = Annotated[str, Field(min_length=1, max_length=6000)]


def folded(value):
    return ' '.join(value.casefold().replace('ё', 'е').split())


def readable(value):
    cleaned = re.sub(r'https?://\S+|(?:[\w-]+\.)*(?:youtube(?:-nocookie)?\.com|youtu\.be)[/?]\S+', '', value, flags=re.I)
    cleaned = re.sub(r'(?:код\s*доступа|пароль|password|passcode)\s*:?\s*\S+', '', cleaned, flags=re.I).strip()
    if not value.strip() or cleaned != value:
        raise ValueError('Reader text must be safe without changing inline offsets')
    return value


def unique(items, key=lambda value: value):
    if len({key(item) for item in items}) != len(items):
        raise ValueError('Duplicate identity or reference')


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)


class Source(StrictModel):
    resource_id: Resource
    material_id: Identity
    expected_title: str = Field(min_length=1, max_length=1000)
    content_revision: Revision
    transcript_sha256: Digest
    subtitles_sha256: Digest

    @model_validator(mode='after')
    def safe_title(self):
        readable(self.expected_title)
        return self


class Evidence(StrictModel):
    id: Identity
    resource_id: Resource
    text: Text
    start_seconds: float = Field(ge=0, le=100000)
    end_seconds: float = Field(gt=0, le=100000)

    @model_validator(mode='after')
    def valid(self):
        readable(self.text)
        if self.end_seconds <= self.start_seconds:
            raise ValueError('Invalid evidence interval')
        return self


class Mention(StrictModel):
    start: int = Field(strict=True, ge=0)
    end: int = Field(strict=True, gt=0)
    link_id: Identity


class Claim(StrictModel):
    id: Identity
    text: Text
    evidence_ids: list[Identity] = Field(min_length=1, max_length=100)
    mentions: list[Mention] = Field(default_factory=list, max_length=30)

    @model_validator(mode='after')
    def valid(self):
        readable(self.text)
        unique(self.evidence_ids)
        previous = 0
        for mention in self.mentions:
            if not previous <= mention.start < mention.end <= len(self.text):
                raise ValueError('Mention ranges must be ordered, nonoverlapping code points')
            previous = mention.end
        return self


class Section(StrictModel):
    id: Identity
    heading: str = Field(min_length=1, max_length=200)
    claim_ids: list[Identity] = Field(min_length=1, max_length=200)


class Related(StrictModel):
    material_id: Identity
    via_concept_id: str = Field(pattern=r'^[a-z][a-z0-9-]{1,79}$')
    supporting_link_ids: list[Identity] = Field(min_length=2, max_length=2)
    reason: str = Field(min_length=1, max_length=1000)


class Article(StrictModel):
    material_id: Identity
    resource_id: Resource
    revision: Revision
    status: Literal['source_checked_draft'] = 'source_checked_draft'
    introduction_claim_ids: list[Identity] = Field(min_length=1, max_length=5)
    sections: list[Section] = Field(min_length=1, max_length=20)
    claims: list[Claim] = Field(min_length=1, max_length=200)
    related: list[Related] = Field(default_factory=list, max_length=20)

    @model_validator(mode='after')
    def layout(self):
        unique(self.claims, lambda item: item.id)
        unique(self.sections, lambda item: item.id)
        unique(self.related, lambda item: item.material_id)
        placed = [*self.introduction_claim_ids, *(i for s in self.sections for i in s.claim_ids)]
        unique(placed)
        if set(placed) != {claim.id for claim in self.claims}:
            raise ValueError('Every paragraph must be placed exactly once')
        for section in self.sections:
            readable(section.heading)
        for related in self.related:
            readable(related.reason)
        return self


class Concept(StrictModel):
    id: str = Field(pattern=r'^[a-z][a-z0-9-]{1,79}$')
    kind: Literal['term', 'topic']
    title: str = Field(min_length=2, max_length=200)
    aliases: list[str] = Field(default_factory=list, max_length=12)
    revision: Revision
    status: Literal['source_checked_draft'] = 'source_checked_draft'
    claims: list[Claim] = Field(min_length=1, max_length=30)

    @model_validator(mode='after')
    def valid(self):
        unique(self.claims, lambda item: item.id)
        labels = [self.title, *self.aliases]
        unique(labels, folded)
        for label in labels:
            if not 2 <= len(label) <= 200:
                raise ValueError('Invalid concept label')
            readable(label)
        if any(claim.mentions for claim in self.claims):
            raise ValueError('Concept claims do not contain material inline mentions')
        return self


class Link(StrictModel):
    id: Identity
    resource_id: Resource
    concept_id: str = Field(pattern=r'^[a-z][a-z0-9-]{1,79}$')
    relation: Literal['explains', 'practices', 'discusses']
    rationale: str = Field(min_length=1, max_length=1000)
    evidence_ids: list[Identity] = Field(min_length=1, max_length=100)


class Review(StrictModel):
    editor: str = Field(min_length=1, max_length=80)
    reviewer: str = Field(min_length=1, max_length=80)
    editorial_sha256: Digest
    review_sha256: Digest
    decision: Literal['pass']
    full_source_read: Literal[True]

    @model_validator(mode='after')
    def independent(self):
        if folded(self.editor) == folded(self.reviewer):
            raise ValueError('A separate reviewer is required')
        return self


class ArticleDocument(StrictModel):
    format: Literal['daychi-wiki-articles/1']
    batch_id: str = Field(pattern=r'^[a-zA-Z0-9_-]{1,80}$')
    sources: list[Source] = Field(min_length=1, max_length=100)
    articles: list[Article] = Field(min_length=1, max_length=100)
    concepts: list[Concept] = Field(default_factory=list, max_length=100)
    links: list[Link] = Field(default_factory=list, max_length=300)
    evidence: list[Evidence] = Field(min_length=1, max_length=1000)

    @model_validator(mode='after')
    def references(self):
        for items, key in [(self.sources, lambda x: x.resource_id), (self.sources, lambda x: x.material_id),
                           (self.articles, lambda x: x.material_id), (self.concepts, lambda x: x.id),
                           (self.links, lambda x: x.id), (self.evidence, lambda x: x.id)]:
            unique(items, key)
        sources = {s.resource_id: s for s in self.sources}
        evidence = {e.id: e for e in self.evidence}
        concepts = {c.id: c for c in self.concepts}
        links = {link.id: link for link in self.links}
        if any(e.resource_id not in sources for e in self.evidence):
            raise ValueError('Evidence must belong to a pinned source')

        def citations(ids, resource=None):
            unique(ids)
            if any(i not in evidence or resource and evidence[i].resource_id != resource for i in ids):
                raise ValueError('Unknown or wrong-source evidence')

        for concept in self.concepts:
            for claim in concept.claims:
                citations(claim.evidence_ids)
        for link in self.links:
            readable(link.rationale)
            if link.resource_id not in sources or link.concept_id not in concepts:
                raise ValueError('Link must resolve to a pinned source and included concept')
            citations(link.evidence_ids, link.resource_id)
            if not any(set(link.evidence_ids) & set(c.evidence_ids) for c in concepts[link.concept_id].claims):
                raise ValueError('Every relation must support a concept claim')
        for article in self.articles:
            source = sources.get(article.resource_id)
            if not source or source.material_id != article.material_id:
                raise ValueError('Article must match its pinned material')
            for claim in article.claims:
                citations(claim.evidence_ids, article.resource_id)
                for mention in claim.mentions:
                    link = links.get(mention.link_id)
                    if not link or link.resource_id != article.resource_id:
                        raise ValueError('Inline mention must resolve to its material relation')
            for related in article.related:
                supporting = [links.get(i) for i in related.supporting_link_ids]
                if (related.material_id == article.material_id or None in supporting or
                        len(set(related.supporting_link_ids)) != 2 or
                        any(l.concept_id != related.via_concept_id for l in supporting) or
                        {sources[l.resource_id].material_id for l in supporting} !=
                        {article.material_id, related.material_id}):
                    raise ValueError('Related article requires a reviewed shared-concept path')
        return self


class ArticleBatch(ArticleDocument):
    review: Review
