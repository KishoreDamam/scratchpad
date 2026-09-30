"""Caption cues sized for reading: at most two lines of 42 characters.

A narration paragraph can run thirty seconds, far too long for one caption. Each
paragraph is packed into cues of whole sentences where they fit; a sentence too
long for one cue is split into evenly sized pieces rather than leaving a stub.
Each cue gets a share of the paragraph's time proportional to its length.
"""

from __future__ import annotations

import re
import textwrap

MAX_CHARS = 42
MAX_LINES = 2


def fits(text: str) -> bool:
    return len(textwrap.wrap(text, MAX_CHARS)) <= MAX_LINES


def balanced(sentence: str) -> list[str]:
    """Split one long sentence into the fewest roughly equal pieces that each fit."""
    words = sentence.split()
    n = 2
    while True:
        target = len(sentence) / n
        pieces, current = [], []
        for word in words:
            if current and len(" ".join(current + [word])) > target and len(pieces) < n - 1:
                pieces.append(" ".join(current))
                current = []
            current.append(word)
        pieces.append(" ".join(current))
        if all(fits(p) for p in pieces):
            return pieces
        n += 1


def chunk(text: str) -> list[str]:
    """Whole sentences per caption where they fit; long sentences split evenly."""
    chunks, current = [], ""
    for sentence in re.split(r"(?<=[.?!])\s+", text):
        if current and fits(f"{current} {sentence}"):
            current = f"{current} {sentence}"
            continue
        if current:
            chunks.append(current)
        if fits(sentence):
            current = sentence
        else:
            *head, current = balanced(sentence)
            chunks.extend(head)
    chunks.append(current)
    return chunks


def cues(segments: list[dict], offset: float = 0.0) -> list[dict]:
    """Caption cues for timeline segments, each {start, end, text}; text is pre-wrapped."""
    out = []
    for seg in segments:
        pieces = chunk(seg["text"])
        total = sum(len(p) for p in pieces)
        t, span = seg["start"] + offset, seg["end"] - seg["start"]
        for piece in pieces:
            length = span * len(piece) / total
            out.append({"start": t, "end": t + length,
                        "text": "\n".join(textwrap.wrap(piece, MAX_CHARS))})
            t += length
    return out


def srt_time(seconds: float) -> str:
    ms = round(seconds * 1000)
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def to_srt(cue_list: list[dict]) -> str:
    return "".join(f"{i}\n{srt_time(c['start'])} --> {srt_time(c['end'])}\n{c['text']}\n\n"
                   for i, c in enumerate(cue_list, start=1))
