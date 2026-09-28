---
season: 5
episode: 4
title: Static timing analysis
runtime: about 12 minutes
prerequisites: s1ep03, s5ep02, s5ep03
one_thing: Static timing analysis checks every path by ignoring what the logic computes and asking only how long a change could take to travel. That is why it is exhaustive, why it is pessimistic, and why it cannot see a path's meaning.
---

> Production note: the arrival/required/slack arithmetic should be walked through
> once, slowly, with round numbers. Everything in episode eleven depends on it.

## Where we are

Yesterday's input. Three nanoseconds for the upstream chip's output, one for the board — an input
delay of four. Of an eight-nanosecond period, your logic has the remaining four, minus the capturing
register's setup time, minus whatever margin you declared for clock uncertainty. Call it a bit over
three and a half nanoseconds of real budget.

Forget the input delay, and the tool either does not time that path at all, or treats the data as
arriving at the very start of the cycle and gives your logic the full eight. Either way, it approves
logic that has less than half the time it thinks. Every default is optimistic, because the tool cannot
invent a pessimism you did not give it.

And the last question: how can a tool check every path, at every corner, without simulating anything?
That is today, and the answer is the most important idea in this season.

## The problem

Season 4 was built on a fact: you cannot simulate enough. The state space is larger than the universe.
Every verification technique is a strategy for sampling it cleverly or, with formal, for proving
properties on small pieces.

Timing seems like it should be worse. Whether a path is fast enough depends on which values are
flowing through it — a carry chain is slow only when the carry actually ripples all the way. So surely
checking timing needs the right input vectors, and surely you can never have enough of them?

If that were true, no chip would ever be shipped with confidence about its clock speed. And yet every
chip is, routinely, against a timing analysis that runs in minutes to hours and covers everything.

## The turn

**Static timing analysis ignores what the logic computes.**

That is the whole trick. It does not ask "what value is on this wire". It asks only: **if the input to
this cell changed, how long could it take for the output to change?** That is a property of the cell,
its load and its input transition — yesterday's table lookup. It does not depend on data.

So the tool treats the netlist as a graph. Every cell is a set of timing arcs — from each input to its
output, with a delay. Every wire is an arc with its own delay. And a **path** is any route through that
graph from a **startpoint** — a register's clock pin, or an input port — to an **endpoint** — a
register's data pin, or an output port.

Then it does arithmetic on that graph. No simulation, no vectors, no cycles. And because it never asks
which values flow, **every path is covered**, whether or not any real input sequence would ever
exercise it. That is where exhaustiveness comes from.

## The arithmetic

Walk through one path, with round numbers, because every timing report you will ever read is this
calculation written out.

**The arrival time.** The clock edge launches the data. Take that edge as time zero. The clock takes
some time to travel from its source to the launching register — say half a nanosecond, which is the
clock's **latency** to that register. The register takes, say, a fifth of a nanosecond from clock edge
to output. Then the data passes through a series of cells and wires, each adding its looked-up delay —
say five nanoseconds in total. So the data **arrives** at the capturing register at five point seven
nanoseconds.

**The required time.** The next clock edge, one period later — call it eight nanoseconds. It takes its
own latency to reach the capturing register — say half a nanosecond again, so it lands at eight point
five. The capturing register needs the data to be stable a little before its edge: its setup time, from
the library, say a tenth. And you declared an uncertainty margin, say a fifth. So the data is
**required** by eight point five, minus a tenth, minus a fifth: eight point two.

**The slack.** Required minus arrival. Eight point two minus five point seven: two and a half
nanoseconds of **positive slack**. The path meets timing with room to spare.

If the arrival had been nine, the slack would be **negative** eight-tenths of a nanosecond — a
violation, and the amount by which you must speed up that path.

That is it. Every line in a timing report is one term in that sum. Episode eleven will read one aloud.

## Setup and hold, both

That was a **setup** check: does the data arrive early enough for the *next* edge? It uses the
**longest** delays, because the question is about the latest possible arrival — the max path.

The **hold** check is the mirror: does the data change too soon after the *same* edge, before the
capturing register has finished taking the previous value? It uses the **shortest** delays — the min
path — and compares them against the hold time.

