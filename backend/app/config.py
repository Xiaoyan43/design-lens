import os
from dataclasses import dataclass

from dotenv import load_dotenv

# Load the repo-root .env. override=True so the file wins over a stale/empty
# ANTHROPIC_API_KEY that may already be exported in the shell environment.
_REPO_ENV = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
load_dotenv(override=True)
load_dotenv(_REPO_ENV, override=True)


@dataclass
class Settings:
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    # Claude Haiku 4.5 has vision and is cheap — good for this extraction job.
    anthropic_model: str = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
    max_image_mb: float = float(os.getenv("MAX_IMAGE_MB", "8"))
    cors_origins: str = os.getenv("CORS_ORIGINS", "http://localhost:3000")


settings = Settings()
