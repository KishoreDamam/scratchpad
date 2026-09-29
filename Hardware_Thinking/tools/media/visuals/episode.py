"""Drive a Manim scene from an episode's narration timeline.

The timeline (from assemble.py) says when every paragraph starts and ends and
which visual cue it carries. Consecutive paragraphs with the same cue form one
scene. Each scene function receives a Beat, which knows the scene's time budget
and when each of its paragraphs begins, so animations land on the words that
describe them. Changing voice or pace re-times the video with no manual edits.
"""

from __future__ import annotations

import json
import os
import pathlib
from typing import Callable

from manim import FadeIn, FadeOut, Scene, VGroup, DOWN, config

from .components import BG, FG, MUTED, label

LEAD = 3.0        # title card before the narration starts
TAIL = 4.0        # end card after it finishes
FADE = 0.6        # reserved at the end of each scene to clear the stage

ROOT = pathlib.Path(__file__).resolve().parents[3]      # Hardware_Thinking/


def timeline_path(episode_id: str, default_voice: str) -> pathlib.Path:
    """The timeline to follow; override with TIH_TIMELINE=<path>."""
    override = os.environ.get("TIH_TIMELINE")
    if override:
        return pathlib.Path(override)
    return ROOT / "build" / episode_id / default_voice / "timeline.json"


class Beat:
    """A scene's slice of the video clock."""

    def __init__(self, scene: Scene, start: float, end: float, marks: dict[int, float]):
        self.scene, self.start, self.end, self.marks = scene, start, end, marks

    @property
    def duration(self) -> float:
        return self.end - self.start

    def now(self) -> float:
        return self.scene.renderer.time

    def play(self, *animations, seconds: float | None = None, share: float | None = None,
             **kwargs) -> None:
        run_time = seconds if seconds is not None else (share or 0.05) * self.duration
        self.scene.play(*animations, run_time=max(run_time, 0.3), **kwargs)

    def wait_until(self, t: float) -> None:
        gap = t - self.now()
        if gap > 1 / 30:
            self.scene.wait(gap)

    def until(self, segment_id: int) -> None:
        """Hold until the narration reaches the start of this paragraph."""
        self.wait_until(self.marks[segment_id])

    def finish(self) -> None:
        self.wait_until(self.end)


def group_scenes(segments: list[dict]) -> list[dict]:
    groups: list[dict] = []
    for seg in segments:
        if groups and groups[-1]["cue"] == seg["cue"]:
            groups[-1]["end"] = seg["end"]
            groups[-1]["ids"].append(seg["id"])
        else:
            groups.append({"cue": seg["cue"], "start": seg["start"], "end": seg["end"],
                           "ids": [seg["id"]], "line": seg.get("line")})
    return groups


def run(scene: Scene, timeline: pathlib.Path, scenes: dict[str, Callable[[Scene, Beat], None]],
        title: str, subtitle: str) -> None:
    config.background_color = BG
    scene.camera.background_color = BG
    data = json.loads(timeline.read_text(encoding="utf-8"))
    segments = data["segments"]

    groups = group_scenes(segments)
    unknown = [g for g in groups if g["cue"] not in scenes]
    if unknown:
        where = ", ".join(f"'{g['cue']}' (script line {g['line']})" for g in unknown)
        raise SystemExit(f"no scene defined for cue {where}")

    series = label("THINKING IN HARDWARE", 24, MUTED)
    heading = label(title, 64)
    sub = label(subtitle, 28, MUTED)
    title_card = VGroup(series, heading, sub).arrange(DOWN, buff=0.4)
    scene.play(FadeIn(title_card), run_time=0.8)
    scene.wait(LEAD - 1.6)
    scene.play(FadeOut(title_card), run_time=0.8)

    marks = {s["id"]: s["start"] + LEAD for s in segments}
    late = []
    for i, group in enumerate(groups):
        start = group["start"] + LEAD
        end = (groups[i + 1]["start"] if i + 1 < len(groups) else group["end"]) + LEAD
        if scene.renderer.time > start + 0.1:
            late.append((group["cue"], round(scene.renderer.time - start, 2)))
        scenes[group["cue"]](scene, Beat(scene, start, end - FADE, marks))
        Beat(scene, start, end - FADE, marks).finish()
        if scene.mobjects:
            scene.play(FadeOut(*scene.mobjects), run_time=FADE * 0.8)
        Beat(scene, start, end, marks).finish()

    end_card = VGroup(label("THINKING IN HARDWARE", 24, MUTED),
                      label(title, 48)).arrange(DOWN, buff=0.4)
    scene.play(FadeIn(end_card), run_time=0.8)
    scene.wait(TAIL - 0.8)
    if late:
        print(f"WARNING: scenes started late (cue, seconds): {late}")
