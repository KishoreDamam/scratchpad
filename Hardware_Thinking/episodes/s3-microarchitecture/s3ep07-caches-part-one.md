---
season: 3
episode: 7
title: Caches, part one
runtime: about 13 minutes
prerequisites: s1ep06, s3ep03
one_thing: A cache is a bet on reuse. Ask whether your workload has any before you build one — and if it does not, what you want is a prefetch buffer, not a cache.
---

> Production note: the average-access-time arithmetic must be done out loud with real
> numbers. The asymmetry between hit time and miss rate is the thing listeners take away.

## Where we are

Yesterday's exercise had two traps.

The DMA engine copying memory to memory reads *and* writes the same slave. So a
fifty-megabyte-per-second copy consumes a hundred megabytes per second of memory
bandwidth. Every memory-to-memory transfer costs double what the specification says it
does, and this is one of the most reliably forgotten facts in bandwidth budgeting.

And the structural fix for the display block's deadline: give it a deep buffer and let it
run far ahead. Not arbitration — *storage*. The display block prefetches tens of
microseconds of pixels into an on-chip FIFO, and now it can survive a long memory stall
without the screen tearing, because it is consuming from a local buffer rather than from
the memory controller directly.

That is episode three's latency hiding used as a quality-of-service mechanism, and the
shape of the move is worth naming: **you spent on-chip storage, which you have, to protect
against memory latency, which you do not control.** Trading an abundant resource for
insulation against an unpredictable one is a recurring architectural move, and it is
usually cheaper than trying to make the unpredictable thing behave.

Today: the most famous structure in computer architecture, and the question you should ask
before building one.

## The problem

Season 1 episode six gave you the memory tiers, and the gap between tiers two and three is
brutal. On-chip memory: about a cycle of latency. Off-chip memory: tens of nanoseconds,
which is dozens of cycles.

Episode three gave you one way to live with that: hide it. Have many requests in flight.
That works beautifully — for *streaming*. When you are walking through data in order, you
can always run ahead, so you can always keep the pipe full.

Now take that away. Suppose the access pattern is not predictable. A processor executing
code; a graph traversal following pointers; a lookup table indexed by incoming data. You
do not know the next address until you have the current answer.

Latency hiding is unavailable, because you cannot prefetch what you cannot predict. And
there is no clever structure that makes an unpredictable dependent chain of memory accesses
fast. Each one costs the full round trip, and the whole design runs at one access per
latency.

So this is a genuinely different problem, and it needs a different answer.

## The turn

A cache is a small fast memory holding copies of things from the large slow one, in the
hope that you will want them again.

And I want to dwell on the word hope, because the standard presentation of caches buries
the most important thing about them: **a cache does not make memory faster. It is a bet,
and the bet can lose.**

The bet is on locality, and locality comes in two flavours, both of which have to be
stated as properties of your *workload*, not of your hardware.

**Temporal locality:** if you touched an address, you are likely to touch it again soon.
Loop code does this. A frequently-read coefficient table does this. A streaming video
pipeline touching each pixel exactly once does not.

**Spatial locality:** if you touched an address, you are likely to touch its neighbours.
Almost everything sequential does this. Pointer-chasing does not.

If your workload has neither, a cache is not merely useless — it is *worse* than useless,
because you paid area for the tags and the comparators and the control, and you added
latency to the hit path, in exchange for nothing at all.

So the question to ask before you build a cache, and the reason this episode exists:

**Is there reuse?**

If yes, a cache. If no, what you want is a FIFO and a prefetcher, which is a fraction of
the area and completely deterministic. I have seen real designs carry a cache because a
cache is what one puts in front of memory, when the access pattern was a pure stream and a
sixteen-entry prefetch buffer would have outperformed it. That is the single most useful
thing in this episode.

## The structure, briefly

Assume you have reuse. Now the mechanics, and the two design decisions that matter.

A cache does not store individual words. It stores **lines** — blocks of consecutive
addresses, typically thirty-two or sixty-four bytes. On a miss it fetches the whole line.

That is episode three's block-transfer bet, and the reasoning is identical. Fetching a
line exploits spatial locality, and — importantly — it amortises the fixed cost of a memory
access across many words, because Season 1 episode six told you DRAM is fast for runs and
slow for hops. The line size *is* the spatial-locality bet, quantified. Big lines win on
sequential access and waste bandwidth on scattered access.

An address gets split into three parts. The low bits say where in the line you are — the
offset. The middle bits say which slot of the cache to look in — the index. The remaining
high bits are the **tag**, which you store alongside the data, because many different
addresses map to the same slot and you must be able to tell which one you are holding.

And now the second decision: how many slots can a given address live in?

**Direct-mapped.** One. Each address has exactly one slot. Lookup is trivial — index,
read, compare one tag. Fast, small, and it has a specific failure mode worth knowing:
**conflict misses.** Two hot addresses that happen to share an index evict each other
repeatedly. Your ninety-five percent hit rate becomes near zero for that loop, not because
the cache is too small but because of an accident of address arithmetic. It is
data-dependent and it can be catastrophic.

