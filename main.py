"""Command line entry-point for generating match graphics."""
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable, Optional

from . import config, fotmob, graphics, twitter


def parse_args(argv: Optional[Iterable[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate match graphics from FotMob data")
    parser.add_argument("match_id", help="FotMob match identifier, e.g. 4272150")
    parser.add_argument(
        "--output",
        type=Path,
        help="Where to save the generated image (defaults to ./match_<id>.png)",
    )
    parser.add_argument(
        "--tweet",
        action="store_true",
        help="Post the generated image to Twitter/X using credentials from the environment",
    )
    parser.add_argument(
        "--stats",
        nargs="*",
        default=None,
        help="Specific stat titles to include (e.g. Possession 'Total shots' 'xG')",
    )
    parser.add_argument(
        "--status-text",
        help="Optional override for the tweet copy when --tweet is supplied",
    )
    return parser.parse_args(argv)


def main(argv: Optional[Iterable[str]] = None) -> Path:
    args = parse_args(argv)

    raw = fotmob.fetch_match_details(args.match_id)
    metadata = fotmob.parse_match_metadata(raw)
    stats = fotmob.extract_stats(raw, desired_titles=args.stats)
    shots = fotmob.extract_shots(raw)

    output_path = args.output or config.default_output_path(args.match_id)
    image_path = graphics.create_match_graphic(metadata, stats, shots, output_path)

    if args.tweet:
        twitter.post_match_update(metadata, image_path, status_override=args.status_text)

    return image_path


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    main()
