---
episode: 07
title: Two clocks
runtime: about 13 minutes
prerequisites: ep03
one_thing: You cannot eliminate metastability. You can only make it rare enough that the universe ends first.
---

> Production note: resist the urge to soften the probability section. The
> listener should come away genuinely unsettled, then reassured by engineering.

## Where we are

First, a debt. Four episodes ago I asked you about two registers wired directly
together, output straight into input, no logic between them at all. By
everything I told you about hold time, the new value should race down that tiny
path and corrupt the capture. And yet it is one of the safest structures in
digital design.

The answer is a small, deliberate number. When the clock edge arrives, a
register does not produce its new output instantly — it takes a little while to
get going. That delay is called clock-to-output, and every register has one. And
the people who design registers make sure that this start-up delay is *longer
than the hold time* of the register next to it.

So by the time the new value has even begun to leave A, B has already finished
its grab. The race is fixed in advance, by construction, in the standard cell
library. You are being protected by somebody you have never met who made a
decision years ago.

That is worth noticing in itself. A great deal of what makes digital design
possible is guarantees engineered underneath you by people whose names you will
never learn. And today's episode is about what happens when you step outside the
region where those guarantees apply — because that region has a hard edge, and
the edge is: **one clock**.

## The problem

Everything we have built rests on one assumption, stated back in episode two:
everybody watches the same clock, so everybody agrees on what time it is.

Now the real world arrives.

Your chip has a processor running at one clock. Your Ethernet interface runs at
a completely different clock, because the frequency is dictated by the standard
and ultimately by a crystal somewhere else in the world. Your video input runs
at another, set by whatever is sending the video. Your memory controller has its
own. A serious chip may have dozens of clock domains, and most of them are not
related to each other by any whole number ratio, and some of them drift relative
to each other with temperature.

So take a signal generated in one domain and feed it into a register clocked by
another. And ask the episode-three question: does it meet setup and hold?

It cannot be answered. There is no fixed relationship between the two edges. The
data might arrive a nanosecond before the capturing edge, or a picosecond
before, or exactly *on* it. And over time, as the clocks drift past each other,
it will arrive at every possible offset, including the worst one, sooner or
later. Not might. Will.

So: what does a register actually do when you violate its window? Not "what is
the value" — what does the physical thing do?

## The turn, part one: the honest answer

The honest answer is that it does something that has no place in digital logic
at all.

Inside a flip-flop is a little circuit with two stable positions — one for zero,
one for one — like a switch that clicks firmly into place either way. The clock
edge pushes it towards one or the other, and it settles.

But it has a third position. Balanced exactly between the two. And if you push
it with a signal that changes right in the middle of the capture window, you can
land it there: not a zero, not a one, sitting at an intermediate voltage,
perfectly balanced.

This is **metastability**, and it is not a hypothetical. It happens in real
devices, and it is worth being precise about its two nasty properties.

It resolves eventually. Any noise, any tiny asymmetry, tips it off the balance
point, and it falls to zero or one. Good.

But — and here is the part with teeth — **how long that takes is not bounded.**
It is probabilistic. The chance of still being undecided decays exponentially
with time, which is excellent news, but exponential decay never actually reaches
zero. There is no number of nanoseconds after which you can say "it has
definitely resolved by now". You can only say "the chance it has not is one in a
number so large it has no practical meaning".

And while it sits there undecided, it is outputting a voltage that is neither a
zero nor a one. Downstream gates read that voltage. Different gates may read it
*differently* — one decides it is a one, another decides it is a zero, from the
same wire, at the same instant. Your design's most basic assumption, that a
signal has one value, is temporarily untrue.

That is how a chip can be logically perfect and still fail once a week for
reasons no simulation will ever show you. Simulators work in zeroes and ones.
Metastability is not a zero or a one.

## The turn, part two: the engineering

You cannot prevent it. There is no clever circuit. The physics is the physics.

So the engineering response is not prevention. It is this: **make it rare
enough, and give it enough time, that the probability of it ever affecting you
is smaller than the probability of the equipment being destroyed by other
means.**

The instrument is beautifully simple. Take the incoming signal and clock it into
a register in the new domain. That register might go metastable — accept it,
plan for it. Now take *that* register's output and, instead of using it, feed it
straight into a second register clocked by the same new clock. Only the second
register's output is allowed out into your design.

