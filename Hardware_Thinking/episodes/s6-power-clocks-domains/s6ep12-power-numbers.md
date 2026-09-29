---
season: 6
episode: 12
title: Power numbers
runtime: about 14 minutes
prerequisites: all of season 6
one_thing: A power estimate is a structure of terms, each with its assumption, given as a range. Estimate early, refine as the design firms up, calibrate against something real — and your credibility rests on the assumptions being visible, not on the number being right.
---

> Production note: season finale. Recap the twelve one-things as a single run. End on
> the lab project and the domain map.

## Where we are

Yesterday's block, with no RTL yet, and a manager who needs a power number this week.

The structure of the estimate is episode one's three enemies, broken into the pieces of episode one's
budget.

**Clock power**: the number of flip-flops, times the energy each one's clock pin costs per cycle,
plus the clock tree feeding them, times the frequency. Four thousand flops at five hundred megahertz.
And here, thirty percent busy matters only if the clock is gated when idle — episode two — so the
estimate needs an assumption about gating efficiency.

**Register and logic power**: the flops' data toggling and the logic between them — an assumed
activity, times an energy per toggle, times the number of nodes. Thirty percent busy matters directly
here, because idle logic, properly isolated, does not toggle.

**Memory power**: accesses per second, times energy per access, for each memory, plus each memory's
leakage. The access rate comes from the algorithm; the energies come from the memory compiler's data
sheet.

**Leakage**: the whole block's area — estimated from the flop and logic counts — times a leakage per unit
area for the process, at the operating temperature. Thirty percent busy changes nothing here, unless the
block is power-gated when idle.

And how wrong can it be? Early estimates are commonly off by a factor approaching two in either direction.
That is not useless — it is enough to know whether the chip's power budget is plausible. What makes it
usable is stating it as a **range**, with the **assumptions** that drive it, so the person using it knows
which number to challenge.

Today: how to produce power numbers and how to defend them.

## The problem

Of all the specifications a chip must meet, power is the one most often discovered rather than designed.

Function is verified. Timing is checked exhaustively by static analysis. Area is known the moment synthesis
runs. But power depends on **what the chip is doing** — which workload, which blocks are active, how long it
sleeps — and on things that are not known until very late: the real clock tree, the real wires, the real
activity of real software.

So the common pattern is that power is estimated once, crudely, at the start; ignored through most of the
project; and measured on silicon, where it is too late to change anything but the software.

And the person who gave the early estimate is asked, at that point, why it was wrong.

## The turn

The turn is to treat a power estimate like any other engineering model — Season 3 episode eleven's
performance model is the right comparison. It is a **structure of terms**, each with a stated **assumption**,
refined as information arrives, and **calibrated** against reality whenever reality becomes available.

## Early: the spreadsheet

Before RTL, a spreadsheet — and, as Season 3 said, you should not be embarrassed by that.

One row per term from this morning. For each: the **count** — flip-flops, gates, memory bits, accesses per
second. The **energy per event** — from the library, the memory data sheets, or previous chips on the same
process. The **activity** — how often each event happens, in each operating mode. And the **leakage** per unit
of each.

Multiply, sum, per mode: active, idle, sleep. The result is a table, not a number — power in each mode, because
Season 6 has shown that a chip spends its life moving between modes and the battery sees the weighted average.

And for each input, the **assumption and its source**. "Activity of fifteen percent: assumed from a similar block on
the previous chip." "Clock gating efficiency of eighty percent: typical for this style of design." "Leakage at eighty-
five degrees: from the foundry's model." Every one of those is something a reviewer can challenge, which is exactly
the point.

## The dominant terms

Episode one's ranking is worth recalling here, because it tells you where the spreadsheet's precision matters.

The clock and the memories usually dominate dynamic power. Leakage dominates sleep. Logic is often smaller than people
expect. So get the clock and memory terms right, spend little time on precise logic estimates, and make sure the
leakage assumption at the right temperature is realistic — because for a mostly idle device, that one number decides the
battery life.

## Middle: activity from simulation

Once RTL exists, the spreadsheet's biggest weakness — assumed activity — can be replaced with measurement.

Run a **realistic workload** in simulation and record how often every signal toggles. Power analysis tools take those toggle
rates, combine them with the synthesised netlist's capacitances and the library's energies, and estimate power per block, per
module, even per signal.

That is far more accurate than a guess. It is also only as good as the workload. Episode three's warning and Season 3 episode
eleven's: a synthetic test that exercises everything uniformly will produce a power number that describes nothing real. Use traces
from real applications — the video decode, the idle screen, the network burst. And measure the **idle** modes as carefully as the
busy ones, because they are where the chip spends most of its time.

## Late: after layout

After layout, the clock tree is real, the wires are real, the capacitances are extracted. Power estimates now approach measurement,
and the remaining uncertainty is almost entirely the workload.

At this stage, two new numbers matter, and they are not averages.

**Peak power**, or more precisely **peak current**. The power grid — the network of metal delivering supply to every cell — must carry
the worst instantaneous current without the voltage sagging too far. A sag slows every cell on the chip and can cause timing failures that
exist only during bursts of activity. That is called **IR drop**, and it is analysed separately, from the worst-case activity, not the
average.