Setup at the slow corner, with max delays. Hold at the fast corner, with min delays. Every path, both
checks, every corner. And yesterday's warning still stands: hold does not involve the period, so no
change of clock speed fixes it.

## Pessimism on purpose

Now the other half of the picture. STA is not only exhaustive. It is deliberately **pessimistic**, and
the pessimism comes from three places.

**The worst case everywhere.** For setup, every cell on the path is assumed to take its slowest delay
for the conditions at the corner. In reality, a real signal's transitions and a real chip's variations
will not all line up against you at once. STA assumes they do.

**On-chip variation.** Even on one die, two cells of the same type are not identical, and the clock
reaching two registers may vary. So the tool applies **derates**: for a setup check, it makes the
launching clock path and the data path a little slower, and the capturing clock path a little faster —
the worst combination. Where the two clock paths share a common stretch of the tree, the tool knows
that stretch cannot be both fast and slow at once, and removes that double-counting; it is called
common path pessimism removal, and you will see a line for it in reports.

**And no knowledge of function.** Which is the big one. Because STA ignores what the logic computes, it
times paths that can never actually be exercised. A multiplexer whose select is always one way in a
given mode, a path through two blocks that are never active at the same time — STA times those as
carefully as the real paths, and reports them if they fail.

That last point is where tomorrow comes from. When STA reports a failure on a path that cannot really
happen, the fix is not to speed the path up. It is to tell the tool the path is not real. And telling
the tool something is not real is exactly the kind of statement that must be made with great care.

## What it does not check

Three honest limits, worth knowing precisely.

**It does not check function.** A design can pass timing everywhere and compute the wrong answer. That
is Season 4's job.

**It assumes synchronous design.** It is built on the idea that every path starts at one clock edge and
ends at another with a known relationship. Paths between unrelated clocks — declared asynchronous
yesterday — are removed from analysis, and their correctness rests on synchronisers and on Season 6's
clock domain crossing checks. STA says nothing about them.

**It is only as good as its inputs.** The library's characterisation, the constraints, and — before
layout exists — estimates of wire delay. Early in a project, STA is a prediction. After layout, with
real extracted wires, it becomes a measurement. Episode twelve covers that handoff.

## Two numbers to know

When people talk about a design's timing state, they use two summaries.

**Worst negative slack** — the slack of the single worst path. It tells you how far the design is from
the target frequency.

**Total negative slack** — the sum of the negative slack over all failing endpoints. It tells you how
*widespread* the problem is. A design with a worst slack of minus a tenth and a total of minus a
tenth has one path to fix. A design with a worst of minus a tenth and a total of minus five hundred has
thousands, and that is not a path problem. It is an architecture problem, and episode eight is where it
goes.

## The cost

The cost of STA's power is that it makes you responsible for telling it what is real. Its pessimism is
safe: it will never approve a path that could fail in the conditions you described. But every failing
path it reports is either a real problem or a path you have not explained, and it is you who must
decide which.

And the decision is asymmetric. Wrongly deciding a real path is false removes a real failure from every
future report, permanently, silently. Wrongly deciding a false path is real costs you some effort
speeding up something that did not need it. When in doubt, the cheap mistake is the second one.

## The one thing

Static timing analysis checks every path by ignoring what the logic computes and asking only how long a
change could take to travel. That is why it is exhaustive, why it is pessimistic, and why it cannot tell
a real path from one that can never happen.

## Commute exercise

A configuration register. Software writes it once, during boot, and then never again. Its output fans
out across the datapath, which reads it every cycle.

STA reports that the path from this register to a datapath register fails setup by one nanosecond. A
colleague says: "that register is static — it never changes during operation. Mark it as a false path."

On the way home, decide whether they are right.

Start with the case for it: if the value really never changes while the datapath is running, when would
a slow path from it ever matter?

Then attack it. What exactly does "never changes during operation" depend on? Who guarantees it — the
hardware, or somebody's software? What happens on the first cycle after boot, when the value *has* just
changed? And what happens in two years, when a new software feature writes that register while traffic
is flowing?

Then the question worth the drive: is there a constraint that is less absolute than a false path — one
that would capture what is actually true about this register, and still let the tool check something?