Two registers, back to back, no logic between them. The structure from the
beginning of this episode.

What you have bought is time. The first register might be sitting there
undecided — but it has a full clock period before the second register looks at
it. A full clock period of exponential decay. And when you run the numbers, the
probability of still being undecided after a whole cycle is so small that the
expected time between failures comes out in years, or centuries, depending on
the clock rate and the part.

That calculation has a name — mean time between failures — and the important
thing about it is what it admits. The design is not correct. It is correct with
a probability, and you have chosen how much probability to buy. If you need
more, you add a third register and buy several more orders of magnitude at the
cost of one more cycle of latency.

I find that genuinely one of the most honest structures in engineering. It is a
component whose entire purpose is to contain an unavoidable failure and push its
expected arrival beyond the lifetime of the product.

## Where it goes wrong

Now the trap, because knowing about synchronisers makes people overconfident,
and overconfidence here produces the worst bugs in the field.

**A synchroniser works for one bit. It does not work for several.**

Suppose you have an eight-bit counter in one domain and you want its value in
another, so you put a synchroniser on each of the eight bits. Reasonable. Wrong.

Each bit is individually safe. But they are independent, and their capture
timing is not identical — the wires have different delays, the flops resolve at
slightly different moments. So when the counter goes from seven to eight, all
four low bits fall and the high bit rises, and the receiving domain may see some
of those changes one cycle and the rest the next.

For one cycle, it reads a value that never existed. Fifteen, on the way from
seven to eight. And fifteen might be a perfectly legal value that your logic
acts on immediately and confidently.

This is the bug that survives every test, passes every simulation, works
flawlessly on the bench for six weeks, and then corrupts something in the field.

There are three standard escapes and each is worth knowing by name.

**Change only one bit at a time.** There is a counting scheme called Gray code
where consecutive values differ in exactly one bit. If only one bit ever
changes, then the worst case is that the receiver sees the old value or the new
value — both of which are real values that actually existed. Never a phantom.

**Handshake.** Keep the data on ordinary wires with no synchroniser at all, and
synchronise a single flag that says "the data is stable now, go ahead and read
it". You are synchronising one bit — safe — and the data is guaranteed still
because the sender promised not to touch it until it gets an acknowledgement
back. Slow, because every item costs a round trip, and completely robust.

**An asynchronous FIFO.** A queue written by one clock and read by another, with
Gray-coded pointers crossing between them. This is the workhorse — it handles
streams, it absorbs rate differences, and essentially every real system contains
several. Use a proven one. This is not a good place to be original.

The rule underneath all three: **cross a clock domain in one place, with one
structure, on purpose.** Domain crossings scattered casually through a design
are the single most reliable way to produce a product that fails
intermittently and cannot be debugged, because the failure is a probability
distribution and your debugger is not.

## The cost

What this takes away is certainty, and it takes it permanently.

Every other bug you will meet has a cause you can find and a fix you can prove.
This one has a *rate*. You do not eliminate it; you push it out past the
lifetime of the universe and then you document the assumption.

It also costs latency — two or three cycles per crossing, every crossing, no
exceptions. And it costs you the ability to be casual. A signal is not just a
signal any more; it is a signal *that belongs to a clock domain*, and moving it
between domains is a deliberate act that requires a structure, not a wire.

## The one thing

You cannot eliminate metastability. You can only give it time to resolve and
make it rare enough that something else kills the product first. And a
synchroniser protects one bit — protecting several requires a different idea
entirely.

## Commute exercise

A button on a panel, pressed by a human finger, wired into a chip.

The human has no clock. The button press can land anywhere, including exactly in
the capture window, so you put a two-register synchroniser on it. Good.

Now, on the way home, work through what is still wrong.

Start with the fact that a mechanical switch does not close once. It bounces —
the contacts chatter for a few milliseconds, making and breaking perhaps dozens
of times. Your perfectly synchronised input reports dozens of clean, correctly
captured, metastability-free button presses.

So: how do you fix that, and where in the design does that fix belong — before
the synchroniser or after it? And which episode of this series does the fix
turn out to be an example of?

That last question has a satisfying answer, and if you get it, you are starting
to see the pieces as a system rather than a list.
