---
season: 6
episode: 5
title: Multi-voltage design
runtime: about 11 minutes
prerequisites: s6ep01, s6ep04
one_thing: Every wire that crosses between power domains needs a question answered — can the receiver understand the voltage, and what does it see when the sender is off? Level shifters answer the first, isolation the second, and a missing answer is a connectivity bug no ordinary simulation will show.
---

> Production note: introduce "the crossing" as a new kind of boundary early, and
> keep returning to it. It is the power-domain version of Season 1 episode seven.

## Where we are

Yesterday's three clamp values.

**Valid** clamps to zero. Zero means "no data", so the neighbour captures nothing while the block
is off.

The active-low **interrupt** clamps to **one**. One means "no interrupt". Clamp it to zero and the
neighbour's processor is interrupted the moment the block powers down — and keeps being interrupted,
continuously, until the block comes back.

**Data** mostly does not matter, because valid is clamped low and nobody looks at data without valid.
Many designers clamp it to zero anyway, for determinism — it makes simulation waveforms readable and
avoids pointless toggling on the neighbour's inputs.

And if the person choosing clamp values and the person writing the RTL never talk? The clamp file says
"clamp every output of this block to zero", which is a very natural default. And the active-low
interrupt fires, every time the block sleeps. The RTL is correct. The power intent is correct in
isolation. The combination is broken — and in a normal simulation, which knows nothing about power
domains, nothing fails at all.

That is the flavour of this whole episode: **bugs that exist only in the connection between two
correct things.**

## The problem

Episode one said switching power goes with the square of the voltage. Lower the voltage by a fifth and
switching energy falls by more than a third. That is an enormous lever — much larger than most logic
optimisations.

But lower voltage also means slower transistors. So you cannot simply lower the whole chip's voltage
without losing speed everywhere.

The answer is to run **different parts of the chip at different voltages**. The processor that must
be fast gets a higher supply. The always-on controller that does very little gets a low one. The memory,
which has its own constraints, gets whatever it needs. Each region is a **voltage domain**.

And the moment two domains have different voltages, or can be switched off independently, every wire
between them becomes a new kind of boundary with new rules.

## The turn

Think of every wire that leaves one power domain and enters another as a **crossing**, just as Season 1
episode seven taught you to think of every wire between clock domains as a crossing.

And for every crossing, two questions must have answers.

**First: can the receiver understand the sender's voltage?**

**Second: what does the receiver see when the sender is switched off?**

The first is answered by a **level shifter**. The second by an **isolation cell**. And a crossing with a
missing answer to either question is a bug.

## Level shifters

Suppose a block running at a low voltage drives a signal into a block running at a higher voltage.

The low block's "one" is, say, seven-tenths of a volt. The high block's gates were designed for a "one"
near a full volt. When they see seven-tenths, the transistor that should be fully off is only partly off.
Two things go wrong. The gate may not switch reliably at all, especially at the slow corner. And even when
it does, both of its transistors are partly on at once — episode one's short-circuit current, flowing
continuously as long as the signal is high. A wire that should consume nothing when idle leaks steadily.

So low-to-high crossings need a **level shifter**: a special cell with access to both supplies, which takes
the low-voltage signal and produces a proper full-swing signal in the high domain.

The high-to-low direction is gentler — a large swing into a gate designed for a small one usually works —
and is often handled with a simpler cell, or none, depending on the process and the voltage difference. The
power intent specifies which crossings need shifting in which direction.

Level shifters cost area and add **delay** — every crossing between voltage domains now has an extra cell on
the path, and Season 5's timing must include it. Worse, the timing tool must now handle cells whose delay
depends on two different supply voltages, at every corner of each.

## Isolation, again

Yesterday introduced isolation cells for power gating. In a multi-voltage design they appear on every
crossing where the sender can be switched off and the receiver stays on.

Three kinds of clamp. Clamp to **zero**. Clamp to **one**. Or **latch** — hold the last value the signal had
before power-down — for signals where neither constant is safe, such as a status that must not change while
the sender sleeps.

