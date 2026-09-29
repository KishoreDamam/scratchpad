"""Explainer video for Season 1, episode 3: Setup and hold.

Render (from Hardware_Thinking/):
    manim -ql tools/media/video/s1ep03.py SetupAndHold --media_dir build/s1ep03/video
    manim -qh --frame_rate 30 ...   (final, 1080p30)
Scene names match the '> visual:' cues in the episode script; segment ids in
beat.until(...) are paragraph numbers from build/s1ep03/segments.json.
"""

from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from manim import (DOWN, LEFT, ORIGIN, RIGHT, UP, Arrow, Create, DashedLine, Dot,
                   FadeIn, FadeOut, Flash, GrowFromEdge, Indicate, Line, MoveAlongPath,
                   Rectangle, Scene, Text, Transform, ValueTracker, VGroup, Write,
                   always_redraw, linear)

from visuals.components import (BAD, DATA, FG, GOOD, HOLD, MUTED, SETUP, ClockWave,
                                Register, card, knob_at, label, shaded, slider)
from visuals.episode import Beat, run, timeline_path


def chaos(k: int) -> int:
    """A deterministic, jumpy three-digit value for the scribbling data line."""
    return (k * 2654435761 + 12345) % 900 + 100


# --------------------------------------------------------------------------- 0-2

def where_we_are(s: Scene, b: Beat) -> None:
    reg = Register("REG").shift(UP * 1.0)
    clock = ClockWave(periods=6, period_width=1.8, height=0.7).move_to(DOWN * 2.2)
    clk_label = label("clock", 22, MUTED).next_to(clock, LEFT, buff=0.3)
    d_arrow = Arrow(reg.d() + LEFT * 2.4, reg.d(), buff=0, color=DATA, stroke_width=4)
    q_arrow = Arrow(reg.q(), reg.q() + RIGHT * 2.4, buff=0, color=GOOD, stroke_width=4)
    b.play(FadeIn(reg), Create(clock), FadeIn(clk_label), Create(d_arrow), Create(q_arrow),
           seconds=2.0)

    periods = ValueTracker(0.0)      # time, measured in clock periods

    def d_value():
        return chaos(int(periods.get_value() * 9))

    def q_value():
        """What D held at the most recent rising edge (edges fall at k + 0.5 periods)."""
        t = periods.get_value()
        if t < 0.5:
            return 0
        last_edge = int(t - 0.5) + 0.5
        return chaos(int(last_edge * 9))

    d_text = always_redraw(lambda: label(str(d_value()), 34, DATA).next_to(d_arrow, UP))
    q_text = always_redraw(lambda: label(str(q_value()) if q_value() else "—", 34, GOOD)
                           .next_to(q_arrow, UP))
    cursor = always_redraw(lambda: Line(
        (clock.get_left()[0] + clock.width * periods.get_value() / 6, clock.low() - 0.2, 0),
        (clock.get_left()[0] + clock.width * periods.get_value() / 6, clock.high() + 0.2, 0),
        color=HOLD, stroke_width=3))
    caption = label("chaos between edges — only the edge counts", 26, MUTED).to_edge(UP)
    s.add(d_text, q_text, cursor)
    b.play(FadeIn(caption), seconds=1.0)
    b.play(periods.animate.set_value(5.95), share=0.6, rate_func=linear)
    b.until(2)
    question = label("…but is the edge really an instant?", 34, FG).to_edge(UP)
    b.play(Transform(caption, question), seconds=1.2)


# --------------------------------------------------------------------------- 3-9

def edge_window(s: Scene, b: Beat) -> None:
    clock = ClockWave(periods=3, period_width=3.0, height=1.0).move_to(DOWN * 0.5)
    x = clock.rising_edge(1)
    edge = Line((x, clock.low() - 0.6, 0), (x, clock.high() + 0.6, 0), color=HOLD, stroke_width=3)
    ask = label("how long does “looking” take?", 34).to_edge(UP)
    b.play(Create(clock), seconds=1.5)
    b.play(Create(edge), FadeIn(ask), seconds=1.2)

    b.until(5)
    stage = VGroup(clock, edge)
    b.play(stage.animate.scale(3.2, about_point=(x, clock.get_center()[1], 0)), seconds=3.0)
    grab = shaded(x - 0.35, x + 0.35, -2.4, 1.6, FG, 0.18)
    grab_label = label("the grab — tens of picoseconds, not zero", 28).to_edge(DOWN, buff=0.4)
    b.play(FadeOut(edge), FadeIn(grab), FadeIn(grab_label), seconds=1.5)

    b.until(7)
    before = shaded(x - 1.6, x - 0.35, -2.4, 1.6, SETUP, 0.3)
    before_label = label("already still", 28, SETUP).next_to(before, UP)
    b.play(FadeIn(before), FadeIn(before_label), seconds=1.5)

    b.until(8)
    after = shaded(x + 0.35, x + 1.4, -2.4, 1.6, HOLD, 0.3)
    after_label = label("stays still", 28, HOLD).next_to(after, UP)
    b.play(FadeIn(after), FadeIn(after_label), seconds=1.5)

    b.until(9)
    window = label("the window: not correct — motionless", 36).to_edge(UP)
    b.play(Transform(ask, window), FadeOut(grab_label), seconds=1.5)


