import json
import pathlib
import sys

import pytest

HERE = pathlib.Path(__file__).resolve()
ROOT = HERE.parents[3]
sys.path.insert(0, str(HERE.parents[1]))

from captions import MAX_CHARS, MAX_LINES, chunk, cues  # noqa: E402
from segment import segment  # noqa: E402

EPISODES = sorted((ROOT / "episodes").glob("*/*.md"))


@pytest.mark.parametrize("path", EPISODES, ids=lambda p: p.stem)
def test_every_caption_fits_and_no_words_are_lost(path):
    for seg in segment(path)["segments"]:
        pieces = chunk(seg["text"])
        assert " ".join(pieces).split() == seg["text"].split()
        for piece in pieces:
            lines = __import__("textwrap").wrap(piece, MAX_CHARS)
            assert len(lines) <= MAX_LINES and all(len(line) <= MAX_CHARS for line in lines)


def test_short_sentences_share_a_cue_and_long_ones_split_evenly():
    assert chunk("Not this one. Why?") == ["Not this one. Why?"]
    long = ("A hold violation at one gigahertz is still a hold violation at one megahertz, "
            "and still one at one kilohertz.")
    pieces = chunk(long)
    assert len(pieces) == 2
    assert abs(len(pieces[0]) - len(pieces[1])) < 25


def test_cues_tile_each_paragraph_exactly():
    segs = [{"start": 1.0, "end": 9.0, "text": "First sentence here. " * 6},
            {"start": 10.0, "end": 12.0, "text": "Short."}]
    out = cues(segs, offset=3.0)
    assert out[0]["start"] == 4.0
    first_para = [c for c in out if c["end"] <= 12.0 + 1e-9]
    assert abs(first_para[-1]["end"] - 12.0) < 1e-9
    assert out[-1]["start"] == 13.0 and out[-1]["end"] == 15.0
    assert all(b["start"] >= a["end"] - 1e-9 for a, b in zip(out, out[1:]))
