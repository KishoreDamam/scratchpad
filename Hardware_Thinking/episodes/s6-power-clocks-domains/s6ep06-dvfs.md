---
season: 6
episode: 6
title: DVFS
runtime: about 11 minutes
prerequisites: s5ep02, s6ep01, s6ep05
one_thing: Energy per operation goes with voltage squared, so run as slowly and as low as the deadline allows — unless leakage makes it cheaper to finish fast and switch off. Change voltage and frequency in the safe order, and close timing at every operating point.
---

> Production note: the "voltage first going up, frequency first going down" rule
> should be said as a pair and repeated. The race-to-idle section is a genuine
> argument; let both sides speak.

## Where we are

Yesterday's arithmetic.

Drop from one volt to eight-tenths, same frequency: switching power goes with voltage squared, so it
falls to sixty-four percent. Now accept that the block only closes at four hundred megahertz instead
of five hundred: power falls by another fifth, to about fifty-one percent of the original. Half the
power.

But the job now takes longer — a quarter longer. Energy for the whole job is power times time: fifty-one
percent times one and a quarter is **sixty-four percent**. The frequency cancelled out. Switching energy
per operation depends only on voltage squared. Running slower, at lower voltage, genuinely does the same
work for less energy.

So why ever run fast? Two reasons. **Deadlines** — some work must finish by a certain time, and a slow
chip misses it. And **leakage** — the job took longer, and leakage is paid per second, so a longer job
pays more of it. Whether the saving on switching outweighs the extra leakage is not obvious, and it is
the argument at the heart of today.

And the voltage changing while the chip runs? That is exactly today's subject.

## The problem

A chip's workload is not constant. A phone is idle most of the time, then someone opens an application
and it needs everything at once, then it goes back to idle. A server is busy at midday and quiet at night.

If the voltage and frequency are fixed, they must be set for the **peak**: enough speed for the heaviest
moment. And then every other moment — which is most of them — runs at a voltage higher than it needs,
paying the square-law penalty for speed nobody is using.

## The turn

**Dynamic voltage and frequency scaling** — DVFS — changes the supply voltage and clock frequency while the
chip is running, to match the work waiting to be done.

Heavy load: high voltage, high frequency. Light load: low voltage, low frequency. And because energy per
operation goes with voltage squared, every moment spent at a lower voltage is a direct saving.

The voltage and frequency must move **together**. Frequency without voltage saves only a little — power
falls in proportion to frequency, but energy per operation does not change at all, because the job just
takes longer. Voltage without frequency is unsafe — at a lower voltage, transistors are slower, and the old
frequency may no longer meet timing. The saving comes from lowering both, and the safety comes from always
keeping them in a pairing that closes timing.

## Operating points

So the chip defines a small set of **operating points**: pairs of voltage and frequency that are known to
work. Perhaps four or five. The lowest for idle or background work; the highest for bursts.

Each pair was chosen because timing closes at that frequency, at that voltage, at every corner. Which means
Season 5's timing analysis is no longer run once. It is run at **every operating point, at every corner** —
often called multi-mode, multi-corner analysis — and the design must close at all of them. A path that only
fails at the lowest voltage, at the slow corner, is as real a failure as any other.

## Changing safely

Moving between operating points has one rule, and it is worth saying as a pair.

**Going up: raise the voltage first, then the frequency.**

**Going down: lower the frequency first, then the voltage.**

The reason is the same both ways: at no moment may the chip run at a frequency faster than its current voltage
supports. Going up, if you raised the frequency first, there would be a moment of high frequency at low voltage
— timing violations everywhere. Going down, if you lowered the voltage first, the same.

And each change takes time. A voltage regulator cannot move the supply instantly; it ramps, and the controller
must wait for it to settle. The clock change needs care too: a phase-locked loop may need to re-lock, which
takes time with no usable clock — so often the design switches to a different clock source, or to a divided clock,
through a **glitch-free clock multiplexer**, a special structure that switches between two clocks without ever
producing a truncated pulse. Season 1 episode seven's respect for clocks, again.

During the transition, the block either keeps running at the safe, lower frequency, or stalls briefly. Either way,
the transition has a cost in time and energy, and changing operating points too often wastes both.

