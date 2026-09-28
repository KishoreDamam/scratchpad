---
season: 3
episode: 4
title: Double buffering and ping-pong
runtime: about 12 minutes
prerequisites: s1ep06, s1ep08, s3ep03
one_thing: When the unit of dependency is a block rather than an item, two buffers and an ownership handshake convert a serial dependency into an overlapped one, for twice the storage and one block of latency.
---

> Production note: the decision rule — item granularity means FIFO, block granularity
> means ping-pong — is the practical takeaway. Say it twice.

## Where we are

Yesterday's arithmetic. Eighty cycles of latency, one word per cycle, so eighty
requests outstanding and three hundred and twenty bytes of return buffering. Limited to
sixteen outstanding requests, you get sixteen eightieths — twenty percent of the rate
you wanted.

Then the fix: make each request bigger. Eight words per request, sixteen requests, is a
hundred and twenty-eight words in flight, which comfortably covers the eighty you
needed. Full rate, with the same number of outstanding transactions.

And the cost, which is the interesting half. If you only wanted one of those eight
words, you fetched eight and used one. Your *useful* bandwidth is one-eighth of your
actual bandwidth, so for scattered access you have made things worse — seven-eighths of
the traffic is waste.

Which means a block transfer is a **bet on spatial locality**: a bet that if you wanted
this word, you will want its neighbours. Sequential access wins enormously. Random
access loses badly. And that is why every memory system on earth moves data in blocks,
why the block size is one of the most consequential numbers in a system, and — as
episode seven will show — why a cache line is the size it is.

Today, the same bet at a larger granularity.

## The problem

Some stages cannot start until the previous stage has *completely finished* a chunk of
work.

Examples, all common. A stage that transposes a block — you cannot emit the first
column until you have received the last row. A stage that computes a checksum over a
packet and must put it in the header at the front. A compression stage that needs to
see the whole block before deciding how to encode it. A filter running vertically down
an image, when the data arrives horizontally. A stage that needs to know the *length* of
something before it can emit it.

So the dependency is not item-to-item, it is **block-to-block**. And that changes the
shape of the problem entirely.

Try the naive structure: one buffer between the two stages. The producer fills it. Then
the consumer drains it. Then the producer fills it again.

Count the throughput. If filling takes a thousand cycles and draining takes a thousand
cycles, a block takes two thousand cycles and each stage is idle exactly half the time.
You have built something that runs at fifty percent of its capability, and both
expensive pieces of hardware you paid for are asleep half the time.

And you cannot fix it with the tools from the last two episodes. A FIFO does not help:
the consumer genuinely cannot start on partial data, so there is nothing for the FIFO
to be busy with. More requests in flight does not help: the dependency is real, not
latency. Pipelining does not help at item granularity, because the items are not
independent — Season 1 episode five's condition fails.

## The turn

Build two buffers.

The producer fills buffer A. Then they swap: the producer starts filling buffer B while
the consumer drains buffer A. When both are finished, they swap again — producer back to
A, consumer to B.

Now both stages run continuously. Throughput doubles. And the shape of the design has
changed in a way worth naming: you have applied pipelining at **block granularity**
rather than item granularity. Season 1 episode five said pipelining requires
independent work, and consecutive *blocks* are independent even when consecutive items
are not. You found the level at which independence exists and pipelined there.

That structure is double buffering, or ping-pong, and once you see it you will see it
everywhere — in graphics, where one frame is displayed while the next is drawn; in data
acquisition, where one buffer is filled by hardware while software processes the other;
in every video pipeline ever built.

## Getting the control right

The mechanism is trivial and the control is where the bugs are, so let me be specific.

Each buffer has an **owner** at every instant: the producer or the consumer. Exactly
one. Never both, never neither.

And the swap is a **handshake**, not a schedule. The producer says "I have finished
filling this one". The consumer says "I have finished draining that one". Only when both
statements are true does ownership exchange.

Three failure modes, and each has bitten real projects.

**Assuming a fixed schedule.** "Filling takes a thousand cycles and draining takes nine
hundred, so if I just swap every thousand cycles it will be fine." It will be fine until
something stalls — a memory refresh, an arbiter losing a round, an upstream gap — and
then the producer overwrites a buffer the consumer is still reading, and the corruption
is data-dependent and intermittent. Use the handshake. Always. It costs two signals.