# --------------------------------------------------------------------------- 10-11

def photograph(s: Scene, b: Beat) -> None:
    frame_l = Rectangle(width=4.2, height=2.8).set_stroke(FG, 3).shift(LEFT * 3.2 + UP * 0.3)
    frame_r = frame_l.copy().shift(RIGHT * 6.4)
    shutter_l = Rectangle(width=4.2, height=0.18).set_fill(SETUP, 1).set_stroke(width=0)
    shutter_l.next_to(frame_l, DOWN, buff=0.25)
    shutter_r = shutter_l.copy().next_to(frame_r, DOWN, buff=0.25)
    b.play(Create(frame_l), Create(frame_r), seconds=1.2)

    still = Dot(frame_l.get_center(), radius=0.22, color=DATA)
    b.play(FadeIn(still), GrowFromEdge(shutter_l, LEFT), seconds=2.0)
    b.play(FadeIn(label("still → sharp", 30, GOOD).next_to(shutter_l, DOWN)), seconds=0.8)

    start = frame_r.get_center() + LEFT * 1.2
    trail = VGroup(*[Dot(start + RIGHT * 0.3 * i, radius=0.22, color=DATA)
                     .set_opacity(0.15 + 0.1 * i) for i in range(9)])
    b.play(GrowFromEdge(shutter_r, LEFT), FadeIn(trail, lag_ratio=0.3), seconds=2.5)
    b.play(FadeIn(label("moving → blur\nnot a photograph of anything", 30, BAD)
                  .next_to(shutter_r, DOWN)), seconds=0.8)

    b.until(11)
    names = VGroup(label("before the shutter: SETUP", 32, SETUP),
                   label("after the shutter: HOLD", 32, HOLD)).arrange(RIGHT, buff=1.2).to_edge(UP)
    b.play(FadeIn(names, lag_ratio=0.4), seconds=1.5)


# --------------------------------------------------------------------------- 12-15

LAUNCH, CAPTURE, SETUP_W, CLK_Q = -4.5, 4.5, 0.9, 0.6


