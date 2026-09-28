---
season: 3
episode: 2
title: Cycle accounting
runtime: about 13 minutes
prerequisites: s1ep05, s1ep11, s3ep01
one_thing: Clock rate divided by item rate is your budget in cycles per item. Spend it deliberately, and the area-time dial sets itself.
---

> Production note: Little's Law is the most portable idea in the season. State it,
> then use it twice, then state it again.

## Where we are

Yesterday: the method. Rates, verbs, working sets, cut where the rate or the working
set changes, split control from datapath.

And the exercise ended on a trap. Two hundred milliseconds of audio at forty-eight
kilohertz is nine thousand six hundred samples per channel. At three bytes each,
that is nearly twenty-nine kilobytes for one channel — which on a small part is a
serious fraction of your on-chip memory, spent on a *measurement*.

But look at what the measurement actually is. A loudness figure. A single number
describing roughly how loud the recent past has been. It does not need the samples;
it needs a summary of them.

And a summary like that is available from a first-order recursive filter: take a
fraction of the new sample's energy, add the remaining fraction of the previous
output, store one number. One multiply, one add, one register. It does not
implement a two-hundred-millisecond rectangular window — it implements an
exponential decay with a comparable time constant, which for a loudness measurement
is arguably a *better* answer and certainly an adequate one.

Twenty-nine kilobytes becomes one register.

I want you to notice what kind of move that was, because it recurs constantly:
**the specification described a window, and the window was an implementation of a
requirement, not the requirement itself.** Reading through the stated mechanism to
the actual need is where most of the big architectural wins live, and they are
almost always available before any RTL exists and almost never available after.

Today, the numbers that tell you where to look.

## The problem

"Is this fast enough?"

Somebody asks you that about a design you have sketched, and you have a feeling
about it. The feeling is based on experience and it is probably not bad. But it is
not an answer, and there are three specific ways feelings go wrong here.

Feelings are anchored on **clock rate**, which is almost never the interesting
number. A design at fifty megahertz can be enormously faster than one at five
hundred, if it does more per cycle.

Feelings conflate **latency and throughput**, which Season 1 episode five spent
eighteen minutes separating.

And feelings miss **how much room you have**, which is the actual question. Not "is
it fast enough" but "by what margin, and what should I do with the margin". Because
a design with a factor of fifty in hand should be built completely differently from
one that is scraping by, and the difference is worth a great deal of area.

So: an arithmetic replacement for the feeling.

## The turn

**Cycles per item equals clock rate divided by item rate.**

That is it. One division, and it is the most useful number in microarchitecture.

Do it for the audio example. Forty-eight thousand samples per second per channel,
two channels, so ninety-six thousand samples per second arriving. Clock at a hundred
megahertz. Divide: a hundred million over ninety-six thousand is a little over a
thousand.

**A thousand clock cycles per sample.**

Now look at what that number tells you, because it is not a pass mark, it is a
design brief.

A ten-band equaliser per channel is perhaps fifty multiply-accumulate operations per
sample. You have a thousand cycles. So you do not need fifty multipliers — you need
*one*, used fifty times, with a small state machine sequencing it and a memory
holding the coefficients and the filter state.

That is a factor of fifty in area, and it was decided by one division.

This is Season 1 episode one's area-time dial, and the point of today is that **you
do not choose where to set the dial. The budget sets it.** A thousand cycles per item
means share aggressively. Ten cycles per item means some parallelism. One cycle per
item means fully parallel and pipelined. Less than one cycle per item means multiple
items in flight simultaneously, wider datapaths, and a much more expensive design.

Which is why the first thing to do with any specification is this division. It
partitions the whole design space before you have made a single decision.

## The second number

Now the tool that handles the harder questions, and it is the most portable idea in
this season because it is true of queues everywhere — checkouts, roads, networks,
your design.

**Items in flight equals throughput multiplied by latency.**

It is called Little's Law. Rate times time equals population. If a stage accepts one
item per cycle and each item takes twelve cycles to get through, then at any instant
twelve items are inside it.

That sounds like a restatement of the obvious, and it pays for itself immediately,
because it tells you how much *storage* your throughput costs.

Twelve items in flight means twelve items' worth of state has to exist somewhere.
Twelve pipeline stages' worth of registers, or twelve entries of buffering, or twelve
sets of tracking information. You do not get to choose; you either provide storage for
twelve items or you do not achieve that throughput.

Use it the other way round and it becomes a design tool. You need a hundred megabytes
per second from a memory whose latency is fifty cycles at a hundred megahertz — half a
microsecond. Multiply: rate times latency tells you how many bytes must be in flight
to sustain that rate. If you cannot buffer that many, you cannot reach that rate, no
matter how fast the memory's peak bandwidth is.

