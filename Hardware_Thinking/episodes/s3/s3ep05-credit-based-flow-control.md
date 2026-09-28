---
season: 3
episode: 5
title: Credit-based flow control
runtime: about 13 minutes
prerequisites: s1ep08, s2ep08, s3ep03
one_thing: Credits make the round-trip delay a throughput question instead of a correctness question. You cannot overflow a buffer you were never given permission to fill.
---

> Production note: the "correctness versus throughput" reframing is the core. Do not
> let it get buried in the mechanism.

## Where we are

Yesterday's transpose. A FIFO cannot do it at any depth, because a FIFO's defining
property is that order is preserved, and a transpose is a permutation — the first output
needs the last input.

Minimum storage is one full image, because the last row contains an element of the first
column. Double-buffered, that is two images. And the clever answer some of you will have
found: you can approach a single buffer, because every time the consumer reads a
location, that location becomes free for the producer to write — so with careful
interleaving of read and write addresses you can transpose almost in place, which is a
factor of two in memory for a meaningful amount of address arithmetic.

Latency is one full image. And that is not a weakness of the design — it is *inherent*.
Nothing can output the first column before the last row has arrived. When you compute a
latency and find it equals the theoretical minimum, you are finished, and knowing that
you are finished is worth as much as any optimisation.

Then the last part. The producer writes one pixel per cycle, the consumer reads one per
cycle: two accesses, and a single-port memory gives you one. So you need two banks. And
the scheme that works is lovely — store each element in a bank chosen by the *sum* of
its row and column, modulo the number of banks. Then a row hits every bank exactly once
and so does a column. The skew makes both access patterns conflict-free, and it is a
standard trick that turns up wherever two orthogonal access patterns share a memory.

Today: what happens to flow control when the two ends are far apart.

## The problem

Season 1 episode eight gave you valid and ready, and it is genuinely excellent. Two
wires, one rule, automatic rate matching, backpressure that propagates by itself.

It has an assumption baked into it that nobody states: **the two ends are next to each
other.**

Ready is a signal travelling backwards. Season 1 episode eight flagged that as a timing
hazard, and Season 2 episode eight showed you what it costs — the producer learns about
full one cycle late, so it overflows by one, so you need an almost-full threshold sized
by counting registers in the round trip.

Now stretch the distance. The consumer is on the other side of a large chip. The path
between you has four pipeline stages in each direction, because it had to, for timing.

So the round trip is eight cycles or more. Which means when the consumer's buffer fills,
the producer keeps sending for eight more cycles. Eight items arrive at a full buffer.

Season 2's answer scales, technically: set the almost-full threshold eight entries early.
But watch what happens as the distance grows. Twenty cycles of round trip on a big chip.
Fifty across a chip-to-chip link. Hundreds over a serial link to another device. The
margin grows with the distance, and at some point the margin is the entire buffer and
there is no room left for the buffering to do its actual job.

And there is a second, worse problem hiding in there. **The margin is a calculation
somebody has to keep correct.** It depends on the number of pipeline stages between the
two blocks — which is a physical-implementation decision, frequently made late, by
somebody closing timing, who has no idea that a threshold constant three modules away
encodes an assumption about their register count.

That is a genuinely bad way to build a system. A correctness property that depends on a
number nobody owns.

## The turn

Invert the protocol.

Instead of the consumer saying "stop" when it is nearly full — a message that arrives
late — the consumer says, **in advance**, how much room it has. And the producer is not
permitted to send anything it has not already been given room for.

That is a credit. Concretely:

At reset, the consumer tells the producer how many entries its buffer has. Say sixteen.
The producer holds a counter, initialised to sixteen.

Every time the producer sends an item, it decrements the counter. When the counter
reaches zero, it stops — not because anybody told it to stop, but because it has run out
of permission.

Every time the consumer removes an item from its buffer and frees an entry, it sends a
credit back. The producer increments its counter.

And now look at the property you have bought.

**Overflow is impossible.** Not unlikely, not prevented by a margin — *impossible*. The
producer has never in its life sent an item without holding a credit for it, and each
credit corresponds to a real free entry. It does not matter if the round trip is eight
cycles or eight hundred. It does not matter if somebody adds four pipeline stages next
month. The buffer cannot overflow, because nothing was ever sent that there was not
already room for.

Here is the reframing, and it is the whole episode:

**With ready and valid, the round-trip delay is a correctness problem that you patch
with margin. With credits, the round-trip delay is a throughput problem and nothing
else.**

If your credit count is too small relative to the round trip, you do not overflow — you
simply run slowly, because the producer spends time waiting for credits to come back.
Too few credits is a *performance* bug. And performance bugs are enormously better than
silent data corruption: they show up as a number being lower than expected rather than as
a customer's data being wrong.

