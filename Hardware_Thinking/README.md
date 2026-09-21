# Thinking in Hardware — a listening series

An audio-first course in how hardware engineers think. Written to be *heard*,
not read: no diagrams, no code listings, no tables in the scripts. Everything
that matters is spoken in a way you can follow with your eyes on the road.

Built for a two-to-three hour daily commute and for a sequential thinker — each
episode assumes the one before it, builds one idea at a time, and ends by
naming exactly what the next episode needs from you.

---

## How this is structured

Eight seasons are planned, taking you from "thinks in software" to front-end
VLSI mastery. **`ROADMAP.md` has the full plan** — every season, every episode,
the lab project that goes with each, and an honest account of what listening can
and cannot do for you.

**Season 1 — The Mental Model** is written and is below. Seasons 2 through 8 are
planned and not yet written.

**Season 1 — The Mental Model.** Twelve episodes, a bit over ten minutes each,
about two and a half hours in total. That is one commuting day if you listen
one way and think the other, or one long day if you binge.

Every episode has the same five beats, always in this order:

1. **Where we are.** Sixty seconds recapping the previous episode, because you
   heard it yesterday in traffic and you were also changing lanes.
2. **The problem.** A concrete situation that does not work yet.
3. **The turn.** The single idea that makes it work.
4. **The cost.** What that idea takes away from you. Every hardware idea takes
   something away.
5. **The one thing.** A single sentence to carry. If you remember nothing else,
   remember the one thing.

Then a **commute exercise** — a question to chew on during the return leg. No
paper needed. All of them are answerable in your head.

## Season 1 map

| # | Episode | The one idea |
|---|---|---|
| 00 | How to listen to this | You are unlearning sequence, then rebuilding it |
| 01 | Everything happens at once | Hardware is space, not steps |
| 02 | The clock | Time is discrete and everyone agrees on it |
| 03 | Setup and hold | The real job is arriving on time, not being correct |
| 04 | State machines | Sequence, rebuilt on purpose |
| 05 | Pipelining | Buy throughput with latency |
| 06 | Memory | The budget picks your architecture, not you |
| 07 | Two clocks | Metastability, and why synchronisers are humility |
| 08 | Valid and ready | Backpressure as a way of thinking |
| 09 | How you know it works | Verification is a claim, not a test |
| 10 | Bring-up | The ladder of doubt |
| 11 | Constraints are the design | Why sequential thinking wins here |

## Listening order

Strictly zero through eleven. This is not a magazine. Episode five will not make
sense without episode three, and episode three is a ninety-second idea stretched
over eighteen minutes on purpose, because that idea is where most people's model
quietly breaks.

If you have to skip, skip 00. Never skip 02 or 03.

## The files

```
Hardware_Thinking/
├─ README.md                  this file
├─ ROADMAP.md                 the eight-season plan to front-end VLSI mastery
├─ episodes/                  one markdown script per episode (Season 1)
└─ tools/
   ├─ narrate.py              strips a script down to spoken words only
   └─ AUDIO.md                how to turn the scripts into audio files
```

Each script is a plain markdown file. The spoken text is the prose. Lines
beginning with `>` are production notes and are **not** read aloud. Headings are
beat markers and are **not** read aloud. `tools/narrate.py` does that stripping
for you and prints clean narration text ready for any text-to-speech engine.

## A note on numbers

Numbers are written the way they are said, not the way they are typed. You will
read "one hundred and twenty-five megahertz" rather than "125 MHz" throughout
the scripts. That looks strange on the page and sounds correct in your ears,
which is the trade this series makes everywhere.