def setup(s: Scene, b: Beat) -> None:
    axis = Line((LAUNCH - 0.8, 0, 0), (CAPTURE + 0.8, 0, 0), color=MUTED)
    edges = VGroup(*[Line((x, -0.1, 0), (x, 2.4, 0), color=FG, stroke_width=4)
                     for x in (LAUNCH, CAPTURE)])
    edge_names = VGroup(label("edge", 22, MUTED).next_to(edges[0], UP),
                        label("next edge", 22, MUTED).next_to(edges[1], UP))
    window = shaded(CAPTURE - SETUP_W, CAPTURE, 0, 2.3, SETUP, 0.35)
    window_label = label("setup", 26, SETUP).next_to(window, DOWN, buff=0.15)
    b.play(Create(axis), Create(edges), FadeIn(edge_names), seconds=1.5)
    b.play(FadeIn(window), FadeIn(window_label), seconds=1.2)

    arrival = ValueTracker(0.5)
    marker = always_redraw(lambda: DashedLine((arrival.get_value(), 0, 0),
                                              (arrival.get_value(), 2.0, 0), color=DATA))
    marker_label = always_redraw(lambda: label("data settles", 22, DATA)
                                 .next_to(marker, UP, buff=0.1))
    b.until(13)
    b.play(FadeIn(marker), FadeIn(marker_label), seconds=1.0)
    s.add(marker, marker_label)

    b.until(14)
    y = -1.4

    def bar():
        a = arrival.get_value()
        slack_end = CAPTURE - SETUP_W
        parts = [shaded(LAUNCH, LAUNCH + CLK_Q, y - 0.3, y + 0.3, MUTED, 0.6),
                 shaded(LAUNCH + CLK_Q, a, y - 0.3, y + 0.3, DATA, 0.5),
                 shaded(slack_end - 0.001, CAPTURE, y - 0.3, y + 0.3, SETUP, 0.6)]
        if a < slack_end:
            parts.append(shaded(a, slack_end, y - 0.3, y + 0.3, GOOD, 0.7))
        else:
            parts.append(shaded(slack_end, a, y - 0.3, y + 0.3, BAD, 0.8))
        return VGroup(*parts)

    def bar_labels():
        a = arrival.get_value()
        slack = (CAPTURE - SETUP_W) - a
        return VGroup(
            label("clock→Q", 20, MUTED).move_to((LAUNCH + CLK_Q / 2, y - 0.6, 0)),
            label("logic", 20, DATA).move_to(((LAUNCH + CLK_Q + a) / 2, y - 0.6, 0)),
            label("slack: positive — made it" if slack >= 0 else "slack: negative — too late",
                  26, GOOD if slack >= 0 else BAD)
            .move_to((0, y - 1.3, 0)))

    budget, budget_labels = always_redraw(bar), always_redraw(bar_labels)
    heading = label("period − clock→Q − setup = what logic may use", 28).to_edge(UP)
    b.play(FadeIn(budget), FadeIn(budget_labels), FadeIn(heading), seconds=1.5)
    s.add(budget, budget_labels)

    b.until(15)
    b.play(arrival.animate.set_value(3.2), seconds=5.0)
    b.play(arrival.animate.set_value(4.3), seconds=3.0)
    s.wait(1.5)
    b.play(arrival.animate.set_value(1.5), seconds=3.0)


# --------------------------------------------------------------------------- 16-17

def critical_path(s: Scene, b: Beat) -> None:
    lengths = [5.1, 6.3, 4.2, 7.0, 5.8, 3.9, 9.3, 6.6, 4.8, 7.4, 5.5, 6.1]
    left, deadline = -6.0, 2.6
    bars = VGroup(*[Rectangle(width=w * 0.95, height=0.26)
                    .set_fill(BAD if w * 0.95 > deadline - left else SETUP, 0.8)
                    .set_stroke(width=0)
                    .move_to((left + w * 0.95 / 2, 2.6 - i * 0.42, 0))
                    for i, w in enumerate(lengths)])
    line = DashedLine((deadline, 3.0, 0), (deadline, -2.3, 0), color=FG)
    line_label = label("clock period", 22).next_to(line, UP, buff=0.1)
    worst = label("worst slack: −0.5", 30, BAD).move_to((4.6, 1.5, 0))
    b.play(FadeIn(bars, lag_ratio=0.1), Create(line), FadeIn(line_label), seconds=2.5)
    b.play(FadeIn(worst), Indicate(bars[6], color=BAD), seconds=1.5)

    others = [bar for i, bar in enumerate(bars) if i != 6]
    b.play(*[bar.animate.stretch(0.6, 0, about_edge=LEFT) for bar in others], seconds=4.0)
    b.play(Indicate(worst, color=BAD), seconds=1.2)
    b.play(FadeIn(label("ninety-nine paths faster:\nreport unchanged", 26, MUTED)
                  .next_to(worst, DOWN, buff=0.5)), seconds=1.0)

    b.until(17)
    fixes = VGroup(label("1  shallower logic", 28),
                   label("2  pipeline it (ep. 5)", 28),
                   label("3  slower clock", 28)).arrange(DOWN, aligned_edge=LEFT, buff=0.3)
    fixes.move_to((4.4, -1.5, 0))
    b.play(FadeIn(fixes, lag_ratio=0.6), seconds=4.0)
    b.play(bars[6].animate.stretch(0.8, 0, about_edge=LEFT).set_fill(GOOD, 0.8),
           Transform(worst, label("worst slack: +0.3", 30, GOOD).move_to(worst)), seconds=2.5)


# --------------------------------------------------------------------------- 18-22

def timing_axis(edge_x: float = 0.0):
    axis = Line((-6, 0, 0), (6, 0, 0), color=MUTED)
    edge = Line((edge_x, -0.1, 0), (edge_x, 2.6, 0), color=FG, stroke_width=4)
    return axis, edge


