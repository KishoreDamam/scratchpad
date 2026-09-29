"""Reusable drawing pieces for the explainer videos.

Colours are fixed per concept across every episode, so a listener who has seen
one video can read the next: setup is blue, hold is amber, a violation is red,
a met constraint is green, data is violet.
"""

from __future__ import annotations

import textwrap

from manim import (DOWN, LEFT, RIGHT, UP, Polygon, Rectangle, Text, VGroup,
                   VMobject)

BG = "#0f1419"
FG = "#e6edf3"
MUTED = "#768390"
SETUP = "#4c9be8"
HOLD = "#f2a93b"
BAD = "#e5534b"
GOOD = "#57ab5a"
DATA = "#b392f0"
FONT = "sans-serif"


def label(text: str, size: int = 28, color: str = FG, width: int | None = None) -> Text:
    """Plain text, optionally wrapped to roughly `width` characters per line."""
    if width:
        text = "\n".join(textwrap.wrap(text, width))
    return Text(text, font_size=size, color=color, line_spacing=0.9, font=FONT)


def shaded(x0: float, x1: float, y0: float, y1: float, color: str,
           opacity: float = 0.3) -> Rectangle:
    """A filled region between two x and two y coordinates."""
    rect = Rectangle(width=max(x1 - x0, 1e-3), height=max(y1 - y0, 1e-3))
    rect.move_to(((x0 + x1) / 2, (y0 + y1) / 2, 0))
    return rect.set_fill(color, opacity).set_stroke(color, width=2, opacity=0.8)


class ClockWave(VMobject):
    """A square wave starting low, with helpers to find each rising edge."""

    def __init__(self, periods: int = 4, period_width: float = 2.0,
                 height: float = 0.8, color: str = FG, **kwargs):
        super().__init__(**kwargs)
        self.period_width, self.periods, self.wave_height = period_width, periods, height
        points, x = [[0, 0, 0]], 0.0
        for _ in range(periods):
            half = x + period_width / 2
            points += [[half, 0, 0], [half, height, 0],
                       [x + period_width, height, 0], [x + period_width, 0, 0]]
            x += period_width
        self.set_points_as_corners(points)
        self.set_stroke(color, width=4)

    def rising_edge(self, i: int) -> float:
        """Scene x coordinate of the i-th rising edge (0-based)."""
        scale = self.width / (self.period_width * self.periods)
        return self.get_left()[0] + self.period_width * (i + 0.5) * scale

    def low(self) -> float:
        return self.get_bottom()[1]

    def high(self) -> float:
        return self.get_top()[1]


class Register(VGroup):
    """A register block: box, name, D and Q pins and a clock triangle."""

    def __init__(self, name: str = "REG", width: float = 2.0, height: float = 1.8,
                 color: str = FG):
        box = Rectangle(width=width, height=height).set_stroke(color, width=4)
        clock = Polygon([-0.18, 0, 0], [0.18, 0, 0], [0, 0.25, 0])
        clock.set_stroke(color, width=3).next_to(box.get_bottom(), UP, buff=0)
        title = label(name, 30, color).move_to(box)
        d_pin = label("D", 20, MUTED).next_to(box.get_left(), RIGHT, buff=0.12)
        q_pin = label("Q", 20, MUTED).next_to(box.get_right(), LEFT, buff=0.12)
        super().__init__(box, clock, title, d_pin, q_pin)
        self.box, self.title = box, title

    def d(self):
        return self.box.get_left()

    def q(self):
        return self.box.get_right()

    def clk(self):
        return self.box.get_bottom()


def slider(name: str, left: str, right: str, width: float = 3.6) -> VGroup:
    """A labelled track; place a knob on it with `knob_at`."""
    track = Rectangle(width=width, height=0.06).set_fill(MUTED, 1).set_stroke(width=0)
    title = label(name, 26).next_to(track, UP, buff=0.25)
    lo = label(left, 20, MUTED).next_to(track, DOWN, buff=0.2).align_to(track, LEFT)
    hi = label(right, 20, MUTED).next_to(track, DOWN, buff=0.2).align_to(track, RIGHT)
    group = VGroup(track, title, lo, hi)
    group.track = track
    return group


def knob_at(slider_group: VGroup, fraction: float):
    """Scene point `fraction` (0..1) of the way along a slider's track."""
    track = slider_group.track
    return track.get_left() + (track.get_right() - track.get_left()) * fraction


def card(heading: str, body: str, accent: str = SETUP, width: int = 44) -> VGroup:
    head = label(heading.upper(), 24, accent)
    text = label(body, size=38, width=width)
    return VGroup(head, text).arrange(DOWN, buff=0.5, aligned_edge=LEFT)


__all__ = ["BG", "FG", "MUTED", "SETUP", "HOLD", "BAD", "GOOD", "DATA", "label", "shaded",
           "ClockWave", "Register", "slider", "knob_at", "card", "LEFT", "RIGHT", "UP", "DOWN"]
