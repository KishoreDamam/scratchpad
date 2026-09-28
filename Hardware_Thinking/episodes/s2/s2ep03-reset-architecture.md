---
season: 2
episode: 3
title: Reset architecture
runtime: about 12 minutes
prerequisites: s1ep07, s2ep02
one_thing: Assert asynchronously so reset works with no clock. Release synchronously so the release cannot land in a capture window. Both halves, per clock domain, deliberately.
---

> Production note: this is the first episode where a listener may recognise a bug
> from their own past. Leave a beat after the recovery-and-removal section.

## Where we are

Two episodes of things appearing in your design that you did not write. Today,
something that fails to appear: the initial condition.

And this one is different in character, because the failure mode is not "wrong
answer". It is "works nine times out of ten". Which, after Season 1 episode ten,
you should now be able to classify instantly — an intermittent failure is a
timing problem or a domain problem, not a logic problem. Reset is both.

## The problem

Power comes up. Your chip is now a few million registers, every one of them
holding... what?

Nothing meaningful. A register at power-on holds whatever the physics of that
particular transistor pair on that particular day happens to settle into. Some
zero, some one, unpredictably, differently on each power cycle and each device.

So before your design can do anything, somebody has to put it into a known state.
That is reset, and the naive view is that it is the easiest thing in the design —
a wire that goes to every flop and makes it zero. What is there to get wrong?

Here is what is there to get wrong. Reset has to work when the clock is not
running yet, because at power-on the clock generator may still be stabilising. It
has to reach every corner of a large chip within some bounded time. It has to
*release* everywhere in a coordinated way, because a design where half the logic
starts running while the other half is still held in reset is a design that comes
up in a state your state machine has never heard of. And the release is a signal
transition arriving at millions of registers that are all looking, which — after
Season 1, episode seven — should make you distinctly nervous.

## The turn, part one: the two kinds

There are two ways to reset a register, and you need both halves of the answer.

**Synchronous reset** is just logic. The reset signal goes into the combinational
cloud in front of the register, forcing the register's input to zero, and the
register captures it at the next clock edge like any other value. Reset is not
special; it is data.

What is good about it: it is a normal path, so normal timing analysis covers it
completely, with no special rules. It is immune to glitches on the reset line,
because the register only looks at the edge — a spike between edges is ignored
like any other. And it filters noise for free.

What is bad: **it requires a running clock.** No clock, no reset, ever. At
power-on, if your clock has not started, your design is not reset — it is
unreset and undefined and possibly driving outputs. And the reset pulse must be
wide enough to be sampled, so a short pulse can be missed entirely.

**Asynchronous reset** uses a dedicated pin on the register itself. Assert it and
the register goes to its reset value *immediately*, with no reference to the
clock at all.

What is good: it works with no clock. Power-on, clock not yet stable, clock
deliberately gated off to save power — the design still resets. That is a real
guarantee and it is why almost all serious designs use asynchronous assertion.

What is bad, and this is the crux of the episode: **the release is dangerous.**

## The turn, part two: why release is the dangerous half

Think about what happens when an asynchronous reset is removed.

While reset is asserted, every register is clamped at zero. Now reset goes away.
At that moment, each register stops being clamped and starts obeying its clock
again.

When does it go away? Asynchronously. Which means with respect to any given
register's clock, it goes away *whenever* — possibly a long way from a clock edge,
possibly a nanosecond before one, possibly right on top of one.

And a register that comes out of reset at the same instant it is trying to capture
a value is a register being asked to do two contradictory things in the same
window. The result is the same failure you met in Season 1, episode seven: it can
go metastable. It can sit undecided, at an intermediate voltage, for an unbounded
time, and then land on either value.

There are even proper names for the timing requirements involved — **recovery**
time, which is how long before a clock edge the reset must have been released, and
**removal** time, which is how long after an edge it must stay released. They are
setup and hold for the reset pin, and they are checked by exactly the same
machinery. You will see them in timing reports, and now you know what they are
asking.