def hold_window(s: Scene, b: Beat) -> None:
    axis, edge = timing_axis()
    setup_w = shaded(-1.4, 0, 0, 2.4, SETUP, 0.35)
    hold_w = shaded(0, 1.1, 0, 2.4, HOLD, 0.35)
    b.play(Create(axis), Create(edge), FadeIn(setup_w), seconds=1.5)
    b.play(FadeIn(label("setup", 26, SETUP).next_to(setup_w, UP)), seconds=0.6)
    b.play(FadeIn(hold_w), FadeIn(label("hold", 26, HOLD).next_to(hold_w, UP)), seconds=1.2)
    heading = label("hold: stay still AFTER the edge", 34).to_edge(UP)
    b.play(FadeIn(heading), seconds=1.0)

    b.until(19)
    early = DashedLine((0.5, 0, 0), (0.5, 2.1, 0), color=BAD)
    b.play(Create(early), FadeIn(label("the next value arrives here", 24, BAD)
                                   .next_to(early, DOWN, buff=0.5)), seconds=1.5)
    b.play(Transform(heading, label("a signal can arrive too EARLY", 38, BAD).to_edge(UP)),
           seconds=1.2)


# --------------------------------------------------------------------------- 23-31

class Race:
    """Registers A and B on one clock, with a wire (and optional delay cells) between."""

    def __init__(self, delay_cells: int = 0, y: float = 0.4):
        self.a = Register("A").scale(0.8).move_to((-4.0, y, 0))
        self.b = Register("B").scale(0.8).move_to((4.0, y, 0))
        self.wire = Line(self.a.q(), self.b.d(), color=FG, stroke_width=4)
        self.cells = VGroup(*[Rectangle(width=0.7, height=0.5).set_fill("#1f2933", 1)
                              .set_stroke(HOLD, 3).move_to((-1.3 + i * 1.3, y, 0))
                              for i in range(delay_cells)])
        self.cell_labels = VGroup(*[label("dly", 18, HOLD).move_to(c) for c in self.cells])
        clock_y = y - 1.9
        self.clock = Line((-5.2, clock_y, 0), (5.2, clock_y, 0), color=MUTED, stroke_width=3)
        self.taps = VGroup(Line((self.a.clk()[0], clock_y, 0), self.a.clk(), color=MUTED),
                           Line((self.b.clk()[0], clock_y, 0), self.b.clk(), color=MUTED))
        self.clock_label = label("same clock edge", 22, MUTED).next_to(self.clock, DOWN)
        self.group = VGroup(self.a, self.b, self.wire, self.cells, self.cell_labels,
                            self.clock, self.taps, self.clock_label)

    def old_value(self):
        return label("old", 26, GOOD).next_to(self.b.d(), UP, buff=0.35).shift(LEFT * 0.5)

    def run(self, s: Scene, b: Beat, travel: float, hold: float = 2.4) -> bool:
        """Launch the new value; B's hold countdown runs alongside. True if hold is met."""
        s.play(Flash(self.a.clk(), color=HOLD), Flash(self.b.clk(), color=HOLD), run_time=0.6)
        bar = Rectangle(width=2.0, height=0.2).set_fill(HOLD, 1).set_stroke(width=0)
        bar.next_to(self.b, UP, buff=0.4)
        tag = label("B still grabbing", 20, HOLD).next_to(bar, UP, buff=0.1)
        dot = Dot(self.a.q(), radius=0.14, color=DATA)
        s.add(bar, tag, dot)
        met = travel >= hold
        first, second = (hold, travel - hold) if met else (travel, hold - travel)
        s.play(MoveAlongPath(dot, Line(self.a.q(), self.a.q() + (self.b.d() - self.a.q())
                                       * min(1, first / travel))),
               bar.animate.stretch(max(1 - first / hold, 0.01), 0, about_edge=LEFT),
               run_time=first, rate_func=linear)
        if met:
            s.play(FadeOut(bar), FadeOut(tag), run_time=0.2)
            s.play(MoveAlongPath(dot, Line(dot.get_center(), self.b.d())),
                   run_time=max(second, 0.3), rate_func=linear)
        else:
            s.play(bar.animate.stretch(0.01, 0, about_edge=LEFT), run_time=max(second, 0.3),
                   rate_func=linear)
        verdict = label("hold met" if met else "blur — hold violation", 28, GOOD if met else BAD)
        verdict.next_to(self.b, DOWN, buff=0.3)
        s.play(self.b.box.animate.set_stroke(GOOD if met else BAD), FadeIn(verdict), run_time=0.6)
        s.wait(1.0)
        s.play(FadeOut(verdict), FadeOut(dot), FadeOut(bar), FadeOut(tag),
               self.b.box.animate.set_stroke(FG), run_time=0.5)
        return met


