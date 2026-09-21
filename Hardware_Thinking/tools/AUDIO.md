# Turning the scripts into audio

The scripts are the deliverable; audio is a render of them. **No audio files
have been generated yet** — this file is how to do it when you want it.

## Step 1 — get clean narration text

`narrate.py` strips the front matter, the production notes (`>` lines) and the
beat markers (headings), leaving only spoken prose.

```sh
cd Hardware_Thinking
python3 tools/narrate.py --out-dir /tmp/narration episodes/*.md
python3 tools/narrate.py --stats episodes/*.md    # word counts and runtimes
```

The `--stats` runtime estimate assumes 145 words per minute, which is unhurried
narration. A faster reader will come in under it.

## Step 2 — pick an engine

**Higgsfield (available in this session).** There is a `generate_audio` tool
wired into this environment, plus `list_voices` and `create_voice`. This is the
lowest-friction path from here: pick a voice, feed it an episode's narration
text, get a file back. It spends account credits, so it is opt-in — ask for it
and I will run a single episode first as a pilot before committing the season.

**Local, free, no network.** `piper` is the best open text-to-speech for this
kind of long-form listening and runs comfortably on a laptop CPU:

```sh
pip install piper-tts
piper -m en_GB-alba-medium -f ep02.wav < /tmp/narration/ep02-the-clock.txt
```

**macOS, already installed.**

```sh
say -v Daniel -o ep02.aiff -f /tmp/narration/ep02-the-clock.txt
```

**Cloud.** ElevenLabs, Google Cloud TTS, Amazon Polly. All fine. Twenty thousand
words for the whole season is a small job for any of them.

## Step 3 — make it listenable in the car

Convert to MP3 and tag it so the episodes show up in order in whatever app you
use:

```sh
ffmpeg -i ep02.wav -codec:a libmp3lame -b:a 64k ep02.mp3
ffmpeg -i ep02.wav -metadata title="02 — The clock" \
       -metadata album="Thinking in Hardware" -metadata track="3/12" \
       -codec:a libmp3lame -b:a 64k ep02.mp3
```

Sixty-four kilobits mono is plenty for speech and keeps the whole season around
seventy megabytes.

For a real podcast app rather than a folder of files, generate an RSS feed
pointing at the MP3s and host it anywhere private. Most apps will accept an
arbitrary feed URL.

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
