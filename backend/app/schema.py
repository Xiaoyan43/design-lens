from __future__ import annotations

from pydantic import BaseModel, Field

# Architecture-tailored controlled vocabularies. These guide the model so outputs
# stay consistent and searchable; free-text tags are still allowed when nothing fits.
# Residential types use New Zealand terminology (townhouse / standalone house /
# apartment) — medium-density townhouse developments are the common NZ case.
BUILDING_TYPES = [
    "townhouse",
    "standalone_house",
    "apartment",
    "mixed_use",
    "commercial_office",
    "retail_hospitality",
    "civic_cultural",
    "educational",
    "industrial",
    "landscape_urban",
    "interior",
    "unknown",
]
SETTINGS = ["urban", "suburban", "coastal", "rural", "bush", "waterfront", "unknown"]


class DesignAttributes(BaseModel):
    """Structured facts extracted from a single architecture/design image."""

    building_type: str = Field(description="One of BUILDING_TYPES, or 'unknown'.")
    architectural_style: list[str] = Field(
        default_factory=list,
        description="Style tags, e.g. 'modernist', 'contemporary', 'heritage villa', 'brutalist'.",
    )
    primary_materials: list[str] = Field(
        default_factory=list,
        description="Visible primary materials, e.g. 'concrete', 'timber', 'glass', 'brick', 'steel'.",
    )
    storeys: str | None = Field(
        default=None, description="Approximate storey count/range if visible (e.g. '2', '1-2'); else null."
    )
    key_features: list[str] = Field(
        default_factory=list,
        description="Short notable features, e.g. 'floor-to-ceiling glazing', 'cantilever', 'pitched roof'.",
    )
    setting: str = Field(default="unknown", description="Surrounding context, one of SETTINGS.")
    colour_palette: list[str] = Field(default_factory=list, description="Dominant colours, plain names.")
    mood_tags: list[str] = Field(
        default_factory=list, description="Character/mood words, e.g. 'warm', 'monolithic', 'airy'."
    )


class BilingualCopy(BaseModel):
    description_en: str
    description_zh: str
    alt_text_en: str
    alt_text_zh: str
    seo_keywords: list[str] = Field(default_factory=list)


class ExtractionResult(BaseModel):
    """What the API returns — validated, never the raw model output."""

    attributes: DesignAttributes
    copy: BilingualCopy
    confidence: float = Field(ge=0.0, le=1.0, description="Overall confidence, 0-1.")
    low_confidence_fields: list[str] = Field(
        default_factory=list,
        description="Fields the model was unsure about — surface for human review before trusting.",
    )
    model: str
