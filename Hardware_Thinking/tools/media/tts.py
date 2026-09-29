#!/usr/bin/env python3
"""Render an episode's segments to per-paragraph WAV clips, cached by content.

Clips are keyed by sha256(engine, voice, text), so a rerun renders only new or
edited paragraphs and resumes cleanly after a crash. Every clip is stored as
22,050 Hz mono 16-bit WAV regardless of engine.

Engines:
  piper     local, rendered here. Voice models live in build/voices/.
  external  rendered elsewhere (e.g. Higgsfield, from a Claude session) and
            brought in with the 'import' command. 'pending' lists what is missing.

    python tools/media/tts.py render  build/s1ep03/segments.json --engine piper --voice en_GB-alba-medium
    python tools/media/tts.py pending build/s1ep03/segments.json --engine external --voice higgsfield-x
    python tools/media/tts.py import  build/s1ep03/segments.json --engine external --voice higgsfield-x --segment 12 --file clip.mp3
"""

from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import subprocess
import sys
import wave

import imageio_ffmpeg

ROOT = pathlib.Path(__file__).resolve().parents[2]          # Hardware_Thinking/
BUILD = ROOT / "build"
CACHE = BUILD / "cache"
VOICES = BUILD / "voices"

SAMPLE_RATE = 22050
TOLERANCE = 0.4            # flag clips whose speaking rate is this far off the voice's median
MIN_WORDS = 8              # too short to judge a rate from


def clip_key(engine: str, voice: str, text: str) -> str:
    return hashlib.sha256(f"{engine}\0{voice}\0{text}".encode()).hexdigest()[:24]


def clip_path(engine: str, voice: str, text: str) -> pathlib.Path:
    return CACHE / engine / voice / f"{clip_key(engine, voice, text)}.wav"


def duration(path: pathlib.Path) -> float:
    with wave.open(str(path), "rb") as wf:
        return wf.getnframes() / wf.getframerate()


def to_standard_wav(src: pathlib.Path, dest: pathlib.Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-y", "-i", str(src),
                    "-ac", "1", "-ar", str(SAMPLE_RATE), "-sample_fmt", "s16", str(dest)],
                   check=True)


def voice_tag(voice: str, pace: float) -> str:
    """Cache and output name for a voice at a pace; pace 1.0 is the model's own speed."""
    return voice if pace == 1.0 else f"{voice}@{pace:g}"


class Piper:
    def __init__(self, voice: str, pace: float = 1.0):
        from piper import PiperVoice
        from piper.config import SynthesisConfig
        self.config = SynthesisConfig(length_scale=pace)
        model = VOICES / f"{voice}.onnx"
        if not model.exists():
            subprocess.run([sys.executable, "-m", "piper.download_voices", voice,
                            "--download-dir", str(VOICES)], check=True)
        self.voice = PiperVoice.load(str(model))

    def render(self, text: str, dest: pathlib.Path) -> None:
        raw = dest.with_suffix(".raw.wav")
        dest.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(raw), "wb") as wf:
            self.voice.synthesize_wav(text, wf, syn_config=self.config)
        to_standard_wav(raw, dest)
        raw.unlink()


def selected(segments: list[dict], only: str | None) -> list[dict]:
    if not only:
        return segments
    wanted = {int(x) for x in only.split(",")}
    return [s for s in segments if s["id"] in wanted]


def manifest(episode: dict, engine: str, voice: str) -> pathlib.Path:
    """Write clips.json for every segment that has a clip; report gaps and outliers."""
    out_dir = BUILD / episode["id"] / f"{engine}-{voice}"
    clips, missing = [], []
    for seg in episode["segments"]:
        path = clip_path(engine, voice, seg["text"])
        if not path.exists():
            missing.append(seg["id"])
            continue
        clips.append({"id": seg["id"], "path": path.relative_to(ROOT).as_posix(),
                      "seconds": round(duration(path), 3), "words": len(seg["text"].split())})

    # A truncated or garbled clip shows up as a speaking rate far from the voice's norm.
    rates = sorted(c["words"] / c["seconds"] for c in clips
                   if c["words"] >= MIN_WORDS and c["seconds"] > 0)
    median = rates[len(rates) // 2] if rates else 0
    flagged = []
    for c in clips:
        rate = c["words"] / c["seconds"] if c["seconds"] else 0
        c["flag"] = bool(median) and c["words"] >= MIN_WORDS and abs(rate / median - 1) > TOLERANCE
        if c["flag"]:
            flagged.append(c["id"])
    out_dir.mkdir(parents=True, exist_ok=True)
    dest = out_dir / "clips.json"
    dest.write_text(json.dumps({"episode": episode["id"], "engine": engine, "voice": voice,
                                "words_per_minute": round(median * 60),
                                "clips": clips, "missing": missing}, indent=2) + "\n",
                    encoding="utf-8")
    print(f"{dest.relative_to(ROOT)}: {len(clips)} clips, {len(missing)} missing, "
          f"{len(flagged)} flagged{' ' + str(flagged) if flagged else ''}, "
          f"{round(median * 60)} wpm")
    return dest


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["render", "pending", "import"])
    ap.add_argument("segments", type=pathlib.Path)
    ap.add_argument("--engine", choices=["piper", "external"], required=True)
    ap.add_argument("--voice", required=True)
    ap.add_argument("--pace", type=float, default=1.0,
                    help="piper length scale: above 1 is slower (1.3 turns ~190 wpm into ~145)")
    ap.add_argument("--only", help="comma-separated segment ids (render/pending)")
    ap.add_argument("--segment", type=int, help="segment id (import)")
    ap.add_argument("--file", type=pathlib.Path, help="audio file to import")
    args = ap.parse_args()

    episode = json.loads(args.segments.read_text(encoding="utf-8"))
    tag = voice_tag(args.voice, args.pace)
    todo = selected(episode["segments"], args.only)

    if args.command == "pending":
        for seg in todo:
            if not clip_path(args.engine, tag, seg["text"]).exists():
                print(json.dumps({"id": seg["id"], "text": seg["text"]}, ensure_ascii=False))
        return 0

    if args.command == "import":
        seg = next(s for s in episode["segments"] if s["id"] == args.segment)
        to_standard_wav(args.file, clip_path(args.engine, tag, seg["text"]))
        manifest(episode, args.engine, tag)
        return 0

    if args.engine != "piper":
        ap.error("only the piper engine renders locally; use pending/import for external")
    engine = Piper(args.voice, args.pace)
    for seg in todo:
        dest = clip_path("piper", tag, seg["text"])
        if not dest.exists():
            engine.render(seg["text"], dest)
            print(f"  rendered {seg['id']:3d}  {duration(dest):5.1f}s", file=sys.stderr)
    manifest(episode, "piper", tag)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
