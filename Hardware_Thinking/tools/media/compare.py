#!/usr/bin/env python3
"""Cut the same passage from every rendered voice, for choosing a voice by ear.

Writes build/<episode>/compare/<voice>.mp3 excerpts and an index.html with a
player for each excerpt and each full episode.

    python tools/media/compare.py build/s1ep03 --from 28 --to 29
"""

from __future__ import annotations

import argparse
import html
import json
import pathlib
import subprocess

import imageio_ffmpeg


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("episode_dir", type=pathlib.Path)
    ap.add_argument("--from", dest="first", type=int, required=True, help="first segment id")
    ap.add_argument("--to", dest="last", type=int, required=True, help="last segment id")
    args = ap.parse_args()

    out = args.episode_dir / "compare"
    out.mkdir(exist_ok=True)
    rows = []
    for timeline_file in sorted(args.episode_dir.glob("*/timeline.json")):
        voice_dir = timeline_file.parent
        segments = {s["id"]: s for s in
                    json.loads(timeline_file.read_text(encoding="utf-8"))["segments"]}
        start, end = segments[args.first]["start"], segments[args.last]["end"]
        wav = next(voice_dir.glob("*.wav"))
        excerpt = out / f"{voice_dir.name}.mp3"
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-y",
                        "-ss", f"{start:.3f}", "-to", f"{end:.3f}", "-i", str(wav),
                        "-codec:a", "libmp3lame", "-b:a", "64k", str(excerpt)], check=True)
        words = sum(len(segments[i]["text"].split()) for i in range(args.first, args.last + 1))
        rows.append((voice_dir.name, excerpt.name,
                     f"../{voice_dir.name}/{wav.stem}.mp3", end - start, words))

    text = " ".join(segments[i]["text"] for i in range(args.first, args.last + 1))
    cards = "\n".join(
        f"""<section><h2>{html.escape(name)}</h2>
<p class="meta">{seconds:.0f} s excerpt · {round(words / seconds * 60)} words per minute</p>
<p>Excerpt <audio controls preload="none" src="{html.escape(clip)}"></audio></p>
<p>Full episode <audio controls preload="none" src="{html.escape(full)}"></audio></p></section>"""
        for name, clip, full, seconds, words in rows)
    (out / "index.html").write_text(f"""<!doctype html>
<meta charset="utf-8"><title>Voice comparison</title>
<style>
:root {{ color-scheme: light dark; --bg:#fff; --fg:#1f2328; --muted:#59636e; --line:#d1d9e0; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#0f1419; --fg:#e6edf3; --muted:#9198a1; --line:#30363d; }} }}
body {{ background:var(--bg); color:var(--fg); font:16px/1.5 system-ui, sans-serif;
       max-width:44rem; margin:2rem auto; padding:0 16px; }}
section {{ border-top:1px solid var(--line); padding:1rem 0; }}
h2 {{ font-size:1.1rem; margin:0; }} .meta {{ color:var(--muted); margin:.2rem 0 .6rem; }}
audio {{ width:100%; }} blockquote {{ color:var(--muted); }}
</style>
<h1>Voice comparison — {html.escape(args.episode_dir.name)}</h1>
<p>Listen on the device you will actually use. Judge: pleasant after ten minutes;
numbers and pauses read as written.</p>
<blockquote>{html.escape(text)}</blockquote>
{cards}
""", encoding="utf-8")
    print(out / "index.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
