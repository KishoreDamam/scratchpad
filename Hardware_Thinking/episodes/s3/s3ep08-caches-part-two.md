---
season: 3
episode: 8
title: Caches, part two
runtime: about 14 minutes
prerequisites: s3ep07
one_thing: Coherence is a distributed agreement protocol in hardware, and its real cost is not area or latency — it is the size of the state space you then have to verify.
---

> Production note: the "do not build coherence unless you must" section is the practical
> payload. The protocol material exists to make that recommendation credible.

## Where we are

Yesterday's exercise. The video filter reading each pixel once has spatial locality and no
temporal locality at all — so a cache's central bet loses, and what you want is a prefetch
buffer or a line buffer.

And workload two, the four-kilobyte lookup table against a sixty-four-kilobyte on-chip
budget: **put the table on-chip.** All of it. Permanently. Then there are no misses, no
tags, no comparators, no variability, and the average access time is one cycle with no
arithmetic required.

Which is why I said the framing was wrong. The question was "should we cache this", and the
answer was "why is it far away at all". If the working set fits in fast memory, the entire
caching apparatus dissolves — and a surprising number of real designs carry a cache in front
of a table that would simply fit.

So the order of questions is: does it fit, then is there reuse, then build a cache. Most
designs skip the first two.

Today: what happens when you write to a cache, and what happens when there are two of them.

## The problem, part one: writes

Everything yesterday was about reading. Writing introduces a question with no free answer:
when a write hits the cache, does the memory find out?

**Write-through** says yes, immediately. Every write goes to the cache and to memory.

Simple, and it has a real virtue: memory is always correct, so anybody else looking at
memory sees the truth, and if power is lost you have not lost data that was only in a cache.

The cost is bandwidth. Every single write goes off-chip, so you have gained nothing on the
write path — and Season 1 episode six reminds you that off-chip bandwidth is the scarcest
thing you own. A workload that writes the same location repeatedly pays for every one of
those writes.

**Write-back** says no, not yet. The write updates the cache and sets a **dirty** bit. The
line goes to memory only when it is evicted.

Now repeated writes to one location cost one memory write instead of many, which is a large
saving on real workloads. And you have introduced two complications that matter.

First, **eviction is now a two-step operation.** On a miss you may have to write the old
line out before you can read the new one in. That doubles the worst-case miss penalty — and
episode seven's arithmetic says the miss penalty is what dominates. So real designs put a
**writeback buffer** in the way: the dirty line is dumped into a small queue and the
incoming read proceeds immediately, with the queue draining in the background. That buffer
is now a place where a copy of your data lives, which means anything checking memory has to
check the buffer too, and you have just created a small coherence problem inside a single
cache.

Second, **memory is now routinely wrong**, and that is fine only as long as nobody else
looks at it. Which is the whole of part two.

One more decision, briefly, because it matters for streaming: on a write that *misses*, do
you fetch the line into the cache first — write-allocate — or send the write straight to
memory and leave the cache alone?

Fetching makes sense if you expect to write the rest of that line, or read it back soon.
But consider a block that writes a large buffer once and never reads it: allocating on write
fetches lines from memory purely to overwrite them, wasting exactly the bandwidth you were
trying to save, and evicting useful data on the way. For write-only streaming, not
allocating is obviously correct — and this is a real, common, easily-missed misconfiguration
in systems where a DMA engine shares a cache with a processor.

## The problem, part two: two caches

Now the hard part.

Two masters, each with a cache, both over the same memory. A processor and an accelerator,
say. Or two processors.

Master A reads address one thousand. It gets a copy, in its cache.

Master B reads address one thousand. It gets a copy too. Two copies, both correct.

Master B writes to it. Its copy is now updated.

And master A's copy is **stale**. Not flagged, not invalid, not detectably wrong — just
quietly out of date. A reads it again, gets the old value, and behaves correctly according to
information that is no longer true.

That is the coherence problem, and I want to be precise about why it is a different species
of difficulty from everything else in this season.

It is **silent**. No error, no exception, nothing to assert on locally — each cache is
behaving exactly as designed.

It is **data-dependent and timing-dependent**. Whether it manifests depends on the exact
interleaving of two independent masters, which means it is rare, unreproducible, and
different every run.

And it produces **wrong answers, not slow ones**. Everything else in this season degrades
performance. This corrupts.

## The turn

The hardware answer is a protocol: the caches talk to each other and maintain an invariant.
The invariant is roughly — at most one cache may hold a writable copy of a line, and if one
does, nobody else may hold any copy at all.

Two ways to implement it.

**Snooping.** Every cache watches every transaction on the shared bus. When A sees B
requesting write permission for a line A holds, A invalidates its copy. Simple, no central
bookkeeping, and it relies on every cache seeing every transaction — which means it needs a
broadcast medium, which stops scaling once you have more than a handful of participants.

**A directory.** A central structure records, per line, who holds a copy and in what state.
A master wanting to write asks the directory, the directory tells the specific holders to
invalidate, and waits for their acknowledgements. Scales to many masters because nothing is
broadcast. Costs storage proportional to the memory being tracked, and adds latency, because
every permission change is now a round trip to a third party.