**Set-associative.** Some small number of slots per index — two, four, eight — called
ways. Check all the ways in parallel, so you need that many comparators. Two hot addresses
sharing an index now coexist. This is what nearly everything real uses, and the
associativity is a straightforward area-for-hit-rate trade with sharply diminishing
returns past about four or eight.

**Fully associative.** A line can live anywhere, so you compare against every tag at once.
Best hit rate, and the cost is a wide parallel comparison — which is Season 2 episode seven's
one-hot structure, at scale. Area grows with capacity, so this is only viable for small
structures. Where you will meet it: address translation buffers, small lookup caches,
victim buffers of a few entries.

And associativity forces a new decision: when all the ways are full, which one do you
evict? True least-recently-used needs an ordering maintained per set, which gets expensive
past a few ways, so real designs use approximations — a tree of one-bit hints, or a single
bit per way, or genuinely just random. Random replacement performs surprisingly well and
costs almost nothing, which is a good reminder that the theoretically best policy is often
not worth its silicon.

## The arithmetic that matters

Now the number that should shape your intuition. Say it with me:

**Average access time equals hit time plus miss rate times miss penalty.**

Put real values in. Hit time one cycle. Miss penalty a hundred cycles. Hit rate ninety-five
percent, so miss rate five percent.

One plus nought point nought five times a hundred. One plus five. **Six cycles average.**

Sit with that. A ninety-five percent hit rate — which sounds excellent, which sounds like an
A grade — gives you an average access time six times worse than a hit. Five percent of your
accesses contribute five-sixths of your total time.

Now drop the hit rate to ninety percent. One plus ten, so eleven cycles. **A five-point
change in hit rate nearly doubled your memory time.**

And now improve the hit time instead — make hits free, zero cycles. You go from six to
five. Seventeen percent.

That asymmetry is the whole intuition: **miss rate dominates, overwhelmingly.** Effort
spent shaving the hit path is almost always worth less than effort spent on the miss rate,
and effort spent on the miss *penalty* — episode three's latency hiding, so that a miss
does not stall everything behind it — is worth more still.

It also tells you how to read a performance claim. "Our cache hits in one cycle" is
marketing. "Our miss rate on the target workload is two percent" is engineering, and it is
a statement about the workload as much as the hardware.

## The cost

Three costs, and the third is the one that eliminates caches from whole categories of
design.

**Area for tags and comparators.** A sixty-four-byte line with a twenty-bit tag is about
four percent overhead in storage, plus the comparators and the replacement state. Modest,
but not zero, and for small caches the overhead fraction gets ugly.

**Coherence, if anybody else can touch the same memory.** Which is tomorrow, and it is a
much larger cost than people expect.

**And non-determinism.** This is the big one. With a cache, an access takes one cycle or a
hundred, and which one depends on history. Your design's timing is now *data-dependent*.

For a processor running general software, that is fine — the average is what matters.

For anything with a hard deadline, it is disqualifying. A control loop that must respond
within a fixed number of microseconds cannot be built on a structure whose latency depends
on what happened earlier. This is why real-time and safety-critical systems often run with
caches disabled or locked, and why hardware designers in those domains reach for a
deterministic local memory — explicitly loaded, explicitly sized — rather than a cache.

That structure, a small fast memory you manage yourself instead of one that guesses, has a
real advantage beyond determinism: **you know your access pattern and the cache does not.**
A cache is a general-purpose guess. If your block has a known, structured access pattern —
and in a streaming design it almost always does — you can beat any cache with a fraction of
the area by loading exactly what you need, exactly when you need it. That is what a line
buffer is. That is what episode four's ping-pong buffer is.

So the honest position: **caches are for when you genuinely cannot predict.** When you can
predict, prediction is cheaper, faster, and deterministic, and knowing which situation you
are in is the judgement this episode is trying to install.

## The one thing

A cache is a bet on reuse. Miss rate dominates the average, so the line size and the
associativity are bets about your workload's locality. And if you can predict your access
pattern, a buffer you manage yourself beats a cache at a fraction of the area.

## Commute exercise

Two workloads, same hardware.

Workload one: a video filter reading each pixel of a frame exactly once, in order, and
never returning to it.

Workload two: a lookup table of four kilobytes, indexed by incoming packet data in an
unpredictable order, read once per packet.

On the way home, for each one: does a cache help? Be specific about which kind of locality
is present, if any.

Then, for whichever workload the cache does not suit, design what you would build instead,
and estimate its size.

Then the good question. Workload two's table is four kilobytes. Your on-chip memory budget
is sixty-four kilobytes. Work out what the right answer is — and notice that once you have
seen it, the whole framing of "should we cache this" turns out to have been the wrong
question.

That reframing — from "how do I make the far thing faster" to "why is the thing far away at
all" — is worth more than the rest of the episode.
