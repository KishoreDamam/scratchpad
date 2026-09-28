---
season: 5
episode: 6
title: Clock trees
runtime: about 11 minutes
prerequisites: s1ep02, s5ep04, s5ep05
one_thing: The clock is never one edge. It arrives at every register at a slightly different time, with a slightly different period — skew and jitter — and every picosecond of either is taken from somebody's logic.
---

> Production note: Season 1 episode two said "everyone agrees on the time". Open the
> turn by gently taking that back. The listener should feel the model get more
> honest, not overturned.

## Where we are

Yesterday's two registers, with the capturing clock arriving a hundred and fifty picoseconds late.

For setup, that **helps**. The capturing edge is later, so the data has a hundred and fifty
picoseconds more to arrive. For hold, it **hurts**. The capturing register is still holding its
old value for longer after the launch, so a fast data path is more likely to race through and
corrupt it. The same skew, pointed in opposite directions for the two checks.

And the question: could you deliberately delay the capturing clock to fix a path failing setup by
fifty picoseconds? Yes — and it has a name, **useful skew**. But the capturing register is also the
*launching* register for the next path. Delay its clock by, say, seventy picoseconds, and the data
it launches leaves seventy picoseconds later too. The next path had two hundred of slack; now it has
a hundred and thirty. You have borrowed time from the next stage to pay the current one. It works
precisely when the next stage has slack to lend. And yesterday's hold warning now applies to the
first path: you just made its hold check seventy picoseconds harder.

Borrowing, with a lender, and a cost. That is what clocks are really like, and it is today.

## The problem

Season 1 episode two made a promise: time is discrete and everyone agrees on it. One clock, one edge,
every register in the design sampling at the same instant.

It was the right model for learning to think in hardware. It is not physically true, and this season
needs the true version.

A clock is a signal. It starts at one point — a pin, or a clock generator — and it must reach every
register in its domain. On a real block that is tens or hundreds of thousands of registers, spread over
millimetres of silicon. The signal takes time to travel. It must be buffered, because no single driver
can charge that much load — episode two's fanout-of-four applies with a vengeance. And every buffer and
every wire has its own delay, which varies across the die and across corners.

So the clock does not arrive everywhere at once. And it does not arrive at exactly the same interval
every cycle either.

## The turn

Two separate imperfections, and it is worth keeping them apart because they have different causes and
different consequences.

**Skew** is a difference in **space**. The same clock edge arrives at two registers at two different
times. Register A sees it at four hundred picoseconds after the source; register B, at four hundred and
sixty. That sixty-picosecond difference is the skew between them. It is mostly fixed — a property of the
tree's structure and the chip's variation — and after layout the timing tool knows it exactly, for every
pair of registers.

**Jitter** is a difference in **time**. The same register sees successive edges at not-quite-regular
intervals. One period is eight nanoseconds and a few picoseconds; the next is eight nanoseconds less a
few. Jitter comes from the clock source itself — the oscillator, the phase-locked loop — and from noise on
the power supply modulating the buffers. It is random, and no layout can remove it. You can only budget
for it.

And the total time from the clock's source to any given register is that register's **latency**, or
**insertion delay**. Skew is just the difference between two latencies.

## Building the tree

**Clock tree synthesis** is the step, in the physical flow, that builds the clock's distribution
network. Its goal is simple to state: deliver the clock to every register with **as little skew as
possible**, at a **reasonable latency**, with **sharp edges** — because episode two told you a lazy
transition makes every register it drives slower and less predictable.

It builds a tree of buffers, carefully balanced so that every branch has close to the same delay. On
high-performance designs, the top of the tree may become a grid or a mesh — a structure that shorts many
drivers together so that local variations average out. More wire, more power, less skew.

That is the back-end team's work, and you will not build a clock tree yourself as a front-end engineer.
But you will write the constraints that stand in for it before it exists, and you will write RTL that
makes it easy or hard to build.

## Before the tree exists

During synthesis and early timing, there is no clock tree. The tool treats the clock as **ideal**: it
arrives at every register at the same instant, with perfectly sharp edges.

