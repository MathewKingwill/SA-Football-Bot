"""Utility functions for fetching and parsing FotMob match data."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

_API_BASE_URL = "https://www.fotmob.com/api"
_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)"
    " Chrome/120.0 Safari/537.36"
)


@dataclass
class TeamInfo:
    """Minimal information about a team participating in a match."""

    team_id: int
    name: str
    short_name: str
    score: int


@dataclass
class MatchMetadata:
    """High level metadata for a FotMob match."""

    match_id: str
    competition: str
    round: Optional[str]
    venue: Optional[str]
    start_time: Optional[datetime]
    status_text: str
    home_team: TeamInfo
    away_team: TeamInfo


@dataclass
class MatchStat:
    """A single statistical comparison between the two teams."""

    title: str
    home_value: str
    away_value: str
    is_percentage: bool = False


@dataclass
class ShotEvent:
    """A single shot from the FotMob shotmap feed."""

    team_id: int
    x: float
    y: float
    is_goal: bool
    is_on_target: Optional[bool]
    expected_goals: Optional[float]
    player_name: Optional[str]


class FotMobError(RuntimeError):
    """Raised when the FotMob API returns an unexpected response."""


def fetch_match_details(match_id: str) -> Dict[str, Any]:
    """Fetch raw match details from FotMob.

    Args:
        match_id: The FotMob match identifier.

    Returns:
        A parsed JSON dictionary with the raw API response.
    """

    url = f"{_API_BASE_URL}/matchDetails?matchId={match_id}"
    request = Request(url, headers={"User-Agent": _USER_AGENT})
    try:
        with urlopen(request, timeout=30) as response:  # type: ignore[call-arg]
            payload = response.read()
    except HTTPError as exc:  # pragma: no cover - network failure handling
        raise FotMobError(f"FotMob returned HTTP {exc.code} for {url}") from exc
    except URLError as exc:  # pragma: no cover - network failure handling
        raise FotMobError(f"Unable to reach FotMob: {exc.reason}") from exc

    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:  # pragma: no cover - defensive programming
        raise FotMobError("Unexpected response from FotMob") from exc


def _parse_team(raw_team: Dict[str, Any]) -> TeamInfo:
    score = raw_team.get("score")
    if score is None:
        score_str = raw_team.get("scoreStr", "0")
        try:
            score = int(str(score_str).strip().split()[0])
        except (ValueError, IndexError):
            score = 0

    return TeamInfo(
        team_id=int(raw_team.get("id") or raw_team.get("teamId", 0)),
        name=str(raw_team.get("name", "Unknown")),
        short_name=str(raw_team.get("shortName", raw_team.get("name", ""))),
        score=int(score),
    )


def _parse_start_time(header: Dict[str, Any]) -> Optional[datetime]:
    kickoff = header.get("startTimeUTC")
    if not kickoff:
        return None

    try:
        return datetime.fromisoformat(kickoff.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def parse_match_metadata(raw: Dict[str, Any]) -> MatchMetadata:
    """Extract structured metadata from the FotMob payload."""

    header = raw.get("header", {})
    teams: Sequence[Dict[str, Any]] = header.get("teams", [])
    if len(teams) != 2:
        raise FotMobError("Expected exactly two teams in the match header")

    home_team = _parse_team(next((team for team in teams if team.get("isHomeTeam")), teams[0]))
    away_team = _parse_team(next((team for team in teams if not team.get("isHomeTeam")), teams[-1]))

    competition = str(header.get("leagueName", ""))
    round_name = header.get("matchRound") or header.get("cupRound")
    venue = header.get("stadium", {}).get("name")
    status_text = str(header.get("status", {}).get("text") or header.get("statusText", ""))

    return MatchMetadata(
        match_id=str(header.get("matchId") or raw.get("general", {}).get("matchId")),
        competition=competition,
        round=str(round_name) if round_name else None,
        venue=str(venue) if venue else None,
        start_time=_parse_start_time(header),
        status_text=status_text,
        home_team=home_team,
        away_team=away_team,
    )


def extract_stats(raw: Dict[str, Any], desired_titles: Optional[Iterable[str]] = None) -> List[MatchStat]:
    """Extract a simplified list of match statistics.

    Args:
        raw: Raw FotMob payload.
        desired_titles: Optional iterable of stat titles to keep. If omitted,
            the first eight statistics are returned.
    """

    stats_container = raw.get("content", {}).get("matchFacts", {}).get("stats", [])
    stats: List[MatchStat] = []
    titles = set(title.lower() for title in desired_titles) if desired_titles else None

    for entry in stats_container:
        title = str(entry.get("title", "")).strip()
        if not title:
            continue
        if titles and title.lower() not in titles:
            continue

        values: Sequence[Dict[str, Any]] = entry.get("stats", [])
        if len(values) != 2:
            continue

        is_percentage = (entry.get("type") or "").lower() == "percentage"
        home_value = str(values[0].get("value", "-"))
        away_value = str(values[1].get("value", "-"))

        stats.append(MatchStat(title=title, home_value=home_value, away_value=away_value, is_percentage=is_percentage))

    if not titles:
        return stats[:8]

    # When specific titles were requested, ensure they appear in the desired order.
    ordered: List[MatchStat] = []
    if desired_titles:
        lookup = {stat.title.lower(): stat for stat in stats}
        for name in desired_titles:
            stat = lookup.get(name.lower())
            if stat:
                ordered.append(stat)
    return ordered


def extract_shots(raw: Dict[str, Any]) -> List[ShotEvent]:
    """Extract shot information from the FotMob payload."""

    shots_raw = raw.get("content", {}).get("shotmap", {}).get("shots", [])
    shots: List[ShotEvent] = []
    for shot in shots_raw:
        try:
            team_id = int(shot.get("teamId"))
            x = float(shot.get("x"))
            y = float(shot.get("y"))
        except (TypeError, ValueError):
            continue

        shots.append(
            ShotEvent(
                team_id=team_id,
                x=x,
                y=y,
                is_goal=bool(shot.get("isGoal")),
                is_on_target=shot.get("isOnTarget"),
                expected_goals=_safe_float(shot.get("expectedGoals")),
                player_name=shot.get("playerName"),
            )
        )

    return shots


def _safe_float(value: Any) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