## Who decides

Usually, **software**. An operating system component — often called a governor — watches how busy each processor
is, and chooses an operating point. Busy for a while: step up. Idle for a while: step down.

Hardware provides the mechanism — the regulator interface, the clock switching, the sequencing — and often a
**controller** that performs the safe sequence on request, so software only says "go to point three" and the
hardware handles the order and the waiting.

## Race to idle

Now the argument this episode promised, because it is genuine and the answer depends on the chip.

**Slow and steady** says: energy per operation goes with voltage squared, so run every job at the lowest voltage that
meets its deadline. Stretch the work out to fill the time available.

**Race to idle** says: run at full speed, finish as quickly as possible, and then **power-gate** the block — episode
four — so it stops leaking entirely. The job costs more switching energy per operation, but it runs for less time, so
it pays much less leakage, and then pays almost nothing at all while gated.

Which wins depends on the balance between switching and leakage.

When **leakage is small** relative to switching, slow and steady wins. The square-law saving dominates, and the extra
leakage from running longer is negligible.

When **leakage is large** — hot chips, fast leaky cells, modern processes — and the block can be power-gated when
idle, race to idle often wins. Every second of running is a second of leakage, and finishing fast then switching off
eliminates it.

And in between, the real answer is often both: run at a moderate operating point, finish, then gate. The energy-optimal
point depends on the chip's leakage at its temperature, which is why modern systems measure and model it rather than
guessing.

## Adaptive voltage

One refinement worth knowing.

Season 5 episode two's corners: some chips come out fast, some slow. An operating point's voltage has to be high enough
for the **slowest** chip at the worst corner. A fast chip at that voltage has margin it does not need.

**Adaptive voltage scaling** measures each chip — with on-chip monitors, small circuits whose speed tracks the real logic
— and lowers its voltage until the margin is just enough. Fast chips run at lower voltages than slow ones, for the same
frequency. The saving can be substantial, and it is per chip, per temperature, sometimes continuously adjusted.

For a front-end engineer, it means the monitors are part of the design, with their own verification, and the timing
signoff must account for the chip operating closer to its limits than a fixed voltage would allow.

## What it means for front-end

Three practical consequences.

**Interfaces between a scaling domain and a fixed one** must work at every ratio of their frequencies. If the ratio changes
at runtime, the two sides are effectively asynchronous — Season 1 episode seven's synchronisers, and Season 2 episode eight's
asynchronous FIFO, even if the two clocks come from the same source.

**Memories often have a minimum voltage** below which they cannot reliably hold data or be read. That frequently means memories
sit on their own supply, which does not scale as low as the logic, with level shifters between them — yesterday's crossings, now
with voltages that change.

**And every operating point is a new timing target**, which multiplies Season 5's work by the number of points. Choosing fewer
operating points is a real saving in signoff effort, and the architecture should choose them deliberately.

## The cost

A voltage regulator that can change quickly. Clock switching infrastructure. A controller for the safe sequence. Timing closure
at every point. Asynchronous interfaces where there might have been synchronous ones. And software that makes good decisions.

Against that, the square law applied to most of the chip's life — which, on a device that is idle or lightly loaded most of the time,
is an enormous saving.

## The one thing

Energy per operation goes with voltage squared, so run as slowly and as low as the deadline allows — unless leakage makes it cheaper
to finish fast and power-gate. Raise voltage before frequency and lower frequency before voltage, and close timing at every operating
point.

## Commute exercise

Take stock of this season so far. You now have power domains that can be switched off. Power switches and their sequencing. Isolation
cells with clamp values. Level shifters between voltages. Retention registers and which state they hold. Operating points. And a list of
which domains are on in which chip states — sleep, idle, active, and so on.

On the way home, ask: **where is all of this written down?**

Not in the RTL. Your RTL describes logic. It does not say which supply a block runs from, where the power switches are, which isolation
cell goes on which output, or which domains are on in the sleep state.

Then the question worth the drive: why is it deliberately *not* in the RTL? What would go wrong if designers wrote isolation cells and level
shifters directly into their Verilog — and what does keeping it separate make possible?
