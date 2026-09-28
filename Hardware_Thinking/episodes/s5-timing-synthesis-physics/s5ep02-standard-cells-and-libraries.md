---
season: 5
episode: 2
title: Standard cells and libraries
runtime: about 13 minutes
prerequisites: s1ep03, s5ep01
one_thing: A cell's delay is not a number. It is a function of how sharp its input is and how much it has to drive — and every speed-up you buy loads whatever drives you.
---

> Production note: "delay is a function, not a number" is the refrain. The corner
> section should end with the hold-at-fast-corner surprise, said slowly.

## Where we are

Yesterday's five pieces.

The thirty-two bit counter with only twenty-four bits read: the top eight registers, and the carry
logic that fed them, disappear. Nothing reads them, so they do not exist. Normal.

Multiply by eight: wiring. The value shifted left by three, no gates at all. Normal.

Equal to a constant: not a subtractor — a single wide AND of each bit or its inverse. Normal.

Now the two that need a question.

The debug register nobody reads: deleted. And the question is not "why did the tool delete it" but
"why was the debug port never connected?" If that was intended, fine. If somebody forgot to wire it
to the top level, the tool has just silently removed your post-silicon visibility — and you will
discover that in the lab, which is the most expensive possible place.

The input tied to zero: the constant propagates, and every piece of logic that only mattered when
that input was non-zero vanishes. If the feature is genuinely unused in this chip, that is a correct
and valuable optimisation. If the tie-off is a top-level connection mistake, the tool has just deleted
a feature, cleanly, with a one-line message in a log nobody reads.

So before being pleased about a third less area, read the removal report and account for every large
deletion. Most will be innocent. The one that is not is a bug the tool found for you, and then hid.

Today: the cells the tool maps onto, and why their delays are not what you think.

## The problem

In Season 1 episode three, I talked about gate delays as if each gate had one — a two-input AND takes
so many picoseconds, and a path's delay is the sum of the gates along it.

That was a useful simplification, and it is wrong in a way that matters as soon as you read a real
timing report. You will see the same type of gate, in the same design, with delays differing by a
factor of five. You will see a path whose delay is dominated not by any logic but by one ordinary
buffer. And you will see the tool swap a cell for a bigger version of itself and the path get *slower*
upstream.

None of that makes sense until you know what a cell library actually contains.

## The turn

A **standard cell library** is a catalogue. Somebody at the foundry designed each cell — the inverters,
the NAND and NOR gates, the multiplexers, the adders' building blocks, the flip-flops — laid each one
out at the transistor level to a standard height so they tile in rows, and then **characterised** it:
measured, by detailed circuit simulation, exactly how it behaves under every condition it might meet.

And the result of that characterisation, for a single cell, is not a delay. It is a **table**.

Because a cell's delay depends on two things, and neither is a property of the cell alone.

**How sharp its input is.** A signal does not switch instantly; it ramps. That ramp time is called the
**transition**, or the **slew**. A cell whose input arrives with a crisp, fast edge responds quickly. A
cell whose input arrives with a slow, lazy ramp takes longer to respond, and — worse — produces a
lazier output of its own.

**How much it has to drive.** Every input it connects to, and every piece of wire, is a small capacitor
that must be charged or discharged. That total is the **load**. A cell driving one nearby input
switches quickly. The same cell driving thirty inputs across a long wire is trying to fill a much
larger bucket through the same small pipe.

So the library gives, for each cell, a table: rows for input transition, columns for output load, and
in each entry, the delay — and a second table, the same shape, for the transition it produces at its
output. The timing tool looks up the entry, interpolating between them, for every cell on every path.

That is the sentence to hold on to: **a cell's delay is a function, not a number.** It is a function of
what drives it and what it drives.

## Drive strength

Which is why every logic function comes in **several sizes**. The same two-input NAND, available at
one times, two times, four times, eight times the drive strength. Bigger transistors, a wider pipe,
able to charge a bigger load quickly.

So the obvious fix for a slow cell driving a heavy load is to swap it for a stronger one. And the tool
does that constantly — it is called **sizing**, and it is one of its main levers during mapping.

But here is the catch, and it is the thing that confuses people when they first see it.

**A bigger cell has bigger inputs.** Wider transistors are larger capacitors. So upsizing a cell makes
*it* faster, and makes it a heavier load on **whatever drives it**. The delay does not vanish; part of
it moves one stage upstream.

