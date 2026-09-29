#!/usr/bin/env python3
"""Split an episode script into spoken paragraphs, the unit of audio and video sync.

Each segment is one paragraph of narration, with the beat (most recent heading)
it belongs to and the visual cue in force (the most recent '> visual: <scene>'
line, or None). The spoken text follows exactly the same stripping rules as
tools/narrate.py, which the round-trip test enforces.

    python tools/media/segment.py episodes/s1-mental-model/ep03-setup-and-hold.md
    python tools/media/segment.py --out build/s1ep03/segments.json <episode.md>
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from narrate import is_unspoken, split_front_matter, strip_inline  # noqa: E402

CUE = re.compile(r"^\s*>\s*visual:\s*(\S+)\s*$")


def parse_front_matter(lines: list[str]) -> dict[str, str]:
    meta = {}
    for line in lines:
        key, sep, value = line.partition(":")
        if sep:
            meta[key.strip()] = value.strip()
    return meta


def season_of(path: pathlib.Path, meta: dict[str, str]) -> int:
    if "season" in meta:
        return int(meta["season"])
    match = re.match(r"s(\d+)", path.parent.name)
    if not match:
        raise ValueError(f"{path}: no season in front matter or folder name")
    return int(match.group(1))


def episode_id(season: int, episode: int) -> str:
    return f"s{season}ep{episode:02d}"


def segment(path: pathlib.Path) -> dict:
    front, body = split_front_matter(path.read_text(encoding="utf-8").splitlines())
    meta = parse_front_matter(front)
    season = season_of(path, meta)
    episode = int(meta["episode"])

    segments = []
    beat, cue = None, None
    paragraph: list[str] = []
    para_beat, para_cue, para_line = None, None, 0

    def flush():
        if paragraph:
            text = " ".join(strip_inline("\n".join(paragraph)).split())
            if text:
                segments.append({"id": len(segments), "beat": para_beat,
                                 "cue": para_cue, "line": para_line, "text": text})
            paragraph.clear()

    for number, line in enumerate(body, start=len(front) + 3 if front else 1):
        stripped = line.strip()
        if is_unspoken(line):
            match = CUE.match(line)
            if match:
                cue = match.group(1)
            elif stripped.startswith("#"):
                flush()
                beat = stripped.lstrip("#").strip()
            continue
        if not stripped:
            flush()
            continue
        if not paragraph:
            para_beat, para_cue, para_line = beat, cue, number
        paragraph.append(line)
    flush()

    return {"id": episode_id(season, episode), "season": season, "episode": episode,
            "title": meta.get("title", path.stem), "source": path.as_posix(),
            "segments": segments}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("episode", type=pathlib.Path)
    ap.add_argument("-o", "--out", type=pathlib.Path)
    args = ap.parse_args()

    data = json.dumps(segment(args.episode), indent=2, ensure_ascii=False)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(data + "\n", encoding="utf-8")
    else:
        print(data)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