And the states. You will hear four letters, and they are worth being able to say in plain
words:

**Modified** — I have the only copy, I have changed it, and memory is out of date. I am
responsible for it.

**Shared** — I have a copy, it matches memory, and others may have copies too. I may read
but not write.

**Invalid** — I do not have it.

**Exclusive** — I have the only copy, and it matches memory. I have not changed it yet.

That fourth one looks redundant and it is the clever part. Without it, a master that reads a
line and then writes it must announce the write to everybody, in case somebody else has a
copy. With it, a master that knows it is the sole holder can write **silently** — straight
from exclusive to modified, no transaction, no broadcast. Since read-then-write is an
extremely common pattern, that one extra state removes a large fraction of all coherence
traffic. It is a good example of how much a well-chosen state can buy.

## The cost, which is verification

Here is the thing to take away.

The area is real but modest. The latency is real but manageable. **The dominant cost of
coherence is that you have built a distributed agreement protocol in silicon, and its state
space is the product of every participant's state.**

Four masters, four states each, times the lines, times the transactions in flight, times the
orderings of those transactions, times the partially-completed permission changes, times the
writeback buffers still holding old copies. The reachable state space is astronomical, and
the bugs live in the corners: two masters requesting the same line in the same cycle; an
invalidate arriving while a writeback for the same line is in the queue; a permission
response overtaking a data response.

You cannot enumerate that with simulation, and constrained-random will explore a vanishing
fraction of it. This is the canonical home of **formal verification** — proving that the
invariant holds in all reachable states rather than sampling — and it is the clearest
example in this season of a problem where simulation is structurally the wrong instrument.
Season 4 episode eight is that story, and coherence is why it matters.

There is also a second cost people underestimate: coherence makes *performance* opaque. A
read that hits in your own cache is one cycle; the same read, after another master touched
that line, is a full round trip plus a permission exchange. The two are indistinguishable in
your RTL. Which means performance now depends on other masters' behaviour, and a performance
regression can be caused by a change in software running on a different block.

## So do not build it unless you must

Which brings me to the practical recommendation, and it is the point of the episode.

**Hardware coherence is one of the most expensive things a front-end team can take on, and
most designs do not need it.** The alternatives, roughly in order of how often they are the
right answer:

**Do not cache shared data.** Mark the shared buffers non-cacheable. The processor's own
private working data stays cached and fast; the region used to communicate with an
accelerator is accessed directly. You have eliminated the problem by construction, and the
cost is that accesses to that region are slow — which is usually irrelevant, because shared
buffers are typically written once and read once by the other party.

**Software-managed coherence.** Let software flush and invalidate explicitly. Before the
accelerator reads a buffer, software flushes the processor's dirty lines; after the
accelerator writes, software invalidates. This works, it is used widely in real products,
and the hardware cost is a couple of maintenance operations rather than a protocol.

Its cost is real and should be stated honestly: it moves the burden to a contract with
software, and a missed flush is exactly the same silent corruption we started with. So it
needs documenting properly and it needs the discipline to hold across teams — which is why
the boundary of who is responsible belongs in the architecture document, episode twelve.

**Single-owner discipline.** Design the system so that only one master ever touches a given
buffer at a time, with ownership handed over explicitly. That is episode four's ping-pong,
applied at system scale, and it makes the coherence question disappear because there are
never two live copies.

**And if you genuinely have multiple general-purpose processors sharing memory, you need
real coherence** — and at that point, use somebody's proven implementation. This is not a
place to be original. The gap between a coherence protocol that passes your tests and one
that is correct is measured in years of other people's debugging.

One last distinction, because people conflate them and it causes arguments. **Coherence** is
about a single location: everybody eventually agrees on the value at address one thousand.
**Memory ordering** — consistency — is about *several* locations: if I write A and then B,
can somebody else see B before A? Those are different problems with different solutions, and
a system can be perfectly coherent and still surprise software because its ordering rules are
weaker than expected. Ordering is a contract with software, it lives in the architecture
document, and it is the thing barriers and fences exist to control.

## The one thing

Write-back saves bandwidth and makes memory routinely wrong, which is fine until somebody
else looks. Coherence fixes that with a distributed protocol whose real cost is a state space
too large to simulate. So avoid it: make shared data non-cacheable, manage it in software, or
hand ownership over explicitly.

## Commute exercise

A system with one processor that has a write-back cache, and one accelerator with no cache
at all that reads and writes memory directly.

On the way home, walk through the two failure directions, separately, out loud.

First: the processor prepares a buffer and tells the accelerator to process it. What goes
wrong, and which cache-maintenance operation fixes it?

Second: the accelerator writes a result and tells the processor to read it. What goes wrong
here, and which operation fixes this one? It is not the same operation, and knowing which is
which is the useful part.

Then the design question: you have a choice between requiring software to perform both of
those operations correctly every time, or making that buffer region non-cacheable in
hardware. For each option, say what it costs and — more importantly — what happens on the day
somebody forgets.

And then the question that decides it in real projects: which of those two failures is easier
to *debug* in the field, six months after tapeout, from a bug report that says "occasionally
the output is wrong"?
