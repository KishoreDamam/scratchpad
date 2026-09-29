# Audio and video pipeline for "Thinking in Hardware" — design

Date: 2026-09-29
Status: approved in conversation, pending written review
Scope: `Hardware_Thinking/` (72 episode scripts, Seasons 1–6; Seasons 7–8 to follow)

## Goal

1. Turn every episode script into a listenable, correctly tagged MP3.
2. Pilot **explainer video** on one episode (S1 ep03, *Setup and hold*) and use
   the result to decide how far to take video.

Audio is the primary product. Video depends on audio (it is timed from the
narration), so audio is built first.

## Decisions made

| Question | Decision |
|---|---|
| Video purpose | Explainer visuals — real diagrams — piloted on one episode, then decide |
| Video technique | Programmatic animation (Manim Community Edition). No AI video for technical content |
| TTS engine | Pilot two (Piper local, Higgsfield in-session), choose by ear |
| Pilot episode | S1 ep03 *Setup and hold*, for both the audio comparison and the video pilot |
| Sync unit | One spoken paragraph |
| Generated media in git | No. `build/` is gitignored; code, cues and segment data are committed |

## Architecture

```
episode.md ──segment.py──► segments.json   (spoken paragraphs + attached "> visual:" cues)
                │
                ├─tts.py (engine: piper | higgsfield)──► build/<ep>/audio/NNN.wav (+ durations)
                │
                ├─assemble.py──► build/<ep>/<ep>.mp3   (pauses, tags, 64 kbps mono)
                │
                └─timeline.json (start/end per paragraph) ──► build/<ep>/<ep>.srt
                        │
                        └─video/<ep>.py (Manim scenes keyed to paragraph ids)
                                  ──► silent mp4 ──ffmpeg mux──► build/<ep>/<ep>.mp4
```

All new code lives in `Hardware_Thinking/tools/media/`. It reuses the stripping
rules of `tools/narrate.py` (importing them, not copying them).

### Units

- **`segment.py`** — parses one episode markdown into an ordered list of
  segments: `{id, beat, text, cue}`. A segment is one spoken paragraph. `beat` is
  the most recent heading (headings are never spoken). `cue` is the scene name
  from the nearest preceding `> visual: <scene>` line, or `null`. Front matter
  supplies episode and title; season comes from front matter where present and
  otherwise from the folder prefix (Season 1 scripts have no `season` field). Output: `segments.json` (committed —
  small, reviewable, diffable).
- **`tts.py`** — renders each segment to a WAV through an engine adapter with one
  method, `render(text, voice) -> wav`. Adapters: `piper`, `higgsfield`. Clips
  are cached by `sha256(text + engine + voice)`, so reruns skip unchanged
  paragraphs and resume after a crash or credit exhaustion.
- **`assemble.py`** — concatenates clips with ~400 ms between paragraphs and
  ~1.2 s between beats, encodes MP3 64 kbps mono, writes ID3 tags (album
  "Thinking in Hardware — Season N", track number, title from front matter), and
  emits `timeline.json` and an `.srt`.
- **`visuals/`** — reusable Manim components: clock waveform, register block,
  timing diagram with shaded windows, budget bar, path race. Built for ep03 and
  intended for reuse (pipelining, CDC, Season 5 timing episodes).
- **`video/s1ep03.py`** — the pilot's scenes. Each scene's duration comes from the
  summed durations of the paragraphs it covers in `timeline.json`.

### Visual cues in scripts

Cues are production-note lines: `> visual: <scene-name>`. `narrate.py` already
drops every line starting with `>`, so cues never reach narration and the script
stays the single source of truth. Paragraphs without a new cue continue the
current scene with a slow idle animation.

## Audio pilot

Input: S1 ep03, segmented (~1,750 words, ~12 min).

- **Piper** — install `piper-tts`; render with 2–3 voices (British and US) so
  the free option is judged by its best voice.
- **Higgsfield** — read-only balance and voice list first; render **one
  paragraph**, report its credit cost and the projected cost for the full series.
  No further Higgsfield rendering without explicit approval.
- **Comparison page** — an HTML page with one player per engine/voice and the
  same ~60 s dense excerpt (the "arriving on time" passage, with spoken numbers)
  back to back.

Selection criteria, in order: listened to on the real listening device (car or
phone, not laptop speakers); pleasant after ten minutes; spelled-out numbers and
em-dash pauses read as intended; full-series cost.

## Video pilot — S1 ep03 scene list

1. Title card — "Setup and hold", S1 E03.
2. *Where we are* — register block and square-wave clock; value captured at each
   edge; the data line scribbles between edges.
3. *The edge is not an instant* — zoom into one edge until it widens into the
   capture window.
4. *Photograph* — abstract shutter over a moving dot: still is sharp, moving is
   blurred.
5. *Setup* — timing diagram with shaded setup window; budget bar
   (period − clock-to-output − setup = slack); slack goes green to red as the
   data arrival slides later.
6. *Critical path* — a dozen path bars, the longest highlighted; shortening the
   others leaves slack unchanged; the three fixes captioned.
7. *Hold* — registers A → B on one edge; old value waiting, new value racing;
   hold window breached; clock period stretches while the violation remains;
   delay cells drop in as the fix.
8. *PVT* — process, voltage, temperature sliders; setup fails at the slow corner,
   hold at the fast; the gap between is the design space.
9. Closing cards — "Logic is table stakes. Time is the profession." and the one
   thing.
10. *Commute exercise* — two registers wired back to back, a question mark, no
    answer.

Style: Manim CE, 1080p30, dark background, one accent per concept (setup blue,
hold amber, violation red), plain text (no LaTeX dependency). Low-quality preview
render first, final render second. Soft subtitles from `timeline.json`.

## Error handling

- TTS clip cache makes every run resumable; a failure affects only the failed
  segment, which is reported by id.
- Duration sanity check: each clip's length is compared with its word count at
  145 wpm; outside ±40% is flagged (catches truncated or garbled output).
- Missing or unknown `> visual:` scene names fail the video build with the
  offending line number.
- Higgsfield spend is capped by explicit approval gates, never by a default.

## Testing

- **Round-trip:** concatenated segment texts equal `narrate.py`'s output for every
  episode, exactly — proves segmentation never drops or alters spoken words.
- **Timeline:** sum of clip durations plus pauses equals the assembled MP3's
  length, within one frame.
- **Scenes:** each scene's duration equals the sum of its paragraphs' durations.
- Unit tests for cue attachment and beat tracking on small fixture scripts.

## Decision gate after the pilot

The user watches the ep03 video and chooses one of:

- explainer video for all episodes;
- explainer video for the visually heavy episodes only (roughly 15–20);
- still slides (same components rendered as stills) for all;
- audio only.

Recorded to inform it: hours spent building ep03, and the fraction of that code
that is reusable components rather than episode-specific.

## Out of scope

- Publishing (YouTube upload, RSS feed hosting) — decided after the gate.
- Seasons 7–8 scripts — the pipeline runs on them unchanged once written.
- Music, sound design, or a presenter on screen.