def hold_race(s: Scene, b: Beat) -> None:
    race = Race()
    b.play(FadeIn(race.group), seconds=1.5)
    b.until(24)
    b.play(FadeIn(race.old_value()), seconds=1.0)
    b.until(25)
    b.play(FadeIn(label("the same edge launches A's new value", 28).to_edge(UP)), seconds=1.0)
    b.until(27)
    race.run(s, b, travel=1.2)
    race.run(s, b, travel=1.2)


def hold_clock(s: Scene, b: Beat) -> None:
    race = Race(y=-0.6)
    wave = ClockWave(periods=4, period_width=1.6, height=0.5).move_to(UP * 2.4)
    rate = label("1 GHz", 30).next_to(wave, RIGHT, buff=0.4)
    b.play(FadeIn(race.group), Create(wave), FadeIn(rate), seconds=1.5)
    race.run(s, b, travel=1.2)
    for text, periods in (("1 MHz", 2), ("1 kHz", 1)):
        slower = ClockWave(periods=periods, period_width=6.4 / periods, height=0.5).move_to(UP * 2.4)
        b.play(Transform(wave, slower),
               Transform(rate, label(text, 30).next_to(slower, RIGHT, buff=0.4)), seconds=1.5)
        race.run(s, b, travel=1.2)
    b.until(30)
    verdicts = VGroup(label("setup violation → slow chip", 30, SETUP),
                      label("hold violation → dead chip", 30, BAD)).arrange(DOWN, buff=0.3)
    b.play(FadeOut(wave), FadeOut(rate), FadeIn(verdicts.to_edge(UP)), seconds=1.5)


def hold_fix(s: Scene, b: Beat) -> None:
    race = Race(delay_cells=3)
    b.play(FadeIn(race.group), seconds=1.5)
    b.play(Indicate(race.cells, color=HOLD), seconds=1.5)
    race.run(s, b, travel=3.4)
    b.play(FadeIn(label("logic that exists purely to be slow", 30, HOLD).to_edge(UP)),
           seconds=1.0)


# --------------------------------------------------------------------------- 32-39

def pvt(s: Scene, b: Beat) -> None:
    sliders = VGroup(slider("Process", "fast silicon", "slow silicon"),
                     slider("Voltage", "high", "low"),
                     slider("Temperature", "cold", "hot")).arrange(DOWN, buff=1.0)
    sliders.move_to((-3.4, 0, 0))
    knobs = [ValueTracker(0.5) for _ in range(3)]
    dots = [always_redraw(lambda sl=sl, k=k: Dot(knob_at(sl, k.get_value()), radius=0.14,
                                                 color=FG))
            for sl, k in zip(sliders, knobs)]

    top, bottom, x = 2.3, -2.3, 3.4
    setup_line = Line((x - 1.8, top - 0.6, 0), (x + 1.8, top - 0.6, 0), color=SETUP)
    hold_line = Line((x - 1.8, bottom + 0.6, 0), (x + 1.8, bottom + 0.6, 0), color=HOLD)
    lines = VGroup(setup_line, hold_line,
                   label("slowest path must stay below (setup)", 20, SETUP)
                   .next_to(setup_line, UP, buff=0.1),
                   label("fastest path must stay above (hold)", 20, HOLD)
                   .next_to(hold_line, DOWN, buff=0.1))

    def slowness():
        return sum(k.get_value() for k in knobs) / 3          # 0 fast … 1 slow

    def spread():
        shift = (slowness() - 0.5) * 3.2
        lo, hi = -0.9 + shift, 0.9 + shift
        band = shaded(x - 1.2, x + 1.2, lo, hi, DATA, 0.35)
        max_ok = hi <= top - 0.6
        min_ok = lo >= bottom + 0.6
        return VGroup(band,
                      Line((x - 1.2, hi, 0), (x + 1.2, hi, 0), color=GOOD if max_ok else BAD,
                           stroke_width=5),
                      Line((x - 1.2, lo, 0), (x + 1.2, lo, 0), color=GOOD if min_ok else BAD,
                           stroke_width=5))

    band = always_redraw(spread)
    b.play(FadeIn(sliders), *[FadeIn(d) for d in dots], Create(lines), FadeIn(band),
           seconds=2.0)
    s.add(*dots, band)
    legend = VGroup(shaded(0, 0.4, 0, 0.25, DATA, 0.5),
                    label("your design's path delays (fastest to slowest)", 20, DATA)
                    ).arrange(RIGHT, buff=0.2).move_to((x, -3.45, 0))
    b.play(FadeIn(legend), seconds=0.8)

    b.until(34)
    b.play(knobs[2].animate.set_value(0.95), seconds=2.5)
    b.until(35)
    b.play(knobs[1].animate.set_value(0.95), seconds=2.5)
    b.until(36)
    b.play(knobs[0].animate.set_value(0.95), seconds=2.5)
    b.until(37)
    b.play(FadeIn(label("P · V · T", 40).to_edge(UP)), seconds=1.0)
    b.until(38)
    for value in (0.05, 0.95, 0.05, 0.5):
        b.play(*[k.animate.set_value(value) for k in knobs], seconds=2.5)
    b.until(39)
    gap = shaded(x - 1.8, x + 1.8, bottom + 0.6, top - 0.6, GOOD, 0.12)
    b.play(FadeIn(gap), FadeIn(label("the space your design must fit", 24, GOOD)
                               .next_to(gap, LEFT, buff=0.2).shift(UP * 1.4)), seconds=1.5)


