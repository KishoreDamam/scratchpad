---
season: 6
episode: 3
title: Architectural gating
runtime: about 11 minutes
prerequisites: s3ep07, s6ep01, s6ep02
one_thing: The biggest power savings happen before any cell is chosen. Do not compute what is not needed, do not move what can stay, and do not touch memory you can avoid — the architecture sets the budget and every later technique only trims it.
---

> Production note: the ladder from operand isolation up to algorithm choice should
> feel like zooming out. Each rung saves more than the one below.

## Where we are

Yesterday's multiplier.

On the nine idle cycles, junk arrives at its inputs, and a multiplier is an enormous tree of adders.
Every changing input bit ripples through thousands of internal nodes, charging and discharging them.
The result register is gated, so the result is never captured — but the computation happened anyway,
in full, and it cost almost as much as a real one. Clock gating stopped the storage. It did not stop
the work.

The fix: **hold the inputs still** when the result is not needed. Put a register in front of the
multiplier's inputs, enabled by valid — which the tool will clock-gate — or put AND gates on the inputs
that force them to zero when valid is low. Either way, on idle cycles the inputs do not change, and a
circuit whose inputs do not change does not toggle internally. That technique is called **operand
isolation**, and it is the first step up a ladder.

How far up does it go? All the way to the architecture. Today is that ladder.

## The problem

Yesterday's technique, clock gating, is local and automatic. The tool finds enables and inserts gates.
It is excellent, and it has a ceiling. It can only stop registers that were going to hold their value
anyway. It cannot stop logic that is computing something nobody needs, it cannot stop data moving across
the chip that did not need to move, and it cannot stop a memory access that could have been avoided.

And those are where most of the energy goes. Episode one's ranking: clock, memory, data movement, then
logic. Clock gating handles the first. The other three are decided upstream — in the RTL's structure, in
the microarchitecture, in the algorithm.

## The turn

The rule is simple to state and runs through every level of design: **the cheapest operation is the one
you do not perform.**

A multiplier held still costs nothing but leakage. A memory not read costs nothing. A bus not driven
costs nothing. Every technique in this episode is some version of noticing work that is not needed and
arranging for it not to happen.

Here is the ladder, from local to global.

## Rung one: operand isolation

Today's opening. Hold the inputs of expensive logic still when its output is unused.

It works best on large arithmetic — multipliers, wide adders, dividers — fed by signals that toggle
often. It costs a register or some gates at the inputs, and a little delay on the input path. Some
synthesis tools will insert it automatically for recognised structures; many designers write it by hand
on the few large blocks where it matters.

## Rung two: do not toggle what does not need toggling

More broadly, **the activity term**. Several small habits reduce toggling without changing function.

**Do not clear what will be overwritten.** A data register reset to zero at the end of every
transaction toggles every bit, only to be overwritten by the next transaction. If the old value is
harmless — because a valid bit says whether it means anything — leave it.

**Do not drive idle buses with changing values.** A bus between blocks that carries junk when idle toggles
its long, heavily loaded wires for nothing. Hold the last value, or drive a constant.

**Choose encodings for low activity.** A counter that increments in binary can toggle many bits at once — a
carry rippling from bit zero to bit fifteen changes sixteen bits. A Gray code changes exactly one bit per
step. For an address bus to a memory, where consecutive accesses are common, that can halve the toggles on
long wires.

## Rung three: do not move what can stay

**Data movement** — episode one's third-largest consumer, and on many chips the largest after the clock.

Moving a bit a millimetre across a chip costs far more energy than an arithmetic operation on it. Moving it
off chip, to external memory, costs vastly more again. So the architecture that minimises movement usually
wins.

That means **computing near the data**. If a block reads a value from a distant memory only to compare it
with a constant and throw most of it away, move the comparison to the memory. If two blocks exchange large
intermediate results, ask whether they should be one block. Season 3 episode ten said module boundaries are
timing, verification, ownership and physical boundaries. They are also **energy** boundaries: every wide
interface between distant blocks is paid in energy, every transfer, forever.

## Rung four: do not touch memory you can avoid