So a purely asynchronous reset has an unbounded failure mode on release. And it is
worse than a single metastable flop, because *every register in the design is
coming out of reset at the same time*. Different registers can resolve
differently. Some start one cycle before others. Your state machine and its
counter come out of reset in different cycles, and now your design is in a state
that no reset sequence was ever supposed to produce — and this happens on maybe
one power-up in a thousand, which is the worst possible frequency: often enough to
happen to customers, rarely enough that it never happens to you.

## The answer

**Assert asynchronously. Release synchronously.**

Both halves, deliberately, and the mechanism that gives you both is small enough
to describe out loud.

Take two registers. Wire them in series — the first one's output into the
second's input. Clock both from the destination clock domain. Tie the first one's
data input permanently to logic one. And connect the raw, messy, asynchronous
reset signal to the *asynchronous reset pin* of both.

Now watch it work.

Reset asserts. Both registers are asynchronously forced to zero, instantly, with
no clock needed. The second register's output is zero, and *that* is what you
distribute to your design as its reset. Asynchronous assertion, achieved.

Reset releases, at some arbitrary moment. Both registers are freed. Now the
constant one starts walking down the chain, one clock edge at a time. The first
register may well go metastable — it was released asynchronously, that is exactly
the hazard — but it has a full clock period to settle before the second register
looks at it. Season 1, episode seven, the synchroniser, doing its job.

And the second register's output — your distributed reset — changes only on a
clock edge, cleanly, once. Synchronous release, achieved, at the cost of two
registers and a cycle or two of latency.

That structure is called a reset synchroniser, and three things about it are worth
carrying.

**You need one per clock domain.** A single design-wide reset released
synchronously to one clock is still asynchronous to every other clock. Each domain
gets its own synchroniser, clocked by its own clock.

**The de-assertion order between domains is now yours to decide.** Which is not a
burden, it is a feature — you often *want* one part of the design to come up
before another. That is a design decision, it belongs in the architecture
document, and Season 6 spends a whole episode on it.

**Do not build it out of combinational cleverness.** Do not gate the reset with
logic, do not filter it with a counter of your own invention, do not add an enable.
This structure is standard, proven, and understood by every tool in the flow. It is
a place to be boring on purpose.

## Which registers need reset at all

One more decision, because it is a real trade and a common review question.

Not every register needs a reset. A register in the middle of a datapath pipeline
— one that simply holds an intermediate arithmetic result — will be overwritten
with valid data before anybody looks at it, as long as the *control* logic around
it is properly reset and does not raise a valid signal until real data has flowed.

Leaving those registers unreset buys you real things: less area in the reset tree,
less power, and easier timing, because the reset tree is a high-fanout network
with the same distribution difficulty as a clock.

It also costs you real things. In simulation, an unreset register starts as
unknown, and unknowns propagate, and a single unreset register can turn a whole
waveform into a wall of X's that hides the bug you were looking for. It makes the
design harder to bring up, because "known state" is no longer a property of the
whole chip. And the test people will want controllability for reasons that are
entirely legitimate.

The professional position is: **reset everything in the control path without
exception, and make datapath registers a deliberate, documented, reviewed
decision** — not a thing that happens because somebody was in a hurry.

## The cost

Reset is now architecture rather than a wire. It has a document, a diagram, a
per-domain structure, an ordering, and a policy about which registers participate.
That is genuinely more work than "connect reset to everything".

The compensation is the failure you never have: the one-in-a-thousand power-up
that comes up wrong, on a customer's desk, that you cannot reproduce, and that
will cost more than this entire season did.

## The one thing

Assert asynchronously so reset works without a clock. Release synchronously so
the release cannot land in a capture window. One synchroniser per clock domain, a
decided order between domains, and reset every control register.

## Commute exercise

Your design has two clock domains. A fast one at four hundred megahertz and a slow
one at twenty-five. They exchange data through a properly built asynchronous FIFO,
so the data crossing is handled.

There is one external reset pin.

On the way home, design the reset. How many synchronisers, clocked by what,
producing what.

Then the question that makes it interesting: the two domains now come out of reset
at unrelated times, and the slow domain's reset release could be as much as forty
nanoseconds after the fast domain's. What can the fast side do, during those forty
nanoseconds, that would break the FIFO?

And therefore: which domain should come out of reset first, and how would you
actually enforce that ordering rather than hoping for it?