That product — bandwidth multiplied by delay — turns up in episode three as latency
hiding and in episode five as credit-based flow control, and it is the same
multiplication every time. It is worth recognising as a friend.

## Doing the accounting

The practical routine, which takes twenty minutes and is worth doing on every block
you design.

**One: cycles per item, per module.** From your rate diagram. Note that this differs
per module — a stage after a four-to-one decimation has four times the budget of the
stage before it, and stages either side of a rate change are very different animals.
This is why episode one cut the design at rate changes.

**Two: operations per item, per module.** Count the arithmetic. Roughly is fine.

**Three: divide.** Operations per item over cycles per item tells you how many
parallel units you need. Below one, you can share a unit between stages or items.
Above one, you need that many in parallel.

**Four: the initiation interval.** For each module, how often can it accept a new
item? Not how long an item takes — how often a new one may start. A block with an
eight-cycle latency that accepts a new item every cycle has an initiation interval of
one and a throughput of one per cycle. A block with a three-cycle latency that can
only accept a new item every third cycle has an interval of three and a third of the
throughput. **Throughput is one over the initiation interval, and latency does not
appear in it at all.**

That distinction is where most performance misunderstandings live. When somebody says
a block is "twelve cycles", ask which number they mean. They are usually quoting
latency and you usually care about the interval.

**Five: find the constraint.** One module has the worst ratio of work to budget.
That is the module that limits the design, and it is the only one worth optimising.
Everything else has slack, and effort spent there produces nothing — which is exactly
Season 1 episode three's critical path argument, one level up.

## Peak versus average

One correction that catches everybody, and it catches them late.

Everything above used average rates. Real traffic is not average. A packet interface
running at forty percent utilisation on average may deliver a burst at full line rate
for ten microseconds.

**Budget with the average and size the buffers with the peak.** Those are two
different calculations and they answer two different questions. The average tells you
how much arithmetic you need. The peak — specifically, the worst-case burst — tells
you how much storage you need so that the arithmetic is never starved and the input is
never dropped.

And Season 2 episode eight's rule stands behind this: a buffer absorbs a burst, it
cannot fix a rate. If your average input rate exceeds your average processing rate,
no amount of buffering saves you and your budget is simply wrong.

The failure this prevents is a real and common one: a design sized entirely on
averages, which works in the lab with uniform stimulus and drops data on real traffic.
It is a specification failure disguised as an implementation bug, and it is discovered
in integration.

## The cost

The numbers are approximations built on assumptions, and the assumptions are the
weak point. Your operation count is a guess until the algorithm is fixed. Your peak
burst is whatever somebody told you, and they may have been guessing too.

So the accounting is only as good as its inputs, and the professional habit is to
write the assumptions down *next to* the numbers, so that when reality differs you
can see which conclusion changes. A budget with its assumptions attached is an
engineering document. A budget without them is a number that will be quoted at you in
six months by somebody who does not know what it depended on.

The second cost is that this work is unglamorous and produces no code. It is a
spreadsheet. It is also, reliably, the highest-leverage hour in the project — and
episode eleven makes the case that the spreadsheet should sometimes become a proper
model.

## The one thing

Clock rate over item rate is your budget in cycles per item, and it sets the
area-time dial for you. Throughput times latency is how many items are in flight, and
therefore how much storage your throughput costs. Budget on the average, size the
buffers for the peak.

## Commute exercise

A video pipeline. Nineteen hundred and twenty by ten eighty, sixty frames per second,
one pixel per clock. The clock is a hundred and fifty megahertz.

On the way home, first: how many pixels per second, and therefore how many clock
cycles do you have per pixel? The answer is close to one, and work out whether it is
above or below — because which side of one you land on changes the entire design.

Then: one stage of this pipeline is a filter needing twelve multiply-accumulate
operations per pixel. How many multipliers do you need?

Then: that filter's memory has a two-cycle read latency, and you want one pixel per
cycle through it. How many pixels are in flight inside that stage, and what does that
cost you in storage?

And finally the one that matters. Video does not arrive uniformly — there are blanking
intervals between lines and between frames, during which no pixels arrive at all.
Which means the *active* pixel rate is meaningfully higher than the average you just
computed.

Work out roughly how much higher, and then decide: do you build for the active rate,
or build for the average rate and buffer through the blanking? Both are real designs.
One of them is smaller and one of them is simpler, and knowing which is which is the
point of the exercise.