**Memory access** — the second-largest consumer, and the most dramatic lever.

A memory read charges long bit lines and word lines across the whole array, regardless of how many bits you
wanted. A read from a large memory can cost as much as many arithmetic operations. A read from external
memory costs vastly more than a read from on-chip memory.

So Season 3's memory hierarchy is also an **energy** hierarchy. Keeping the working set in registers or a
small local buffer, rather than re-reading a large memory, saves energy on every access. Season 3 episode
seven's cache is a power technique as much as a performance one — every hit is an expensive access avoided.
And the finest version of all: **reuse data you already have**. Season 3 episode one's audio exercise, where
two hundred milliseconds of history turned out not to need storing at all, is a power saving of the largest
kind — a memory that does not exist consumes nothing.

And at the level of the memory itself: **do not enable what you do not read.** Large memories are built from
banks; access only the bank you need. Memories have chip-enable pins; drive them low when idle, so the array
does nothing. These are simple, often missed, and on memory-heavy designs they are enormous.

## Rung five: choose a different algorithm

The top of the ladder, and the biggest win, is usually invisible to front-end engineers because it happened
before them.

Two algorithms that produce the same answer can differ in energy by a large factor — because one touches
memory twice as often, or needs twice the precision, or cannot exploit the fact that most input is zero. A
filter can be computed in a way that reuses intermediate products, or one that recomputes them. A decoder can
skip blocks it knows are empty.

**Precision** is a particularly strong lever. A sixteen-bit multiplier is roughly a quarter the size of a
thirty-two bit one, and the energy per operation falls with it. If the algorithm is tolerant of lower
precision — as many signal-processing and machine-learning workloads are — cutting the width is a power
saving that compounds through every register, bus and memory that carries the value.

A front-end engineer's role here is to **ask**. When a specification demands thirty-two bits, or a full-frame
buffer, or a fresh memory read per item, ask whether the algorithm truly needs it. Season 3 episode one's
method, applied to energy: the working set determines the memory, and the memory determines the power.

## Measuring it

None of this shows up in function or timing reports. So you measure activity.

A simulation of real workloads can record how often every signal toggles. A power analysis tool combines those
toggle rates with the netlist's capacitances and the library's energies to estimate switching power per block,
per signal. That is how you find the bus toggling for nothing, or the memory enabled every cycle.

And Season 3 episode eleven's warning applies directly: **use real traffic.** Power estimated from a synthetic
test that exercises everything uniformly will not resemble power in the product, where most blocks are idle
most of the time and a few are very busy. The idle behaviour is what dominates battery life, and it is the part
a synthetic test gets most wrong.

## The cost

Each rung costs a little more design effort and saves a lot more power than the one below. Operand isolation
costs some gates. Low-activity habits cost attention. Computing near the data can cost a restructured
architecture. Changing the algorithm costs a conversation with the systems team.

And a subtler cost: some of these trade power against area or latency. A Gray-coded bus needs conversion logic.
A local buffer that avoids memory reads costs area and leakage of its own. Every saving must be weighed against
what it adds, which is episode twelve's arithmetic.

## The one thing

The biggest power savings happen before any cell is chosen. Do not compute what is not needed, do not move what
can stay, and do not touch memory you can avoid. The architecture sets the power budget; every later technique
only trims it.

## Commute exercise

A block that processes bursts of sensor data. It is busy for one second, then idle for ten seconds, repeating.
Every clock in it is perfectly gated during idle, every operand isolated, every memory disabled. Dynamic power
during idle is effectively zero.

The device still drains its battery faster than the specification allows, and measurement shows the block's
idle power is the problem.

On the way home, work out what is left.

Go back to episode one. With every clock stopped and every memory idle, which of the three enemies is still
being paid, every second, in every transistor of that block?

Then work out how large it is relative to the busy power. The block is idle ten out of every eleven seconds —
so even a modest idle power, multiplied by ten, can rival the busy energy.

And the question worth the drive: the only way to remove that remaining power is to remove the block's supply
altogether. **What would the block lose when its power is removed — and what would the rest of the chip see on
the wires coming out of it while it is off?**