**Forgetting that the swap must be atomic from both sides.** If the producer's notion
of which buffer it owns updates on a different cycle from the consumer's, there is a
window in which both believe they own the same one. With both sides clocked by the same
clock and swapping on the same cycle, this is straightforward. Across clock domains it
is not — and the answer there is Season 1 episode seven's handshake pattern, which is
exactly right for this: the data sits in a buffer nobody is touching, and you
synchronise a single bit saying whose it is.

That is worth highlighting, because it is a genuinely valuable pattern. **Ping-pong is
often the right way to move large blocks between clock domains** — cheaper than an
asynchronous FIFO for big buffers, because you synchronise one ownership bit instead of
maintaining Gray-coded pointers, and the data storage is a plain memory in each domain's
own clock.

**Not deciding what happens when one side is late.** The producer has finished and the
consumer has not. Does the producer stall — which means backpressure propagates upstream
— or does it drop the new block, or does it overwrite the oldest? For a video display,
dropping or repeating a frame is correct and stalling is not, because the display cannot
wait. For a packet processor, dropping is a functional failure and stalling is correct.
This is a specification question with a right answer that depends on the system, and if
nobody decides it, the implementation decides it by accident.

## Variations worth knowing

**N-buffering.** Three or four buffers instead of two. Why bother? Because two buffers
tolerate zero variability — if either side is occasionally slow, the other stalls
immediately. A third buffer absorbs jitter, exactly as a FIFO absorbs a burst. The
number of buffers you need is the worst-case number of blocks of slip between the two
sides, which is Little's Law again at block granularity.

**Circular buffering.** N-buffering where the buffers are regions of one larger memory
and the ownership is tracked by pointers. Which is — look at this — a FIFO whose items
are blocks. The structures converge, and that is not a coincidence.

Which gives you the decision rule, and this is the practical content of the episode:

**If the unit of dependency is an item, use a FIFO. If it is a block, use ping-pong or
N-buffering.**

And you already know how to tell which, because episode one asked you to write down each
stage's working set. A stage whose working set is one item wants a FIFO. A stage whose
working set is a line or a frame or a packet wants block buffers. The decomposition you
did on day one tells you the buffering structure. That is what a good decomposition is
*for*.

**Banking.** The sibling technique, for a different problem. Not "the consumer needs the
whole block" but "two things need to read the same memory in the same cycle" — Season 1
episode six's port limit. Split the data across two memories such that the two accesses
naturally land in different ones, and both proceed simultaneously. It works beautifully
when the access pattern guarantees they differ — for instance, one side reading even
addresses and one reading odd — and fails when they collide, at which point you are back
to arbitration and somebody waits.

## The cost

**Twice the storage.** And Season 1 episode six is standing right there: if one buffer
only just fits in your on-chip memory, two do not, and now you are either going off-chip
or redesigning. This is the trade that decides whether a streaming architecture works on
a given part, and it is worth doing the arithmetic before committing to the structure.

**One block of latency.** Any given block now waits for a full block time before being
consumed, because that is how long the other buffer takes. If your specification has a
latency requirement measured in items, block buffering may violate it while satisfying
every throughput number — which is Season 1 episode five's lesson in a new costume, and
it catches people who have been thinking about throughput for so long that they forget
somebody cares how long one thing takes.

**And control complexity that only fails under stress.** The ownership logic is correct
in every test where both sides run at their nominal rate. It fails when one side stalls
unexpectedly, which is exactly the situation your test bench is least likely to produce
by accident. So produce it deliberately: randomly stall each side independently, hard,
and assert that no buffer is ever owned by both or by neither.

## The one thing

When the unit of dependency is a block rather than an item, two buffers with an
ownership handshake overlap the producer and the consumer. It costs twice the storage
and one block of latency, and the handshake is not optional — a schedule will fail
silently the first time anything stalls.

## Commute exercise

An image is arriving row by row, a hundred and twenty-eight rows of a hundred and
twenty-eight pixels, one pixel per clock. You must output it **column by column** —
transposed.

On the way home, first: why can you not do this with a FIFO, no matter how deep?

Then work out the minimum storage. Be careful — it is tempting to say two full images,
and there is an argument for less. Think about what the consumer is allowed to start
reading and when.

Then: what is the latency from the first pixel in to the first pixel out, in the
double-buffered design? Compare it to the theoretical minimum.

And then the good question. Suppose the memory you are using can do one access per cycle
— one, total, read or write. Does your ping-pong design actually work? Count the
accesses per cycle that the producer and consumer need between them.

If you find a problem there, you have just discovered why banking exists, and you can
probably work out the specific banking scheme that fixes a transpose. It is a
satisfying one.
