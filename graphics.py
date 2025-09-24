"""Functions for rendering match graphics inspired by broadcast overlays."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Tuple

from .fotmob import MatchMetadata, MatchStat, ShotEvent


@dataclass
class GraphicColours:
    """Colour palette used by the renderer."""

    background: str = "#101820"
    text_primary: str = "#f5f5f5"
    text_secondary: str = "#c7c7c7"
    accent: str = "#f5a300"
    pitch: str = "#16352f"
    pitch_line: str = "#eaeaea"
    goal: str = "#f5d547"
    on_target: str = "#f18805"
    off_target: str = "#5b6770"


def create_match_graphic(
    metadata: MatchMetadata,
    stats: Iterable[MatchStat],
    shots: Iterable[ShotEvent],
    output_path: Path,
    colours: GraphicColours | None = None,
) -> Path:
    """Render a match graphic and return the path to the saved file."""

    colours = colours or GraphicColours()

    try:
        import matplotlib.pyplot as plt
        from matplotlib.patches import Arc, Circle, Rectangle
    except ImportError as exc:  # pragma: no cover - optional dependency
        raise RuntimeError(
            "matplotlib is required to render graphics. Install it via `pip install matplotlib`."
        ) from exc

    shots = list(shots)
    stats = list(stats)

    fig = plt.figure(figsize=(16, 9), facecolor=colours.background)
    fig.subplots_adjust(left=0.04, right=0.96, top=0.92, bottom=0.08, hspace=0.4, wspace=0.25)

    title_ax = fig.add_subplot(2, 1, 1)
    title_ax.axis("off")

    _draw_scoreboard(title_ax, metadata, colours)

    pitch_axes = fig.add_gridspec(2, 2, top=0.78, bottom=0.1, left=0.05, right=0.95, hspace=0.15, wspace=0.12)
    home_ax = fig.add_subplot(pitch_axes[1, 0])
    away_ax = fig.add_subplot(pitch_axes[1, 1])
    stats_ax = fig.add_subplot(pitch_axes[0, :])

    for ax in (home_ax, away_ax, stats_ax):
        ax.set_facecolor(colours.background)
        ax.tick_params(left=False, bottom=False, labelleft=False, labelbottom=False)

    _draw_stats(stats_ax, stats, metadata, colours)

    _draw_pitch(home_ax, colours)
    _draw_pitch(away_ax, colours, flip=True)

    _plot_shots(home_ax, shots, metadata.home_team.team_id, colours)
    _plot_shots(away_ax, shots, metadata.away_team.team_id, colours, flip=True)

    home_ax.set_title(f"{metadata.home_team.short_name} shots", color=colours.text_primary, fontsize=16, pad=12)
    away_ax.set_title(f"{metadata.away_team.short_name} shots", color=colours.text_primary, fontsize=16, pad=12)

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=200)
    plt.close(fig)
    return output_path


def _draw_scoreboard(ax, metadata: MatchMetadata, colours: GraphicColours) -> None:
    ax.set_facecolor(colours.background)

    home = metadata.home_team
    away = metadata.away_team

    title = metadata.competition
    if metadata.round:
        title += f" • {metadata.round}"

    subtitle_parts = []
    if metadata.venue:
        subtitle_parts.append(metadata.venue)
    if metadata.start_time:
        subtitle_parts.append(metadata.start_time.strftime("%d %B %Y %H:%M UTC"))
    subtitle_parts.append(metadata.status_text)
    subtitle = " • ".join(part for part in subtitle_parts if part)

    ax.text(0.02, 0.85, title, color=colours.text_secondary, fontsize=20, fontweight="bold", transform=ax.transAxes)
    ax.text(0.02, 0.6, subtitle, color=colours.text_secondary, fontsize=14, transform=ax.transAxes)

    ax.text(0.02, 0.25, home.name, color=colours.text_primary, fontsize=28, fontweight="bold", transform=ax.transAxes)
    ax.text(0.98, 0.25, away.name, color=colours.text_primary, fontsize=28, fontweight="bold", transform=ax.transAxes, ha="right")

    score_text = f"{home.score} - {away.score}"
    ax.text(0.5, 0.25, score_text, color=colours.accent, fontsize=36, fontweight="bold", transform=ax.transAxes, ha="center")

    ax.text(0.5, 0.05, "Data via FotMob", color=colours.text_secondary, fontsize=12, transform=ax.transAxes, ha="center")


def _draw_pitch(ax, colours: GraphicColours, flip: bool = False) -> None:
    try:
        from matplotlib.patches import Arc, Circle, Rectangle
    except ImportError as exc:  # pragma: no cover - optional dependency
        raise RuntimeError("matplotlib is required to render graphics") from exc

    ax.set_aspect('equal')
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)

    rect = Rectangle((0, 0), 100, 100, edgecolor=colours.pitch_line, facecolor=colours.pitch, linewidth=2)
    ax.add_patch(rect)

    # Centre line and circle
    ax.plot([50, 50], [0, 100], color=colours.pitch_line, linewidth=2)
    centre_circle = Circle((50, 50), 9.15, edgecolor=colours.pitch_line, facecolor='none', linewidth=2)
    ax.add_patch(centre_circle)
    ax.add_patch(Circle((50, 50), 0.5, color=colours.pitch_line))

    # Penalty areas
    areas = [Rectangle((0, 21.1), 16.5, 57.8, edgecolor=colours.pitch_line, facecolor='none', linewidth=2),
             Rectangle((100 - 16.5, 21.1), 16.5, 57.8, edgecolor=colours.pitch_line, facecolor='none', linewidth=2)]
    for area in areas:
        ax.add_patch(area)

    # Six yard boxes
    six_yard = [Rectangle((0, 36.8), 5.5, 26.4, edgecolor=colours.pitch_line, facecolor='none', linewidth=2),
                Rectangle((100 - 5.5, 36.8), 5.5, 26.4, edgecolor=colours.pitch_line, facecolor='none', linewidth=2)]
    for box in six_yard:
        ax.add_patch(box)

    # Penalty spots and arcs
    ax.add_patch(Circle((11, 50), 0.5, color=colours.pitch_line))
    ax.add_patch(Circle((100 - 11, 50), 0.5, color=colours.pitch_line))

    arc_left = Arc((11, 50), 18.3, 18.3, angle=0, theta1=310, theta2=50, color=colours.pitch_line, linewidth=2)
    arc_right = Arc((89, 50), 18.3, 18.3, angle=0, theta1=130, theta2=230, color=colours.pitch_line, linewidth=2)
    ax.add_patch(arc_left)
    ax.add_patch(arc_right)

    if flip:
        ax.invert_xaxis()


def _plot_shots(
    ax,
    shots: Iterable[ShotEvent],
    team_id: int,
    colours: GraphicColours,
    flip: bool = False,
) -> None:
    shots = [shot for shot in shots if shot.team_id == team_id]
    if not shots:
        ax.text(0.5, 0.5, "No shots", color=colours.text_secondary, fontsize=14, ha="center", va="center", transform=ax.transAxes)
        return

    xs = []
    ys = []
    sizes = []
    colors = []
    for shot in shots:
        x, y = shot.x, shot.y
        if flip:
            x = 100 - x
        xs.append(x)
        ys.append(y)
        sizes.append(_shot_marker_size(shot.expected_goals))
        colors.append(_shot_colour(shot, colours))

    ax.scatter(xs, ys, s=sizes, c=colors, alpha=0.9, edgecolor=colours.background, linewidth=0.6)


def _shot_marker_size(xg: float | None) -> float:
    if not xg:
        return 30.0
    return max(30.0, min(180.0, xg * 400))


def _shot_colour(shot: ShotEvent, colours: GraphicColours) -> str:
    if shot.is_goal:
        return colours.goal
    if shot.is_on_target:
        return colours.on_target
    return colours.off_target


def _draw_stats(ax, stats: Iterable[MatchStat], metadata: MatchMetadata, colours: GraphicColours) -> None:
    stats = list(stats)
    if not stats:
        ax.text(0.5, 0.5, "No stats available", color=colours.text_secondary, fontsize=14, ha="center", va="center")
        return

    ax.axis("off")
    ax.set_facecolor(colours.background)

    y_positions = _linspace(len(stats))

    for y, stat in zip(y_positions, stats):
        ax.text(0.1, y, stat.home_value, color=colours.text_primary, fontsize=18, ha="left", va="center")
        ax.text(0.5, y, stat.title, color=colours.text_secondary, fontsize=16, ha="center", va="center")
        ax.text(0.9, y, stat.away_value, color=colours.text_primary, fontsize=18, ha="right", va="center")

    ax.set_title(
        f"Key match stats: {metadata.home_team.short_name} vs {metadata.away_team.short_name}",
        color=colours.text_primary,
        fontsize=18,
        pad=16,
    )


def _linspace(n: int) -> Tuple[float, ...]:
    if n <= 1:
        return (0.5,)
    step = 0.8 / (n - 1)
    return tuple(0.9 - i * step for i in range(n))
