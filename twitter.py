"""Twitter/X integration helpers for publishing match graphics."""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from .config import TwitterSettings
from .fotmob import MatchMetadata


class TwitterClientError(RuntimeError):
    """Raised when the Tweepy client cannot be initialised."""


def post_match_update(
    metadata: MatchMetadata,
    image_path: Path,
    status_override: Optional[str] = None,
    settings: Optional[TwitterSettings] = None,
) -> None:
    """Post the generated match image to Twitter/X.

    Args:
        metadata: The match metadata describing the fixture.
        image_path: Path to the generated image file.
        status_override: Optional manual tweet copy. If not supplied a
            sensible default using the match score is generated.
        settings: Optional explicit credentials. When omitted they will be
            loaded from environment variables using :func:`TwitterSettings.from_env`.
    """

    try:
        import tweepy
    except ImportError as exc:  # pragma: no cover - optional dependency
        raise TwitterClientError(
            "tweepy must be installed to post updates. Install it via `pip install tweepy`."
        ) from exc

    image_path = Path(image_path)
    if not image_path.exists():
        raise FileNotFoundError(image_path)

    settings = settings or TwitterSettings.from_env()

    auth = tweepy.OAuth1UserHandler(
        settings.api_key,
        settings.api_secret,
        settings.access_token,
        settings.access_token_secret,
    )
    api = tweepy.API(auth)

    status = status_override or _compose_status(metadata)
    media = api.media_upload(filename=str(image_path))
    api.update_status(status=status, media_ids=[media.media_id])


def _compose_status(metadata: MatchMetadata) -> str:
    home = metadata.home_team
    away = metadata.away_team
    headline = f"{home.name} {home.score} - {away.score} {away.name}"

    parts = [headline]
    parts.append(metadata.competition)
    if metadata.round:
        parts.append(metadata.round)
    if metadata.status_text:
        parts.append(metadata.status_text)

    return " | ".join(part for part in parts if part)
