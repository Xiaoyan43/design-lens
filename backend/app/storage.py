"""Local persistence for the DesignLens catalogue (SQLite + an uploads folder).

Self-contained on purpose: clone the repo, add an API key, and the library works —
no external database to provision. supabase/schema.sql documents the production path.
"""

from __future__ import annotations

import datetime
import json
import os
import sqlite3
import uuid

from .schema import ExtractionResult

_BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
DB_PATH = os.path.join(_BASE, "designlens.db")
UPLOADS_DIR = os.path.join(_BASE, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

_EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init_db() -> None:
    with _conn() as c:
        c.execute(
            """create table if not exists assets (
                id text primary key,
                created_at text,
                image_file text,
                building_type text,
                setting text,
                materials text,
                styles text,
                description_en text,
                confidence real,
                data text
            )"""
        )


def _hydrate(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["image_url"] = f"/images/{d['image_file']}"
    d["result"] = json.loads(d.pop("data"))
    return d


def save_asset(result: ExtractionResult, image_bytes: bytes, media_type: str) -> dict:
    asset_id = uuid.uuid4().hex
    image_file = f"{asset_id}.{_EXT.get(media_type, 'jpg')}"
    with open(os.path.join(UPLOADS_DIR, image_file), "wb") as f:
        f.write(image_bytes)

    a = result.attributes
    row = {
        "id": asset_id,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "image_file": image_file,
        "building_type": a.building_type,
        "setting": a.setting,
        "materials": ", ".join(a.primary_materials),
        "styles": ", ".join(a.architectural_style),
        "description_en": result.copy.description_en,
        "confidence": result.confidence,
        "data": result.model_dump_json(),
    }
    with _conn() as c:
        c.execute(
            """insert into assets
                (id, created_at, image_file, building_type, setting, materials, styles,
                 description_en, confidence, data)
               values
                (:id, :created_at, :image_file, :building_type, :setting, :materials, :styles,
                 :description_en, :confidence, :data)""",
            row,
        )
    return _hydrate_dict(row)


def _hydrate_dict(row: dict) -> dict:
    d = dict(row)
    d["image_url"] = f"/images/{d['image_file']}"
    d["result"] = json.loads(d.pop("data"))
    return d


def list_assets(
    building_type: str | None = None,
    material: str | None = None,
    q: str | None = None,
    limit: int = 100,
) -> list[dict]:
    clauses: list[str] = []
    params: list = []
    if building_type:
        clauses.append("building_type = ?")
        params.append(building_type)
    if material:
        clauses.append("lower(materials) like ?")
        params.append(f"%{material.lower()}%")
    if q:
        clauses.append(
            "(lower(description_en) like ? or lower(styles) like ? "
            "or lower(materials) like ? or lower(building_type) like ?)"
        )
        like = f"%{q.lower()}%"
        params += [like, like, like, like]
    where = ("where " + " and ".join(clauses)) if clauses else ""
    with _conn() as c:
        rows = c.execute(
            f"select * from assets {where} order by created_at desc limit ?",
            (*params, limit),
        ).fetchall()
    return [_hydrate(r) for r in rows]


def get_asset(asset_id: str) -> dict | None:
    with _conn() as c:
        row = c.execute("select * from assets where id = ?", (asset_id,)).fetchone()
    return _hydrate(row) if row else None
