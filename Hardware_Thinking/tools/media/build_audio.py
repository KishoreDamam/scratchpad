#!/usr/bin/env python3
"""Render every episode (or a chosen few) to MP3, several at a time.

For each script: segment it, render its clips, assemble the MP3, then copy the
result to build/audio/<season folder>/<script name>.mp3 so a whole season can be
dropped onto a phone in one go. Clip caching means a rerun only renders what
changed.

    python tools/media/build_audio.py                       # everything
    python tools/media/build_audio.py episodes/s2-*/*.md    # one season
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
MEDIA = ROOT / "tools" / "media"
VOICE, PACE = "en_GB-northern_english_male-medium", 1.45


def build(script: pathlib.Path, voice: str, pace: float) -> tuple[str, str]:
    sys.path.insert(0, str(MEDIA))
    from segment import segment
    from tts import voice_tag

    episode = segment(script)
    work = ROOT / "build" / episode["id"]
    segments = work / "segments.json"
    work.mkdir(parents=True, exist_ok=True)
    segments.write_text(json.dumps(episode, indent=2, ensure_ascii=False) + "\n",
                        encoding="utf-8")

    def run(*args):
        return subprocess.run([sys.executable, *map(str, args)], check=True,
                              capture_output=True, text=True).stdout.strip()

    tag = voice_tag(voice, pace)
    report = run(MEDIA / "tts.py", "render", segments, "--engine", "piper",
                 "--voice", voice, "--pace", pace)
    run(MEDIA / "assemble.py", segments, work / f"piper-{tag}" / "clips.json")

    dest = ROOT / "build" / "audio" / script.parent.name / f"{script.stem}.mp3"
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(work / f"piper-{tag}" / f"{episode['id']}.mp3", dest)
    return episode["id"], report.splitlines()[-1]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("scripts", nargs="*", type=pathlib.Path)
    ap.add_argument("--voice", default=VOICE)
    ap.add_argument("--pace", type=float, default=PACE)
    ap.add_argument("-j", "--jobs", type=int, default=8)
    args = ap.parse_args()

    scripts = [p.resolve() for p in args.scripts] or sorted((ROOT / "episodes").glob("*/*.md"))
    failed = []
    with concurrent.futures.ThreadPoolExecutor(args.jobs) as pool:
        futures = {pool.submit(build, s, args.voice, args.pace): s for s in scripts}
        for future in concurrent.futures.as_completed(futures):
            try:
                episode_id, report = future.result()
                print(f"{episode_id:8s} {report.split(': ', 1)[-1]}", flush=True)
            except subprocess.CalledProcessError as err:
                failed.append(futures[future])
                print(f"FAILED {futures[future].name}\n{err.stderr}", flush=True)
    print(f"{len(scripts) - len(failed)} built, {len(failed)} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
