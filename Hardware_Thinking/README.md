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

**Seasons 1 to 4 are written** and mapped below. Seasons 5 through 8 are
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

## Season 2 map — RTL That Synthesises

The gap between RTL that simulates correctly and RTL that becomes good silicon.
Twelve episodes, about eleven to thirteen minutes each, ~2.3 hours.

| # | Episode | The one idea |
|---|---|---|
| 01 | Blocking and non-blocking | One rule, applied mechanically, kills a whole class of sim/silicon mismatch |
| 02 | The latch you did not ask for | Incompleteness is a request for memory |
| 03 | Reset architecture | Assert asynchronously, release synchronously |
| 04 | What the tool actually builds | Synthesis optimises within your structure, never across it |
| 05 | Adders and the carry chain | A comparison is a subtraction; a counter is both, in a loop |
| 06 | Multipliers and hard blocks | Land in the hard block; never write a divider |
| 07 | Muxes, priority and one-hot | An else-if chain is a chain and a case is a tree |
| 08 | FIFOs done properly | Equal pointers mean full *and* empty; stop on almost-full |
| 09 | Arbiters | Where you decide who suffers — verify the tail, not the mean |
| 10 | Parameterisation | Every parameter multiplies the space you must verify |
| 11 | Lint | A width mismatch is invisible until the value gets big |
| 12 | Reviewing RTL | Review in order of what is expensive to fix later |

Season 2 ends with a lab project — a parameterised FIFO and a round-robin
arbiter, both lint-clean and self-checking. Everything in Seasons 3 to 8 uses
them.

## Season 3 map — Microarchitecture

Deciding *what* to build, before any RTL exists. Twelve episodes, about twelve to
fourteen minutes each, ~2.6 hours.

| # | Episode | The one idea |
|---|---|---|
| 01 | Spec to block diagram | Cut where the rate changes or the working set changes |
| 02 | Cycle accounting | Clock rate over item rate sets the area-time dial for you |
| 03 | Buffering and latency hiding | Cover the wait; it costs bandwidth × delay in storage |
| 04 | Double buffering | Block-granularity dependency wants two buffers and a handshake |
| 05 | Credit-based flow control | Round-trip delay becomes throughput, not correctness |
| 06 | Interconnect topology | Write the traffic matrix; most cells are empty |
| 07 | Caches, part one | A cache is a bet on reuse — if you can predict, don't cache |
| 08 | Caches, part two | Coherence's real cost is the state space you must verify |
| 09 | Hazards and forwarding | Interleave until the dependency distance exceeds the depth |
| 10 | Partitioning and hierarchy | A boundary is timing, verification, ownership and physical at once |
| 11 | Modelling before RTL | Two models: bit-accurate without timing, timed without bit accuracy |
| 12 | The architecture document | Pin down what is expensive to change; leave the rest open |

Season 3's lab project is one streaming block built in the right order —
document, then functional model, then performance model, then RTL.

## Season 4 map — Verification for Designers

Proving that what you built is what you decided, in the languages and frameworks
the industry uses. Twelve episodes, about eleven to thirteen minutes each, ~2.3
hours.

| # | Episode | The one idea |
|---|---|---|
| 01 | SystemVerilog for verification | The testbench is software; at the boundary, drive after the edge and sample before it |
| 02 | Constrained random, properly | You are programming a solver; the default distribution avoids the boundaries |
| 03 | Functional coverage | Code coverage cannot see a feature that was never built |
| 04 | Assertions | Pair every implication with a cover on its trigger, or it may be vacuous |
| 05 | Scoreboards and transactions | Compare meanings, not signals; a scoreboard that saw nothing will pass |
| 06 | UVM, part one | Built for reuse: the same agent drives at block level and watches at chip level |
| 07 | UVM, part two | Ends at time zero, or never ends — both are objection bugs |
| 08 | Formal verification | A proof is exactly as honest as its assumptions; reachable covers check them |
| 09 | Regression and closure | Red must always mean something; three hundred failures are three bugs |
| 10 | Debugging someone else's failure | The failure is where the bug was noticed, not where it happened |
| 11 | The verification plan | Feature, method, measurement, priority — and the stopping rule fixed in advance |
| 12 | Risk-based stopping | You never finish; you decide where to stop, and say so in writing |

Season 4's lab project verifies the Season 3 block properly and ends with a
one-page statement of what was verified, what was not, and why that is
acceptable.

## Listening order

Strictly in order, within and across seasons. This is not a magazine. Season 1
episode five will not make sense without episode three, and Season 2 leans on
Season 1 constantly — episode 2.05 is built on 1.03 and 1.05, and 2.08 is built
on 1.06 and 1.08.

If you have to skip, skip Season 1 episode 00. Never skip 1.02 or 1.03.

Season 2 is the one to re-listen to while writing code. Season 1 is a model you
absorb once; Season 2 is a set of habits, and habits need repetition. Season 3 is
the one to re-listen to at the *start* of a project, when the decisions it covers
are still cheap. Season 4 is the one to re-listen to at the *end*, when somebody
asks whether you are done.

## The files

```
Hardware_Thinking/
├─ README.md                  this file
├─ ROADMAP.md                 the eight-season plan to front-end VLSI mastery
├─ episodes/
│  ├─ s1/                     Season 1 — The Mental Model
│  ├─ s2/                     Season 2 — RTL That Synthesises
│  ├─ s3/                     Season 3 — Microarchitecture
│  └─ s4/                     Season 4 — Verification for Designers
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