That is why every serious interconnect works this way. Long links, chip-to-chip
protocols, networks on chip, the credit-return mechanisms in standard bus protocols —
credits, all of them, for exactly this reason.

## How many credits

You already know. It is the same multiplication as episode three.

To keep the producer sending continuously, a credit must come back before the producer
runs out. So you need enough credits to cover the round trip at full rate:
**credits equals rate times round-trip time.** The bandwidth-delay product, third
appearance this season.

One item per cycle with a twenty-cycle round trip means twenty credits, which means the
consumer needs a twenty-entry buffer, minimum, to run at full rate. Ten credits gets you
half the rate. Forty gets you nothing extra — you were never going to have more than
twenty in flight.

And that gives you a clean way to talk about it in a review: the consumer's buffer depth
is not a comfort choice, it is a rate decision, and it is computable from the topology.
If somebody wants full rate over a long path, they are asking for a buffer, and the size
of it is arithmetic rather than opinion.

## Where it goes wrong

Four ways, and the first is the one that keeps people up at night.

**Credit leaks.** If a credit is lost — dropped on a reset, miscounted in an edge case,
consumed twice by a bug in the return path — then the producer permanently has fewer
credits than there is space. Nothing breaks. Nothing is corrupted. The link just runs a
little slower, forever. And if enough credits leak, it stops entirely.

That is the nastiest failure mode in this episode, because a *stopped* link looks like a
hang with no error anywhere, and a *slow* link looks like somebody else's performance
problem. Both are invisible to functional tests, which check values.

So: **assert on your credit accounting.** The invariant is simple and always true —
credits held by the producer, plus items in flight, plus items sitting in the consumer's
buffer, equals the buffer depth. Always. Write that as a Season 1 episode nine assertion
across the interface, and a leak becomes a loud simulation failure instead of a
mysterious slowdown in silicon. This is one of the highest-value assertions you will ever
write.

**Reset and initialisation.** Both ends must agree on the credit count at start-up, and
they come out of reset at times that may differ — Season 2 episode three. If the producer
starts with sixteen credits and the consumer has not yet cleared its buffer, you have a
problem before the first item. This is why credit protocols have an explicit
initialisation phase, and why the reset ordering between the two domains is part of the
design rather than an accident.

**Credit return costs reverse bandwidth.** Every credit is a message travelling
backwards. On a dedicated wire, that is cheap. On a shared link, credits compete with
real traffic, which is why real protocols piggyback credit returns onto packets already
going that way, and batch them — returning eight credits in one message rather than eight
messages. Batching saves bandwidth and adds latency to the credit loop, which by the
arithmetic above means you need more credits. There is a real trade there and it is
usually resolved by measurement.

**One credit pool for several kinds of traffic.** If high-priority and low-priority
traffic share one credit pool and one buffer, then low-priority traffic filling the buffer
blocks the high-priority traffic completely. Head-of-line blocking, third sighting this
season.

The standard fix is separate credit pools and separate buffer space per traffic class —
which is what virtual channels are, in the interconnects that have them. It costs
buffering per class, and it is the only thing that actually works: priority at the
arbiter does nothing if the buffer is already full of the wrong packets. Worth knowing as
a phrase, because "we gave it high priority" is a very common non-solution to this
specific problem.

## The cost

Credits are a protocol rather than two wires, and protocols must be agreed, documented,
initialised, and verified on both sides. That is genuinely more work than valid and
ready, and for two adjacent blocks it is entirely unnecessary — use the simple thing when
the simple thing works.

The rule of thumb: **valid and ready for adjacent blocks, credits the moment the path has
pipeline stages in it or crosses a boundary somebody else owns.** The second condition
matters as much as the first. A credit interface is robust against somebody adding
pipeline stages you did not know about, and that robustness is worth the protocol on any
interface that leaves your block.

## The one thing

Credits turn the round-trip delay from a correctness problem into a throughput problem.
Number of credits equals rate times round-trip time, assert on the credit invariant, and
give each traffic class its own pool.

## Commute exercise

Two blocks on a large chip. The path between them has six pipeline stages forwards and
six backwards. You want one item per cycle, sustained.

On the way home: how many credits, and therefore how deep is the receiving buffer?

Then: the credit return path is shared with other traffic, so credits are batched — four
at a time. Work out what that does to the round trip, and therefore to the credit count.

Then the design judgement. Somebody proposes halving the buffer to save area, accepting
half the throughput. Someone else proposes keeping the buffer and returning credits
singly to shorten the loop. Work out what each actually costs.

And finally, the one worth sitting with: if the link carries two traffic classes and you
must not let one block the other, how much buffering do you need in total? Compare it with
the single-class answer, and notice that the multiplication is by the number of classes.
That number is why quality-of-service is expensive in hardware, and why it gets cut.
