# DesignLens

**Drop in an architecture/design image → get clean, structured attributes + bilingual (EN / 中文) copy, ready for a searchable studio library.**

Design studios shoot and render a lot of work. Turning those images into tidy, searchable records — and
writing the website / marketing copy for each — is slow, repetitive manual work. DesignLens does the first
pass with a vision LLM; a human confirms.

> **Honesty:** personal portfolio project, 2026, built with heavy AI assistance. Runs on **sample /
> royalty-free images only** — no real studio's data. The "vision" is a multimodal LLM (Claude) called
> through the Anthropic API; **no computer-vision model was trained.** Not a production system.

## What it demonstrates
- **Multimodal structured extraction** — image → strict JSON (building type, style, materials, features,
  setting, palette) via Claude vision with tool-use.
- **Reliability engineering, not a chatbot** — every model response is validated server-side (Pydantic);
  fields the model is unsure about are flagged `low_confidence` for human review instead of being guessed.
- **Bilingual copy** — natural English + Simplified Chinese description, alt-text, and SEO keywords
  (a quiet edge for a bilingual studio).
- **Searchable library** *(roadmap)* — semantic + filter search over records and images (Supabase pgvector).
- **Measured, not vibes** *(roadmap)* — accuracy on a 50-image hand-labelled set, baseline vs tuned schema
  and prompt (same eval discipline as my L1 Help Desk Copilot).

## Stack
Next.js + TypeScript (frontend) · Python + FastAPI (extraction API) · Anthropic SDK (Claude vision,
strict tool-use, `temperature=0`) · Supabase (Postgres + Storage + pgvector, RLS) · deploy on Vercel + Render.

## Architecture (MVP)
```
[ browser upload ] → Next.js → POST /extract → FastAPI → Claude vision (tool-use)
                                                   → Pydantic validation → JSON back to the UI
```
Storage + pgvector search land in the next phase.

## Attribute schema (architecture-tailored)
`building_type · architectural_style[] · primary_materials[] · storeys · key_features[] · setting ·
colour_palette[] · mood_tags[]` — plus bilingual copy, an overall `confidence`, and a list of
`low_confidence_fields`.

## Run it locally
**1. Backend**
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env        # then add your ANTHROPIC_API_KEY
uvicorn app.main:app --reload --port 8000
```
**2. Frontend**
```bash
cd frontend
npm install
# optional: echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```
Open http://localhost:3000, drop in a building photo, and you'll get structured attributes + bilingual copy.

## Roadmap
- [x] MVP: image → validated structured attributes + bilingual copy
- [x] Catalogue: every upload is saved (SQLite + image store) into a searchable library
- [x] Filter search — by building type, material, or free-text ("coastal timber", "brutalist")
- [x] Gallery UI with thumbnails, attributes, and confidence
- [x] Eval harness (`eval/run_eval.py`) — building-type/setting accuracy + materials/style set-F1
- [ ] Run the eval on 50 labelled images and quote the numbers (needs the labelled set)
- [ ] Semantic search via embeddings + Supabase pgvector (production path; schema in `supabase/`)
- [ ] Confidence-gated human-in-the-loop correction that grows the labelled set
- [ ] One-page case write-up for recruiters

> **Storage note:** the demo persists locally (SQLite + an `uploads/` folder) so anyone can clone
> and run it without provisioning a database. `supabase/schema.sql` is the production path
> (Postgres + Storage + pgvector + RLS), matching the stack used in QuoteMate.