And the rules that cause most of the bugs.

**The isolation cell must be powered by the receiving side** — or by an always-on supply — because it must keep
working while the sender is off. An isolation cell powered by the domain it is supposed to be isolating is
useless, and it is a real, recurring bug.

**Isolation must be enabled before the sender powers down** and released after it has powered up and reset —
yesterday's sequences.

**The isolation control signal itself** must come from a domain that is on whenever it is needed. An isolation
enable generated inside the domain being turned off disappears exactly when it matters.

**And the clamp value must match the signal's meaning** — today's opening, and the most common bug of all.

## A new class of bug

Here is what makes this genuinely hard. Every one of these failures is a **connectivity** problem between power
domains, and ordinary RTL simulation cannot see any of them.

Normal simulation has no concept of voltage. Every one is a one. Every block is always on. A missing level
shifter simulates perfectly. A missing isolation cell simulates perfectly. An isolation cell on the wrong supply
simulates perfectly. A clamp of the wrong polarity simulates perfectly, because in normal simulation the block
never turns off.

So these bugs must be found by different means.

**Static checks** read the netlist and the power intent together and check every crossing structurally: every
low-to-high crossing has a shifter, every crossing from a switchable domain has isolation, every isolation cell
is powered by a supply that is on when needed, every control signal comes from a suitable domain. These checks
are fast and complete, and they are the first line of defence.

**Power-aware simulation** — yesterday — switches domains off in simulation and forces their signals to unknown,
so a missing isolation shows up as unknowns spreading into the always-on logic. It is how you catch sequencing
bugs: isolation released too early, a domain switched off while something still needed it.

**And the clamp-value bug** needs the one thing tools cannot supply: someone who knows what each signal means.
It is caught by review, by a power-aware simulation that actually powers the domain down and checks the
neighbour's behaviour, and by assertions — "the interrupt is never asserted while its source domain is off".

## Where things go wrong in practice

A short catalogue, because these recur on every multi-voltage chip.

**A signal added late** that crosses a domain boundary, never added to the power intent, and therefore never
given a shifter or isolation.

**A signal that crosses through a third domain** — from A, through a buffer placed in B, to C — where B can be
switched off, severing the connection even though A and C are both on.

**Feedthroughs** — wires that pass through a block's physical area on their way somewhere else, placed in that
block's power domain by the layout, and dying when it powers down.

**And clocks and resets crossing domains**, which need shifting and isolation like any other signal, and whose
isolation values must be chosen with particular care — a reset clamped to its active value holds the receiver in
reset while the sender sleeps, which is sometimes exactly right and sometimes a disaster.

## The cost

Level shifters and isolation cells on every crossing, in area and delay. Timing analysis across multiple voltages.
A second kind of verification — structural power checks and power-aware simulation — alongside all of Season 4. And
a new document that must stay in step with the RTL, which is episode seven.

Against that, the square-law saving on voltage, which is too large for any power-conscious chip to leave on the
table.

## The one thing

Every wire that crosses between power domains needs two questions answered: can the receiver understand the voltage,
and what does it see when the sender is off? Level shifters answer the first, isolation cells the second — powered by
the right side, controlled from the right side, clamped to the right value — and a missing answer is a connectivity bug
no ordinary simulation will ever show.

## Commute exercise

A block runs at one volt and five hundred megahertz. Someone proposes running it at eight-tenths of a volt instead.

On the way home, estimate what happens to its switching power, from episode one's formula, if the frequency stays the
same. Then accept that at the lower voltage, the transistors are slower, and the block can now only close timing at, say,
four hundred megahertz. What happens to switching power now?

Then change the question. The block has a fixed amount of work to do — a million operations. At the lower voltage and
frequency, it takes longer. What happens to the **energy** for the whole job — not the power, the energy?

And the question worth the drive: if running slower and at lower voltage saves energy per operation, why would anyone
ever run at the higher voltage? And what if the voltage could be changed **while the chip is running**, depending on how
much work is waiting?
