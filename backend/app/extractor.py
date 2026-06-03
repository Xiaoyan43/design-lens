import base64

from anthropic import Anthropic

from .config import settings
from .prompts import SYSTEM_PROMPT, USER_INSTRUCTION
from .schema import ExtractionResult

# Tool schema that forces Claude's vision output into our structure.
RECORD_DESIGN_TOOL = {
    "name": "record_design",
    "description": "Record structured attributes and bilingual copy for one design/architecture image.",
    "input_schema": {
        "type": "object",
        "properties": {
            "attributes": {
                "type": "object",
                "properties": {
                    "building_type": {"type": "string"},
                    "architectural_style": {"type": "array", "items": {"type": "string"}},
                    "primary_materials": {"type": "array", "items": {"type": "string"}},
                    "storeys": {"type": ["string", "null"]},
                    "key_features": {"type": "array", "items": {"type": "string"}},
                    "setting": {"type": "string"},
                    "colour_palette": {"type": "array", "items": {"type": "string"}},
                    "mood_tags": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["building_type", "setting"],
            },
            "copy": {
                "type": "object",
                "properties": {
                    "description_en": {"type": "string"},
                    "description_zh": {"type": "string"},
                    "alt_text_en": {"type": "string"},
                    "alt_text_zh": {"type": "string"},
                    "seo_keywords": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["description_en", "description_zh", "alt_text_en", "alt_text_zh"],
            },
            "confidence": {"type": "number"},
            "low_confidence_fields": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["attributes", "copy", "confidence"],
    },
}

_client: Anthropic | None = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=settings.anthropic_api_key)
    return _client


def extract_design(image_bytes: bytes, media_type: str) -> ExtractionResult:
    """Send one image to Claude vision and return a *validated* structured result.

    We force tool-use so the model must answer in our schema, run at temperature=0
    for reproducibility, and validate everything server-side before returning it.
    """
    client = _get_client()
    b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

    message = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=1024,
        temperature=0,
        # cache_control keeps the stable instructions warm once prompts grow.
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        tools=[RECORD_DESIGN_TOOL],
        tool_choice={"type": "tool", "name": "record_design"},
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": b64},
                    },
                    {"type": "text", "text": USER_INSTRUCTION},
                ],
            }
        ],
    )

    tool_input = next(
        (b.input for b in message.content if b.type == "tool_use" and b.name == "record_design"),
        None,
    )
    if tool_input is None:
        raise ValueError("Model did not return a record_design tool call")

    # Server-side validation — never trust the raw model output.
    tool_input["model"] = settings.anthropic_model
    return ExtractionResult.model_validate(tool_input)
