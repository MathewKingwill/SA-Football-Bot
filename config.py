"""Configuration helpers for the SA Football Bot."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()


@dataclass
class TwitterSettings:
    """Authentication credentials required for posting to Twitter/X."""

    api_key: str
    api_secret: str
    access_token: str
    access_token_secret: str

    @classmethod
    def from_env(cls) -> "TwitterSettings":
        """Create settings from environment variables.

        Raises:
            RuntimeError: If any of the expected environment variables are missing.
        """

        import os

        try:
            return cls(
                api_key=os.environ["TWITTER_API_KEY"],
                api_secret=os.environ["TWITTER_API_SECRET"],
                access_token=os.environ["TWITTER_ACCESS_TOKEN"],
                access_token_secret=os.environ["TWITTER_ACCESS_TOKEN_SECRET"],
            )
        except KeyError as exc:  # pragma: no cover - defensive programming
            raise RuntimeError(
                "Missing Twitter credential environment variable"
            ) from exc


def default_output_path(match_id: str, base_dir: Optional[Path] = None) -> Path:
    """Return the default path where generated graphics should be stored."""

    base = base_dir or Path.cwd()
    return base / f"match_{match_id}.png"
