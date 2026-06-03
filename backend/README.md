# DesignLens backend (FastAPI)

Endpoints:
- `POST /extract` — multipart `file` (image) → validated structured attributes + bilingual copy
- `GET /health` — liveness + active model

## Run
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env        # then add your ANTHROPIC_API_KEY
uvicorn app.main:app --reload --port 8000
```

Quick test:
```bash
curl -F "file=@/path/to/building.jpg" http://localhost:8000/extract
```

Notes:
- Model is set by `ANTHROPIC_MODEL` (default `claude-haiku-4-5-20251001`, which has vision).
- The call uses **tool-use + `temperature=0`** so the model must answer in our schema, reproducibly.
- Every response is **validated with Pydantic** (`ExtractionResult`) before it leaves the server — the
  raw model output is never returned directly.
