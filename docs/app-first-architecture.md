# App-first architecture

- **Date:** 2026-07-21
- **Status:** first vertical slice implemented
- **Product surface:** iOS, Android and web; Telegram becomes an optional client
  and notification channel rather than the product boundary.

## Goal

Turn the current research and ingestion repository into a product without
rewriting the parts that already work. The first milestone is intentionally
small: a real user can open an app, browse the current corpus, search it and ask
for a starting point.

```text
Telegram channels ──> existing ingestion/enrichment ──> local artifacts
                                                        │
                                                        ▼
                                             read-only Knowledge API
                                           ┌────────────┼────────────┐
                                           │            │            │
                                    local navigation  Bedrock      Gemini
                                                     Claude       fallback
                                           │            │            │
                                           └────────────┼────────────┘
                                                       ▼
                                             Expo universal app
                                           iOS · Android · web
```

## Decisions in this slice

1. **No corpus migration yet.** `practice_api` reads `ingest.db` and
   `notebook_plan.json` in place. This validates the product flow before a cloud
   schema, RLS and migration create irreversible work.
2. **NotebookLM stays outside the request path.** It remains useful for curator
   research and batch classification, but the application does not depend on
   browser automation or a personal NotebookLM session.
3. **The app is universal from day one.** Expo SDK 57 / React Native 0.86 gives
   one TypeScript client for native iOS, native Android and static web output.
4. **AI is an enhancement, not availability infrastructure.** Local retrieval
   always returns a navigation result. Claude through Amazon Bedrock is the
   primary generator, Gemini is the secondary provider, and local navigation is
   the final fallback.
5. **Secrets are server-only.** The client knows only `EXPO_PUBLIC_API_URL`.
   Gemini credentials never enter the Expo environment or bundle.
6. **No copied AWS secrets.** Local development uses the existing
   `bedrock-cogito-agent` named profile; deployment can use an IAM role through
   the standard boto3 credential chain.
7. **Private by default.** The current API binds locally during development.
   It must not be exposed publicly before authentication and access control.

## Implemented contract

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/health` | Corpus and provider readiness without secret values |
| `GET /api/v1/overview` | Counts and aggregated topics |
| `GET /api/v1/topics` | Topic navigation |
| `GET /api/v1/materials` | Filtered and ranked material index |
| `POST /api/v1/ask` | Retrieval plus Bedrock Claude, Gemini and local fallback |

The API removes URLs from display titles, keeps source URLs as separate fields
and collapses obvious same-day title duplicates for a cleaner product surface.

## Next milestones

### 1. Private alpha

- add Supabase Auth and a closed membership whitelist;
- move the catalog to Postgres with Russian FTS and RLS;
- keep audio and raw transcripts private and encrypted;
- ship internal iOS/Android builds to 5–10 testers;
- collect a fixed evaluation set of real questions.

### 2. Grounded answers

- connect reviewed transcripts and PDF text to material records;
- retrieve evidence chunks rather than titles only;
- require citations for generated claims;
- compare Postgres FTS with hybrid FTS + pgvector on the evaluation set;
- add human review for taxonomy and learning paths.

### 3. Product expansion

- saved materials, progress and personal practice paths;
- audio playback, transcript navigation and offline caching;
- Telegram Mini App using the same web client and backend;
- bot notifications and deep links into the app;
- App Store / Google Play distribution after privacy and support flows are ready.

## Current provider status

`bedrock-cogito-agent` is valid in `us-east-1`, Claude Sonnet 4.6 is active, and
an end-to-end `/ask` invocation succeeds. The previously found Gemini credential
still returns Google `RESOURCE_EXHAUSTED`, but this no longer affects the main
request path.

The product limitation is now evidence depth: answers are grounded in titles
and metadata until reviewed transcripts are connected.
