#!/usr/bin/env python3
"""Combine a rendered explainer video with its narration and captions.

The video opens with a title card, so the narration and captions are delayed by
the same lead time the scene runner used (visuals.episode.LEAD).

    python tools/media/mux.py build/s1ep03/video/videos/s1ep03/1080p30/SetupAndHold.mp4 \
        build/s1ep03/piper-en_GB-northern_english_male-medium@1.45 --burn
"""

from __future__ import annotations

import argparse
import json
import pathlib
import subprocess

import imageio_ffmpeg

from captions import cues, to_srt
from visuals.episode import LEAD

# Burned captions: white on a translucent box, clear of the scene's safe area.
# Sizes are in libass units, where the frame is 288 units tall.
CAPTION_STYLE = ("FontName=Segoe UI,FontSize=11,PrimaryColour=&H00F3EDE6,"
                 "BackColour=&H99000000,BorderStyle=3,Outline=6,Shadow=0,MarginV=10")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video", type=pathlib.Path, help="silent video rendered by manim")
    ap.add_argument("narration", type=pathlib.Path,
                    help="directory holding <episode>.wav and <episode>.srt")
    ap.add_argument("-o", "--out", type=pathlib.Path)
    ap.add_argument("--burn", action="store_true",
                    help="burn captions into the picture (for muted playback) as well")
    args = ap.parse_args()

    wav = next(args.narration.glob("*.wav"))
    srt = wav.with_suffix(".srt")
    out = (args.out or args.narration / f"{wav.stem}.mp4").resolve()

    video = ["-c:v", "copy"]
    if args.burn:
        # The subtitles filter reads the file relative to ffmpeg's working directory,
        # which sidesteps Windows drive-letter escaping in filter arguments.
        segments = json.loads((args.narration / "timeline.json").read_text(encoding="utf-8"))
        burn = args.narration / "burn.srt"
        burn.write_text(to_srt(cues(segments["segments"], offset=LEAD)), encoding="utf-8")
        video = ["-vf", f"subtitles={burn.name}:force_style='{CAPTION_STYLE}'",
                 "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p"]
    subprocess.run([
        imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-y",
        "-i", str(args.video.resolve()),
        "-itsoffset", str(LEAD), "-i", str(wav.resolve()),
        "-itsoffset", str(LEAD), "-i", str(srt.resolve()),
        "-map", "0:v", "-map", "1:a", "-map", "2:s",
        *video, "-c:a", "aac", "-b:a", "96k", "-c:s", "mov_text",
        "-metadata:s:s:0", "language=eng", str(out)], check=True, cwd=args.narration)
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
