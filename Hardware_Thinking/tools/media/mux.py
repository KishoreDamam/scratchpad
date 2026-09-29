#!/usr/bin/env python3
"""Combine a rendered explainer video with its narration and captions.

The video opens with a title card, so the narration and captions are delayed by
the same lead time the scene runner used (visuals.episode.LEAD).

    python tools/media/mux.py build/s1ep03/video/videos/s1ep03/1080p30/SetupAndHold.mp4 \
        build/s1ep03/piper-en_GB-alba-medium@1.3
"""

from __future__ import annotations

import argparse
import pathlib
import subprocess

import imageio_ffmpeg

from visuals.episode import LEAD


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video", type=pathlib.Path, help="silent video rendered by manim")
    ap.add_argument("narration", type=pathlib.Path,
                    help="directory holding <episode>.wav and <episode>.srt")
    ap.add_argument("-o", "--out", type=pathlib.Path)
    args = ap.parse_args()

    wav = next(args.narration.glob("*.wav"))
    srt = wav.with_suffix(".srt")
    out = args.out or args.narration / f"{wav.stem}.mp4"
    subprocess.run([
        imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-y",
        "-i", str(args.video),
        "-itsoffset", str(LEAD), "-i", str(wav),
        "-itsoffset", str(LEAD), "-i", str(srt),
        "-map", "0:v", "-map", "1:a", "-map", "2:s",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "96k", "-c:s", "mov_text",
        "-metadata:s:s:0", "language=eng", str(out)], check=True)
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
