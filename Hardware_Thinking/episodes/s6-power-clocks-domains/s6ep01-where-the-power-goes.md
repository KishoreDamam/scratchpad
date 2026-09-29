---
season: 6
episode: 1
title: Where the power goes
runtime: about 11 minutes
prerequisites: s5ep02, s5ep06
one_thing: Power has three enemies — switching, short-circuit and leakage — and they answer to different fixes. Switching is paid per toggle, leakage is paid per second whether anything happens or not, and you cannot fix one with the other's tools.
---

> Production note: the "activity times capacitance times voltage squared times
> frequency" formula should be said as words, twice, the second time pointing at
> which term each later episode attacks.

## Where we are

Welcome to Season 6.

First, the debt from the end of Season 5. I asked you to compose a handoff note, find the list of
things you would change with another month, and pick the one that would be cheapest to fix *now*,
before the handoff.

For most blocks it is one of two things.

**An unregistered interface.** One combinational path through a port, with no written budget. It
closed in synthesis against a guess about the neighbour. Registering it now costs a cycle and an
hour. Discovering after layout that it does not close costs Season 5 episode eight — a latency
change, rippling outwards, at the worst time.

**Or an exception whose premise is only half true.** A multicycle path whose assertion has never
been written, or a false path on a register that software might one day write while traffic is
flowing. Writing the assertion now costs an afternoon. Finding the bug in silicon costs a respin.

Both have the same shape: a claim the design depends on that nobody has checked. And this season
adds a new class of such claims — about when parts of the chip are powered, clocked, and in reset.
Those claims fail in the least forgiving way there is: intermittently, in the field, in a customer's
product, under conditions nobody can reproduce on a bench.

But we start somewhere simpler. Where does the energy actually go?

## The problem

For most of this series, power has been invisible. You designed for function, then for speed. The
chip consumed whatever it consumed.

That stopped being acceptable a long time ago. A phone must last a day on a battery the size of a
biscuit. A data-centre chip is limited not by how fast its transistors can switch but by how much heat
can be pulled out of it — every watt saved is a watt that can be spent on more computation. A sensor
might need to run for years on a coin cell. Across the industry, power is now a first-class
specification, written into the architecture document next to area and throughput.

And the trouble for a front-end engineer is that power, unlike timing, gives no clear failure. Nothing
reports negative slack. The chip just runs hot, or the battery is flat by lunchtime, and by the time
anyone measures it, the architecture is fixed.

So you need a model of where the energy goes, clear enough to reason with before any measurement
exists.

## The turn

There are **three** ways a digital circuit consumes power, and it is worth keeping them strictly apart,
because each has different causes and different cures.

## One: switching power

Every wire and every gate input is a tiny capacitor. When a signal switches from zero to one, that
capacitor is charged from the supply. When it switches back, the charge is dumped to ground. Each full
cycle of charging and discharging costs a fixed amount of energy, and the energy comes from the battery.

So the power spent switching depends on four things, multiplied together.

**How often signals actually toggle** — the **activity**. A wire that changes every cycle costs a great
deal. A wire that changes once a second costs almost nothing.

**How much capacitance is being charged** — the wire's length, the number of inputs it drives. Season 5
episode two's load.

**The supply voltage, squared.** This is the one that matters most. Charging a capacitor to a voltage
takes energy proportional to the voltage squared. Lower the voltage by a fifth and switching energy
drops by more than a third.

**And the clock frequency** — how many opportunities per second there are to toggle.

Say it in words: **activity, times capacitance, times voltage squared, times frequency.** Every
technique for reducing switching power attacks one of those four terms. Clock gating, tomorrow, attacks
activity. Architectural gating, episode three, attacks activity at a larger scale and capacitance by not
touching memory. Multi-voltage design and frequency scaling, episodes five and six, attack voltage and
frequency together.

## Two: short-circuit power

While a gate is switching, for a brief moment both its pull-up and pull-down transistors are partly on
at once, and current flows straight from supply to ground through them. That is wasted.

How much depends on how long the switching takes — on the **transition time**, Season 5 episode two's
slew. A crisp edge spends little time in the middle; a lazy edge spends a long time there. So
short-circuit power is mostly controlled by keeping transitions sharp, which the flow already does for
timing reasons. It is usually a modest fraction of the total, and a front-end engineer rarely attacks it
directly. It is worth knowing it exists, and that slow edges cost power as well as time.

