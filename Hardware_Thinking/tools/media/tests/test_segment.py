import pathlib
import sys

import pytest

HERE = pathlib.Path(__file__).resolve()
ROOT = HERE.parents[3]                     # Hardware_Thinking/
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "tools" / "media"))

from narrate import narrate  # noqa: E402
from segment import segment  # noqa: E402

EPISODES = sorted((ROOT / "episodes").glob("*/*.md"))


def normalise(paragraphs):
    return [" ".join(p.split()) for p in paragraphs if p.strip()]


@pytest.mark.parametrize("path", EPISODES, ids=lambda p: p.stem)
def test_round_trip_matches_narrate(path):
    spoken = narrate(path.read_text(encoding="utf-8")).split("\n\n")
    texts = [s["text"] for s in segment(path)["segments"]]
    assert texts == normalise(spoken)


def test_every_season_is_covered():
    assert len(EPISODES) >= 72


FIXTURE = """---
episode: 7
title: Fixture
---

> Production note: not spoken.

## Where we are

First paragraph,
over two lines.

> visual: intro

Second **paragraph**.

## The turn

Third *paragraph*.
> visual: diagram
Still third.

Fourth.
"""


def test_beats_cues_and_lines(tmp_path):
    path = tmp_path / "s3-fixture" / "ep07.md"
    path.parent.mkdir()
    path.write_text(FIXTURE, encoding="utf-8")

    data = segment(path)
    assert (data["id"], data["season"], data["title"]) == ("s3ep07", 3, "Fixture")

    segs = data["segments"]
    assert [s["text"] for s in segs] == [
        "First paragraph, over two lines.", "Second paragraph.",
        "Third paragraph. Still third.", "Fourth."]
    assert [s["beat"] for s in segs] == ["Where we are", "Where we are",
                                        "The turn", "The turn"]
    # A cue applies from the paragraph that starts after it.
    assert [s["cue"] for s in segs] == [None, "intro", "intro", "diagram"]
    assert [s["line"] for s in segs] == [10, 15, 19, 23]
