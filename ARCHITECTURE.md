# DesignLens — Target Architecture

A north-star architecture for upgrading DesignLens from the current demo (Next.js + FastAPI + Claude
vision + SQLite) into a production-grade, multi-user, searchable visual catalogue for an architecture/
design studio. Build it **in phases** (see Roadmap); each phase ships something working.

> Honesty constraints carry over: sample/royalty-free images only, vision via the Claude API (no trained
> CV model), never claim production/real-studio data. Keep the `ANTHROPIC_API_KEY` server-side only.

---

## 1. Goals & non-goals
- **Goals:** reliable image→structured-attributes + bilingual copy; a multi-user library with hybrid
  search (filters + full-text + semantic); human-in-the-loop correction; measurable accuracy; deployable
  at low/controlled cost.
- **Non-goals:** training a custom vision model; storing real client data; unbounded public AI usage.

## 2. System overview
```
                ┌──────────────────────────── Frontend (Next.js, Vercel) ───────────────────────────┐
 Browser ─────▶ │ Upload · Library (grid/filter/search) · Asset detail · Auth (Supabase)            │
                └───────────────┬──────────────────────────────────────────────────────────────────┘
                                │ HTTPS (JWT from Supabase Auth)
                ┌───────────────▼──────────────── Backend API (FastAPI, Docker → Render/Fly) ────────┐
                │ api/ → services/ → repositories/ → integrations/                                    │
                │  • extraction service (Claude vision, tool-use, validation, confidence)             │
                │  • embedding service (text + image vectors)                                         │
                │  • catalogue service (CRUD, corrections, audit)                                     │
                │  • search service (filters + FTS + pgvector, merged/reranked)                       │
                └───────┬───────────────────────┬───────────────────────────┬───────────────────────┘
                        │                        │                           │
              Anthropic API            Supabase Postgres + pgvector     Supabase Storage
              (Claude vision)          (assets, embeddings, RLS)        (images + thumbnails)
```

## 3. Tech stack
- **Frontend:** Next.js (App Router) · TypeScript · TanStack Query (server state) · the existing editorial
  design system (Fraunces/Inter, tokens in `globals.css`) · Supabase JS (auth).
- **Backend:** Python · FastAPI · Pydantic v2 · `pydantic-settings` · httpx · Anthropic SDK.
- **Data:** Supabase = Postgres + pgvector + Storage + Auth + Row Level Security.
- **Infra:** Docker; Vercel (frontend); Render/Fly (backend); GitHub Actions (CI/CD).
- **Quality:** ruff + mypy (Py), eslint + prettier + tsc (TS), pytest + Playwright, pre-commit.

## 4. Target folder structure
```
design-lens/
├── frontend/
│   ├── app/                 # routes: /(upload), /library, /asset/[id], /login
│   ├── components/          # DropZone, Gallery, AssetCard, AssetDetail, FilterBar, ui/
│   ├── lib/                 # api client, supabase client, types
│   └── hooks/               # useAssets, useUpload
├── backend/
│   └── app/
│       ├── api/             # routers: extract, assets, search, health
│       ├── services/        # extraction, embedding, catalogue, search
│       ├── repositories/    # db access (assets, embeddings)
│       ├── integrations/    # anthropic_client, storage_client
│       ├── schemas/         # Pydantic DTOs (DesignAttributes, ExtractionResult, …)
│       └── core/            # config, logging, security, errors
├── supabase/                # migrations/*.sql, RLS policies, seed
├── eval/                    # labels.jsonl, run_eval.py, reports
├── infra/                   # Dockerfile(s), docker-compose, .github/workflows
└── docs/                    # ARCHITECTURE.md, decisions/
```

## 5. Data model (Postgres)
- **assets**: id, owner (uuid → auth.users), image_path, thumb_path, building_type, architectural_style[],
  primary_materials[], storeys, key_features[], setting, colour_palette[], mood_tags[],
  description_en, description_zh, alt_text_en, alt_text_zh, seo_keywords[], confidence,
  low_confidence_fields[], model, created_at, updated_at, raw jsonb.
- **asset_embeddings**: asset_id (fk), kind ('text'|'image'), embedding vector(N), model.
- **corrections**: id, asset_id, field, old_value, new_value, corrected_by, created_at (feeds the eval set).
- **search_index**: a generated `tsvector` column on assets (FTS) + ivfflat/hnsw index on embeddings.
- RLS: `owner = auth.uid()` on all rows.

## 6. Key flows
- **Ingest/extract:** upload → validate (type/size) → downscale image (cost) → Claude vision (tool-use,
  temp=0, prompt-cached system+tool) → Pydantic validation → store row + image (Storage) + generate
  thumbnail → enqueue embedding → return saved asset. Low-confidence fields flagged for review.
- **Search (hybrid):** structured filters (building_type, material) ∩ FTS (query) ∪ semantic
  (pgvector cosine) → merge + rerank → page. "show coastal timber townhouses" works.
- **Correct:** user edits a field in the detail view → PATCH → write `corrections` + update asset +
  re-embed. Corrections become labelled eval data.

## 7. Cross-cutting
- **Cost control:** downscale images before send; cache identical uploads (hash); prompt caching; per-user
  rate limits; a global daily cap; optional "mock mode" for public demos (no real Claude calls).
- **Security:** Supabase Auth (JWT) verified server-side; RLS; signed Storage URLs; strict file validation;
  secrets via env/secret manager; tight CORS allowlist.
- **Observability:** structured JSON logs, request ids, Sentry for errors, a usage/cost counter per user.
- **Testing:** unit (extraction validation, search merge), integration (API + test DB), e2e (Playwright:
  upload→see card→open detail→search), and the eval harness run in CI.
- **CI/CD:** GitHub Actions — lint+type+test → build Docker → deploy (preview on PR, prod on main).

## 8. Roadmap (build in this order)
1. **Persistence + auth:** swap SQLite → Supabase (Postgres + Storage + RLS); Supabase Auth; thumbnails.
2. **Hybrid search:** FTS column + embeddings (text first, then image) in pgvector; merge/rerank; filter UI.
3. **Human-in-the-loop:** editable detail view + `corrections` table; confidence-gated review queue.
4. **Eval:** 50-image labelled set; `run_eval.py` reports building-type/setting accuracy + materials/style
   F1, baseline vs tuned; wire into CI.
5. **Deploy (cost-safe):** Dockerise backend → Render/Fly; frontend → Vercel; rate limits + daily cap;
   public demo runs in mock mode or behind a soft cap.
6. **Polish:** batch upload, upload skeletons, delete/edit, dark mode, shared-element card→detail transition.

## 9. Definition of done (per phase)
Typed + linted, tests green, eval numbers logged, no secrets in repo, README + this doc updated.