## Three: leakage

Transistors are not perfect switches. Even when fully off, a small current trickles through them —
from supply to ground, continuously, in every cell on the chip, whether or not anything is switching.

That is **leakage**, and it is a completely different kind of enemy.

Switching power is paid **per toggle**. Stop toggling and it stops.

Leakage is paid **per second**. It is paid while the chip is computing, while it is idle, while it is
waiting for a key press. It depends on the number of transistors, on their threshold voltage — Season 5
episode two's flavours, where the fast, low-threshold cells leak far more — on the supply voltage, and,
very strongly, on **temperature**. Leakage roughly grows exponentially as the chip heats up. A hot chip
leaks more, which makes it hotter, which makes it leak more. On bad designs that loop can run away.

On modern processes, leakage can be a large fraction of total power — in a mostly idle device, often the
dominant one.

## Why the split matters

Here is the practical consequence, and it is the one thing from today.

**You cannot fix one with the other's tools.**

Clock gating stops toggling. It does nothing whatsoever to leakage — a gated block still leaks exactly as
much as before. A block that is idle ninety percent of the time, clock-gated perfectly, still pays full
leakage for all of that ninety percent.

Conversely, choosing high-threshold, low-leakage cells does nothing for a block that toggles furiously; it
just makes it slower.

So the first question about any power problem is: **which enemy is it?**

If the chip is burning power while busy, look at activity and voltage — switching dominates.

If the chip is burning power while doing nothing, it is leakage and the clock tree. Clock gating fixes the
clock tree's part. Only **turning the power off** — episode four — fixes the leakage.

## The shape of a typical budget

A rough picture of where switching power goes in a typical digital block, so you have proportions to
reason with. The exact numbers vary enormously; the ranking is surprisingly stable.

**The clock network** — the tree from Season 5 episode six, plus every flip-flop's clock pin. It toggles
every cycle, at every leaf, whether or not any data changes. Often a third or more of the dynamic power.

**Memories** — every read and write charges long internal lines across the whole array. Per access, a
memory read costs far more than an addition.

**Data movement** — long wires carrying wide buses between blocks. Season 5 episode nine's physics, now
priced in energy rather than time.

**Logic** — the actual computation. Often, perhaps surprisingly, the smallest share.

That ordering is worth carrying: **moving and storing data usually costs more than computing on it.** An
architecture that keeps data local, touches memory less and moves fewer bits a shorter distance usually
saves more power than any amount of clever logic. That was Season 3 — working sets and memory tiers —
seen from a new angle.

## The cost

The cost of this model is that it makes power everybody's problem, at every level.

It is an architecture problem — data movement and memory access dominate. It is a microarchitecture
problem — how many registers toggle every cycle, and whether they need to. It is an RTL problem — whether
enables are written so the tool can gate clocks. It is a physical problem — clock tree, cell choice, wire
length. And it is a software problem — whether the chip is ever allowed to sleep.

And none of those levels produces a failure report. Power is found by measurement or estimation, not by a
checker. Which is why episode twelve, on estimating power early and defending the number, closes the
season.

## The one thing

Power has three enemies — switching, short-circuit and leakage. Switching is activity times capacitance
times voltage squared times frequency, paid per toggle. Leakage is paid per second whether anything happens
or not. You cannot fix one with the other's tools, so the first question is always which enemy you are
fighting.

## Commute exercise

A block with a thousand flip-flops, clocked at five hundred megahertz. It is busy about ten percent of the
time. The other ninety percent, its inputs are idle and none of its data registers change value.

Its measured power while idle is nearly as high as while busy.

On the way home, explain why.

Go through the three enemies. During idle, the data is not changing — so which switching power is still
being paid? Think about what the clock does to a thousand flip-flops every cycle, even when every one of
them captures the same value it already held.

Then separate the idle power into its two remaining parts, and say which technique would remove each one.

Then the question worth the drive: the fix for the larger part is conceptually trivial — "just stop the
clock when there is nothing to do". **Why might it be dangerous to do that with an ordinary AND gate on the
clock line?** Think about what happens if the enable changes while the clock is high.