# --------------------------------------------------------------------------- 40-49

def cost(s: Scene, b: Beat) -> None:
    ok = label("✓  every equation right, every test passing", 32, GOOD)
    late = label("✗  one signal forty picoseconds late on a warm day", 32, BAD)
    VGroup(ok, late).arrange(DOWN, buff=0.6, aligned_edge=LEFT).shift(UP * 0.8)
    b.play(FadeIn(ok), seconds=1.2)
    b.until(41)
    b.play(FadeIn(late), seconds=1.2)
    b.until(43)
    line = VGroup(label("Logic is table stakes.", 44, FG),
                  label("Time is the profession.", 44, HOLD)).arrange(DOWN, buff=0.3)
    b.play(VGroup(ok, late).animate.shift(UP * 1.2).set_opacity(0.4),
           Write(line.shift(DOWN * 1.4)), seconds=2.5)


def one_thing(s: Scene, b: Beat) -> None:
    text = ("A signal can be too late, and a signal can be too early, and only one of those "
            "is fixed by slowing down. Being correct inside the window is the job.")
    b.play(FadeIn(card("the one thing", text, HOLD).move_to(ORIGIN)), seconds=1.5)


def exercise(s: Scene, b: Beat) -> None:
    heading = label("COMMUTE EXERCISE", 26, SETUP).to_edge(UP)
    a = Register("A").move_to((-2.2, 0.3, 0))
    reg_b = Register("B").move_to((2.2, 0.3, 0))
    wire = Line(a.q(), reg_b.d(), color=FG, stroke_width=4)
    note = label("no logic at all — the shortest path", 26, MUTED).next_to(VGroup(a, reg_b), DOWN, buff=0.4)
    b.play(FadeIn(heading), FadeIn(a), FadeIn(reg_b), Create(wire), seconds=2.0)
    b.play(FadeIn(note), seconds=1.0)
    b.until(47)
    safe = label("and yet it is one of the safest things you can build", 28, GOOD)
    b.play(FadeIn(safe.next_to(note, DOWN, buff=0.3)), seconds=1.2)
    b.until(48)
    why = label("?", 140, HOLD).next_to(wire, UP, buff=0.3)
    b.play(FadeIn(why), seconds=0.8)
    b.play(Indicate(why, color=HOLD), seconds=1.2)
    b.until(49)
    b.play(FadeIn(label("hint: a number engineered into the register itself", 26, MUTED)
                  .to_edge(DOWN, buff=0.4)), seconds=1.2)


SCENES = {
    "where-we-are": where_we_are, "edge-window": edge_window, "photograph": photograph,
    "setup": setup, "critical-path": critical_path, "hold-window": hold_window,
    "hold-race": hold_race, "hold-clock": hold_clock, "hold-fix": hold_fix, "pvt": pvt,
    "cost": cost, "one-thing": one_thing, "exercise": exercise,
}


class SetupAndHold(Scene):
    def construct(self):
        run(self, timeline_path("s1ep03", "piper-en_GB-northern_english_male-medium@1.45"), SCENES,
            title="Setup and hold", subtitle="Season 1 · Episode 3")
