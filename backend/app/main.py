from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import storage
from .config import settings
from .extractor import extract_design

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

app = FastAPI(title="DesignLens API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

storage.init_db()
# Serve saved images at /images/<file>.
app.mount("/images", StaticFiles(directory=storage.UPLOADS_DIR), name="images")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": settings.anthropic_model}


@app.post("/extract")
async def extract(file: UploadFile = File(...)) -> dict:
    """Analyse one image, save it to the catalogue, and return the saved record."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, f"Unsupported image type: {file.content_type}")
    if not settings.anthropic_api_key:
        raise HTTPException(500, "ANTHROPIC_API_KEY is not set — copy .env.example to .env and add your key.")

    data = await file.read()
    if len(data) > settings.max_image_mb * 1024 * 1024:
        raise HTTPException(413, f"Image larger than {settings.max_image_mb} MB")

    try:
        result = extract_design(data, file.content_type)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001 — surface a clean error to the client
        raise HTTPException(502, f"Extraction failed: {e}") from e

    return storage.save_asset(result, data, file.content_type)


@app.get("/assets")
def assets(
    building_type: str | None = Query(default=None),
    material: str | None = Query(default=None),
    q: str | None = Query(default=None),
) -> list[dict]:
    """The catalogue — filter by building type, material, or a free-text query."""
    return storage.list_assets(building_type=building_type, material=material, q=q)


@app.get("/assets/{asset_id}")
def asset(asset_id: str) -> dict:
    found = storage.get_asset(asset_id)
    if not found:
        raise HTTPException(404, "Not found")
    return found