Push that far enough and you arrive at a classic result from circuit design. If you need to drive a
very large load from a small gate, the fastest approach is not one enormous buffer. It is a **chain**
of buffers, each a few times larger than the last, so that every stage drives a load only a few times
its own input. The rule of thumb is that each stage should drive roughly four times its own input
capacitance — you will hear it called the "fanout of four" — and it gives a way of estimating, in your
head, how many stages it takes to drive any load.

The practical consequence for a front-end engineer is this: **a signal with a huge fanout is never
free.** It will get a tree of buffers, and each level of that tree is delay on your path. The reset
signal, the enable driving a whole datapath, the select line of a wide multiplexer — each of those is
a buffer tree in the final netlist, and it will show up in episode eleven's timing reports as a
suspiciously long run of buffers with no logic in it.

## Corners

Now the second dimension of the library, and it is the one that changes how you think about "the"
delay of anything.

Transistors are not all made the same. From one wafer to the next, one die to the next, the
manufacturing process varies — some chips come out with faster transistors, some slower. The supply
voltage varies — a little high makes everything faster, a little low makes everything slower.
Temperature varies — and on most processes, hotter is slower, though on the most modern ones that can
invert at low voltage.

**Process, voltage, temperature** — PVT. Each combination is a **corner**, and the foundry
characterises the library at each one. Slow process, low voltage, hot: the slow corner. Fast process,
high voltage, cold: the fast corner. And typical, somewhere in between.

And your design must work at **every** corner, because you do not get to choose which chips you ship.

Now think about what each corner stresses.

**Setup** — Season 1 episode three — asks whether the data arrives *early enough*. That is hardest when
everything is slow. So setup is checked at the slow corner.

**Hold** asks whether the data changes *too soon* after the edge. That is hardest when everything is
**fast** — the data path races through and arrives before the capturing register has finished taking
the old value. So hold is checked at the fast corner.

Which produces the surprise that catches every beginner: **a design can pass setup comfortably and fail
hold, and slowing the clock does nothing to fix it.** Hold does not depend on the clock period at all.
It is a race between the data path and the clock path, both launched by the same edge. A hold failure
means the chip is broken at any frequency. That is why hold problems, although often small, are treated
as more serious than setup problems. Setup failures make a chip slow. Hold failures make it dead.

## Threshold flavours

One last dimension, briefly, because Season 6 builds on it.

Most libraries offer each cell in several **threshold voltage** flavours. Low threshold: fast, and
leaky — it burns power even when it is not switching. High threshold: slower, and much less leaky. The
tool can mix them: fast, leaky cells on the critical paths, slow, frugal cells everywhere else.

Which means that every picosecond of speed on a path has a power price, and the price is paid
continuously, whether the chip is doing anything or not. Timing and power are the same negotiation.

## And on an FPGA

On an FPGA, the catalogue is different — look-up tables, carry chains, block RAMs, hard multipliers —
but the lesson is the same, with one change in emphasis. On an FPGA, the **routing** between cells is
usually a larger share of the delay than the cells themselves, because signals pass through
programmable switches. A path with few logic levels can still be slow if its pieces were placed far
apart. Episode nine returns to that.

## The cost

The cost is that "how fast is this gate" no longer has an answer, and you have to stop wanting one.
Every delay depends on neighbours, on corners, on sizing choices the tool made for reasons elsewhere in
the design. Your mental model has to become approximate and relative: this path has many levels, that
signal has a huge fanout, this cell is driving a long wire — rather than precise sums.

That is uncomfortable for a sequential thinker who likes exact numbers. But the exact numbers exist; the
tool computes them for every path at every corner. Your job is to know which kinds of structure make
them large.

## The one thing

A cell's delay is a function, not a number — of how sharp its input is and how much it has to drive.
Every speed-up loads whatever drives you, setup is checked slow and hold is checked fast, and a hold
failure is broken at any clock speed.

## Commute exercise

A small gate must drive a load sixty-four times larger than its own input.

On the way home, compare two approaches.

One: replace the gate's output with a single, enormous buffer, sixty-four times the size of a minimum
one. Think about what that buffer does to the gate driving *it*.

Two: a chain of buffers, each four times the size of the one before. How many stages do you need to go
from one to sixty-four? Why is that likely to be faster, even though there are more stages?

Then the question worth the drive. Your block's reset signal fans out to four thousand flip-flops.
Roughly how many levels of buffering does that take, by the fanout-of-four rule? And now — given what
you know about Season 2 episode three's reset release — **does it matter if different flip-flops see
reset released at slightly different times?** Which half of reset cares, and which half does not?
