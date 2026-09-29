import json
import pathlib
import sys
import wave

HERE = pathlib.Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1]))                  # tools/media

import assemble  # noqa: E402
from visuals.episode import group_scenes  # noqa: E402

RATE = 22050


def tone(path: pathlib.Path, seconds: float) -> None:
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(RATE)
        wf.writeframes(b"\x01\x00" * round(seconds * RATE))


SEGMENTS = [
    {"id": 0, "beat": "A", "cue": "x", "line": 5, "text": "one"},
    {"id": 1, "beat": "A", "cue": "x", "line": 7, "text": "two"},
    {"id": 2, "beat": "B", "cue": "y", "line": 11, "text": "three"},
]


def clips(tmp_path, lengths):
    out = {}
    for seg, seconds in zip(SEGMENTS, lengths):
        path = tmp_path / f"{seg['id']}.wav"
        tone(path, seconds)
        out[seg["id"]] = {"id": seg["id"], "path": path, "seconds": seconds}
    return out


def test_timeline_pauses_longer_between_beats(tmp_path):
    timeline = assemble.build_timeline(SEGMENTS, clips(tmp_path, [1.0, 2.0, 0.5]))
    starts = [e["start"] for e in timeline]
    assert starts == [0.0, 1.0 + assemble.PARAGRAPH_PAUSE,
                      3.0 + assemble.PARAGRAPH_PAUSE + assemble.BEAT_PAUSE]
    assert timeline[-1]["end"] == round(starts[-1] + 0.5, 3)


def test_joined_wav_length_matches_timeline(tmp_path, monkeypatch):
    monkeypatch.setattr(assemble, "ROOT", pathlib.Path("/"))
    lengths = [1.0, 2.0, 0.5]
    clip_map = clips(tmp_path, lengths)
    for c in clip_map.values():
        c["path"] = str(c["path"])
    timeline = assemble.build_timeline(SEGMENTS, clip_map)
    out = tmp_path / "joined.wav"
    assemble.write_wav(timeline, clip_map, out)
    with wave.open(str(out), "rb") as wf:
        seconds = wf.getnframes() / wf.getframerate()
    assert abs(seconds - timeline[-1]["end"]) < 1 / 30          # within one video frame


def test_scenes_group_consecutive_cues():
    timeline = [{"id": s["id"], "cue": s["cue"], "line": s["line"],
                 "start": float(i), "end": i + 0.9} for i, s in enumerate(SEGMENTS)]
    groups = group_scenes(timeline)
    assert [(g["cue"], g["ids"], g["start"], g["end"]) for g in groups] == [
        ("x", [0, 1], 0.0, 1.9), ("y", [2], 2.0, 2.9)]


def test_srt_time_format():
    assert assemble.srt_time(3723.5) == "01:02:03,500"
