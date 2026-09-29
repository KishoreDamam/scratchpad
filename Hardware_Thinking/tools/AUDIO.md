# Turning the scripts into audio and video

The scripts are the deliverable; audio and video are renders of them. The
pipeline lives in `tools/media/` and is described in
`docs/superpowers/specs/2026-09-29-audio-video-pipeline-design.md` at the repo
root. Generated media goes to `build/` (gitignored) and can always be re-made.

## Setup, once

```sh
cd Hardware_Thinking
python -m venv .venv
.venv/Scripts/python -m pip install -r tools/media/requirements.txt   # bin/ on macOS/Linux
```

That brings Manim, Piper and a bundled ffmpeg; nothing is installed system-wide.

## Audio, whole series or one season

```sh
.venv/Scripts/python tools/media/build_audio.py                          # all episodes
.venv/Scripts/python tools/media/build_audio.py episodes/s1-*/*.md       # one season
```

MP3s land in `build/audio/<season folder>/`. The chosen voice (2026-09-29) is
Piper `en_GB-northern_english_male-medium` at pace 1.45, about 160 words per
minute, picked by ear over `en_GB-alba-medium` and `en_US-ryan-high`. Season 1
renders to about 2 h 8 min. Keep `-j` modest: each job runs many CPU threads.

Known limitation: Piper rushes some short one-sentence paragraphs (the rate
check flags them; re-rendering does not change the result, since Piper is
deterministic for a given text).

## Audio, per episode

```sh
PY=.venv/Scripts/python
EP=episodes/s1-mental-model/ep03-setup-and-hold.md
$PY tools/media/segment.py  $EP -o build/s1ep03/segments.json
$PY tools/media/tts.py render build/s1ep03/segments.json --engine piper --voice en_GB-northern_english_male-medium --pace 1.45
$PY tools/media/assemble.py build/s1ep03/segments.json "build/s1ep03/piper-en_GB-northern_english_male-medium@1.45/clips.json"
```

- **segment.py** splits the script into spoken paragraphs, the unit of sync.
- **tts.py** renders one clip per paragraph, cached by content, so reruns only
  render edited paragraphs. It flags clips whose speaking rate is far from the
  voice's median — the signature of truncated or garbled output.
- **assemble.py** joins the clips (0.4 s between paragraphs, 1.2 s between
  beats) into a tagged 64 kbps mono MP3, plus `timeline.json` and an `.srt`.

`--pace` is Piper's length scale. The Piper voices speak at 190–210 words per
minute natively, far too fast for this material; 1.3–1.45 brings them to about
160.

**External engines** (e.g. Higgsfield, driven from a Claude session): use
`tts.py pending` to list paragraphs without a clip and `tts.py import` to bring
each rendered file in. Pilot cost on 2026-09-29: 1.3 credits for a 36-word
paragraph, so roughly 3,700–4,700 credits for Seasons 1–6.

**Comparing voices:** `tools/media/compare.py build/s1ep03 --from 28 --to 29`
cuts the same passage from every rendered voice and writes a page with players.

## Video, per episode

Explainer videos are Manim scenes keyed to `> visual: <scene>` cue lines in the
script (production notes, so never spoken). Each scene's length comes from the
narration timeline, so a new voice or pace re-times the video with no edits.

```sh
$PY -m manim -ql tools/media/video/s1ep03.py SetupAndHold --media_dir build/s1ep03/video   # preview
$PY -m manim -qh --frame_rate 30 tools/media/video/s1ep03.py SetupAndHold --media_dir build/s1ep03/video   # 1080p30
cd tools/media && ../../$PY mux.py ../../build/s1ep03/video/videos/s1ep03/1080p30/SetupAndHold.mp4     "../../build/s1ep03/piper-en_GB-northern_english_male-medium@1.45"
```

Set `TIH_TIMELINE=<path to timeline.json>` to render against a different voice.
Reusable drawing pieces (clock wave, register, shaded windows, sliders, cards)
are in `tools/media/visuals/components.py`.

## Tests

```sh
$PY -m pytest tools/media/tests
```

The round-trip test proves that segmentation reproduces `narrate.py`'s spoken
text exactly, for every episode.

## Listening in the car

For a podcast app rather than a folder of files, generate an RSS feed pointing
at the MP3s and host it anywhere private. Most apps accept an arbitrary feed URL.

## Notes on how the scripts were written for speech

Worth knowing before you edit them.

- **Numbers are spelled out as spoken** — "one hundred and twenty-five
  megahertz", never "125 MHz". Text-to-speech engines mangle unit abbreviations
  and read "1500" as "one thousand five hundred" where "fifteen hundred" was
  wanted. Keep this convention if you add episodes.
- **No tables, no code blocks, no bullet lists** inside the spoken body. Lists
  are read aloud as sentences ("Three costs, and the third one is a rule").
- **Em dashes are used as breath marks.** Most engines pause on them correctly.
- **Sentences are short.** Where a sentence had to be long, it is broken with a
  dash or a full stop rather than a comma, because commas get under-weighted and
  the result sounds breathless.
- Each episode repeats the previous episode's conclusion in its first minute, on
  purpose. It reads as redundant on the page and is exactly right in a car.