**Rate of change of current**. When a large block wakes up — episode four's rush current — or a large clock domain is ungated all at once,
current demand rises very quickly, and the package's inductance resists it, causing the supply to dip. Staggered wake-up and gradual ungating
exist to limit this.

Average power decides the battery and the heat. Peak current and its rate of change decide whether the chip works at all during a burst.

## Calibrate

Throughout, one discipline makes the difference between a credible estimate and an opinion: **compare against something real** whenever you can.

The previous chip on the same process: estimate its power with the same spreadsheet, and compare with what was measured. If the spreadsheet was
thirty percent low last time, it is probably thirty percent low this time, and now you know.

Silicon measurements from test chips. Power-analysis results from the RTL once it exists, fed back into the spreadsheet to correct its assumptions.

Season 3 episode eleven said: a model that has never been compared against the real thing is an opinion in a spreadsheet's clothing. Power estimates are the
most extreme case.

## Defending the number

And now the part that is not technical at all.

Somebody will quote your early number back at you, months later, when the real number is different. That is inevitable. What decides whether you keep your
credibility is not whether the number was right. It is whether the assumptions were **visible**.

"I estimated between one hundred and eighty and three hundred milliwatts, assuming fifteen percent activity and eighty percent gating efficiency. We now measure
twenty-five percent activity, which accounts for the difference." That is a defensible engineering statement. The estimate was wrong in a known way, for a known
reason, and the correction is obvious.

"I said two hundred milliwatts." That is a number with nothing behind it, and when it is wrong, the only conclusion anyone can draw is that you were wrong.

So always give a **range**, always list the **top three assumptions** by sensitivity, and always say **when the estimate will next improve** — after RTL, after
synthesis, after layout. It is Season 4 episode twelve's one-page statement, one more time: what we know, what we do not, and why the gap is acceptable for now.

## Season 6 in twelve sentences

**One.** Switching, short-circuit and leakage are three enemies, and you cannot fix one with the other's tools.

**Two.** Clock gating is the highest-return technique, and you write the enable, never the gate.

**Three.** The cheapest operation is the one you do not perform — and architecture sets the budget.

**Four.** Power gating is the only cure for leakage: stop, save, isolate, switch off — and reverse.

**Five.** Every power crossing needs two answers: can the receiver understand it, and what does it see when the sender is off.

**Six.** Energy per operation goes with voltage squared; raise voltage before frequency, lower frequency before voltage.

**Seven.** Power intent lives in its own file, and it is a specification agreed with the people who know what signals mean.

**Eight.** A chip's clocks are a plan, and the cheapest crossing is the one the plan made unnecessary.

**Nine.** Reset is a sequence, not a signal — who, in what order, with which clocks, and what survives.

**Ten.** CDC signoff is structural and functional, and a clean report on a wrong clock plan proves nothing.

**Eleven.** An asynchronous reset is a crossing even inside one clock domain.

**Twelve.** A power estimate is a structure of terms with visible assumptions, given as a range.

## The lab project

Before Season 7, go back to your block.

**Add clock gating** — write clean enables, let the tool infer the gates, and measure the difference in power with a realistic workload,
using your tool's power analysis. Record the gating efficiency.

**Introduce a second clock domain deliberately.** Move part of the block onto an unrelated clock. Cross it properly: a synchroniser module for
single bits, a handshake for a control word, the asynchronous FIFO from Season 2 for the data stream.

**Run a CDC tool** — free and vendor tools exist — and read **every** finding. Waive nothing without a written reason.

**Run a metastability-injection simulation**, if your simulator supports it, and see whether anything breaks.

**Then draw the map.** One page: every clock domain, every reset domain, every power domain if you have more than one, and every crossing between
them, each labelled with the structure that makes it safe.

That map is the checkpoint for this season. If you can draw the clock, reset and power domain map of a design and defend every crossing on it,
you have what this season set out to teach.

## Where Season 7 goes

You can now build a block that is correct, fast enough, frugal, and safe at every boundary.

What you have not yet done is make it part of something larger. Season 7 is interfaces, IP and systems-on-chip: standard buses, register maps,
interrupts and DMA, and the discipline of building blocks that other people can integrate without talking to you.

## The one thing

A power estimate is a structure of terms, each with its assumption, given as a range. Estimate early, refine as the design firms up, calibrate against
something real — and your credibility rests on the assumptions being visible, not on the number being right.

## Commute exercise

The last one of the season.

Take a design you know. On the way home, draw its domain map in your head. Three layers.

**Clocks**: every one, and which blocks each drives.

**Resets**: every source, and which domains each reaches.

**Power**: every domain that can be switched or scaled independently.

Then walk every border between two regions that can be in unrelated states — different clocks, independent resets, independent power — and for each
signal crossing it, name the structure that makes it safe.

You will find at least one crossing where you cannot name the structure.

The question worth the drive: **is it safe for a reason nobody wrote down, or is it a bug nobody has triggered yet?** Find out which, this week. Either
answer is worth knowing.

Thanks for the season.