That is optimistic, so you correct for it with **uncertainty** — the margin mentioned in episode three.
Before the tree exists, uncertainty stands in for three things: the **skew** the tree will eventually have,
the **jitter** of the clock source, and a **margin** for everything else you are not sure of. It is
subtracted from every setup budget, and added to every hold requirement.

After the tree is built, the skew is known exactly, per register pair, so it comes out of the
uncertainty. What remains is jitter and margin.

And the size of that pre-tree uncertainty is a real decision. Too small and you will sign off a design
that fails after the tree is built. Too large and you have thrown away a slice of every clock cycle for
nothing, and forced the tool to work harder than needed everywhere. Teams calibrate it from previous
projects on the same process. On a new process, it is a guess, and the guess should be written down with
its reason — Season 3 episode twelve's rule about assumptions sitting next to their numbers.

## Hold is fixed last

One consequence explains a lot about how projects run.

Hold violations depend on skew. A hold check is a race between a data path and a clock path launched by
the same edge, and a few tens of picoseconds of skew can decide it. Before the tree exists, the skew is
fiction. So there is little point fixing hold before clock tree synthesis — you would be fixing it against
the wrong numbers.

So the flow generally closes **setup first**, then builds the clock tree, then fixes **hold** — by
inserting small delay cells on the paths that are too fast. That is why a design can go into layout with
thousands of hold violations and nobody panics: they were expected, and they are fixed in bulk once the
clock is real.

What should worry you is a hold violation that cannot be fixed that way — a path so fast, against a skew
so large, that fixing it would break its setup. That means the tree and the logic are fighting, and it
needs a conversation, not a buffer.

## What front-end owes the clock

Three things you control from RTL.

**Do not build your own clock logic.** No gates on the clock path written by hand, no clocks derived by
dividing with an ordinary counter and using its output as a clock. Every one of those is an uncontrolled
delay in the tree, and a glitch waiting to happen. Clock gating uses a dedicated, library-provided
integrated gating cell, inferred by the tool from an enable — Season 6 episode two. Divided clocks come
from a clock generator and are declared as generated clocks.

**Keep domains few and clearly named.** Every clock is a separate tree, with its own latency and its own
power. Every crossing between them is Season 1 episode seven's problem.

**And beware the half-cycle path.** If some registers capture on the falling edge, then paths between
rising-edge and falling-edge registers have only **half** a period. And that half depends on the clock's
**duty cycle** — the high time versus the low time — which the source does not guarantee perfectly. A
negative-edge register is occasionally the right answer, and it is always a cost worth stating out loud.

## The cost

The clock is expensive in a way people underestimate. The clock tree switches every cycle, at every leaf,
whether or not any data is changing. On many designs it is a large fraction of total dynamic power —
often quoted as a third or more. Every register you add is another leaf, another buffer's load, another
share of that power, every cycle, forever. Which is why Season 6 opens with clock gating.

And uncertainty is a tax on every path. A clock that is a hundred picoseconds uncertain in a one-gigahertz
design has given up ten percent of every cycle before a single gate of logic is counted.

## The one thing

The clock is never one edge. It arrives at each register at a slightly different time — skew — with a
slightly different period — jitter. Useful skew can borrow time from a stage with slack to lend, hold is
fixed after the tree exists, and every picosecond of uncertainty is taken from somebody's logic.

## Commute exercise

A path failing setup. It looks like this, in words.

A late-arriving select signal chooses between two inputs, A and B, with a multiplexer. The chosen value then
goes through a large, slow function — call it F — and into a register. The select arrives very late in the
cycle. A and B arrive early.

On the way home, work out where the time goes. How much of the cycle is left for F after the select has
finally arrived?

Then restructure it — without changing what it computes. Hint: what if you computed F on *both* inputs,
early, and let the late select choose at the very end?

Then the question worth the drive. That restructuring costs area — you now have two copies of F. When is that
trade obviously right, and when is it not? And why does the synthesis tool usually **not** make this change for
you, even though it knows exactly which signal is late?
