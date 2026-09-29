#!/usr/bin/env python3
"""Join an episode's clips into one tagged MP3, with a timeline and captions.

Reads the clips.json written by tts.py. Inserts a short pause between
paragraphs and a longer one between beats, then writes, next to clips.json:

  <episode>.wav        the joined narration (kept for video muxing)
  <episode>.mp3        64 kbps mono, ID3-tagged
  timeline.json        start and end of every segment, in seconds
  <episode>.srt        one caption per segment

    python tools/media/assemble.py build/s1ep03/segments.json build/s1ep03/piper-en_GB-alba-medium/clips.json
"""

from __future__ import annotations

import argparse
import json
import pathlib
import subprocess
import wave

import imageio_ffmpeg

ROOT = pathlib.Path(__file__).resolve().parents[2]

PARAGRAPH_PAUSE = 0.4
BEAT_PAUSE = 1.2
SEASON_TITLES = {
    1: "The Mental Model", 2: "RTL That Synthesises", 3: "Microarchitecture",
    4: "Verification for Designers", 5: "Timing, Synthesis and Physics",
    6: "Power, Clocks and Domains", 7: "Interfaces, IP and SoC",
    8: "DFT, Reliability and the Craft",
}


def srt_time(seconds: float) -> str:
    ms = round(seconds * 1000)
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def build_timeline(segments: list[dict], clips: dict[int, dict]) -> list[dict]:
    """Place every segment on a timeline, pausing longer where the beat changes."""
    timeline, t, previous_beat = [], 0.0, None
    for seg in segments:
        clip = clips[seg["id"]]
        if timeline:
            t += BEAT_PAUSE if seg["beat"] != previous_beat else PARAGRAPH_PAUSE
        timeline.append({"id": seg["id"], "cue": seg["cue"], "beat": seg["beat"],
                         "line": seg["line"],
                         "start": round(t, 3), "end": round(t + clip["seconds"], 3),
                         "text": seg["text"]})
        t += clip["seconds"]
        previous_beat = seg["beat"]
    return timeline


def write_wav(timeline: list[dict], clips: dict[int, dict], dest: pathlib.Path) -> None:
    with wave.open(str(dest), "wb") as out:
        cursor = 0
        for entry in timeline:
            with wave.open(str(ROOT / clips[entry["id"]]["path"]), "rb") as wf:
                if cursor == 0:
                    out.setparams(wf.getparams())
                rate = wf.getframerate()
                start = round(entry["start"] * rate)
                out.writeframes(b"\0\0" * (start - cursor))
                frames = wf.readframes(wf.getnframes())
                out.writeframes(frames)
                cursor = start + len(frames) // 2


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("segments", type=pathlib.Path)
    ap.add_argument("clips", type=pathlib.Path)
    args = ap.parse_args()

    episode = json.loads(args.segments.read_text(encoding="utf-8"))
    manifest = json.loads(args.clips.read_text(encoding="utf-8"))
    if manifest["missing"]:
        raise SystemExit(f"cannot assemble: segments {manifest['missing']} have no clip")
    clips = {c["id"]: c for c in manifest["clips"]}

    out_dir = args.clips.resolve().parent
    name = episode["id"]
    timeline = build_timeline(episode["segments"], clips)
    (out_dir / "timeline.json").write_text(
        json.dumps({"episode": name, "title": episode["title"], "segments": timeline},
                   indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    (out_dir / f"{name}.srt").write_text("".join(
        f"{i}\n{srt_time(e['start'])} --> {srt_time(e['end'])}\n{e['text']}\n\n"
        for i, e in enumerate(timeline, start=1)), encoding="utf-8")

    wav = out_dir / f"{name}.wav"
    write_wav(timeline, clips, wav)

    season = episode["season"]
    subprocess.run([
        imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-y", "-i", str(wav),
        "-codec:a", "libmp3lame", "-b:a", "64k", "-ac", "1",
        "-metadata", f"title={episode['episode']:02d} — {episode['title']}",
        "-metadata", f"album=Thinking in Hardware — Season {season}: {SEASON_TITLES[season]}",
        "-metadata", "artist=Thinking in Hardware",
        "-metadata", f"track={episode['episode']}",
        "-metadata", f"disc={season}",
        "-id3v2_version", "3",
        str(out_dir / f"{name}.mp3")], check=True)

    total = timeline[-1]["end"]
    print(f"{(out_dir / (name + '.mp3')).relative_to(ROOT)}: {len(timeline)} segments, "
          f"{int(total // 60)}m{total % 60:04.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
