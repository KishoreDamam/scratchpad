---
season: 5
episode: 8
title: Closing timing, part two
runtime: about 11 minutes
prerequisites: s1ep05, s3ep02, s3ep09, s5ep07
one_thing: When restructuring cannot close it, the architecture must change — add latency, add parallelism, or relax the requirement. Admit it early, because every week you spend pretending otherwise makes the change more expensive.
---

> Production note: the "admit it early" section is the emotional core. Tell it as
> a story of a project three weeks too late, without naming anyone.

## Where we are

Yesterday's accumulator.

No chain to rebalance — it is one adder. No late arrival — both inputs are ready at the start of the
cycle. No fanout to split. And pipelining the adder breaks the loop: with a register in the middle, the
total from this cycle is not available to be added to next cycle's value, because it is still halfway
through the adder. Season 1 episode five: a loop runs at the speed of the whole loop, and latency inside
it is not throughput, it is a stall.

What can change? Season 3 episode nine: **a hazard exists when the dependency distance is shorter than
the pipeline depth.** So increase the dependency distance. Keep **two** running totals instead of one —
even-numbered values go into the first, odd-numbered values into the second. Now each total is only
updated every other cycle, so its adder has **two cycles** for its loop. Pipeline that adder freely. At
the end, add the two partial totals together.

Same final sum. Different circuit, doing different things cycle by cycle. And that is the line between
yesterday and today: **yesterday's fixes preserve behaviour; today's change it**, while preserving the
answer that matters.

## The problem

Every project reaches a point where the free fixes are used up.

The easy paths have been restructured. Fanouts have been duplicated. Outputs are registered. The total
negative slack has come down from thousands to hundreds — and stopped. The remaining failures are
spread across a whole block, or concentrated in a loop that nothing from yesterday touches, or they are
the consequence of the block simply doing too much work per cycle.

And the pressure at this point is enormous, because what comes next is visible. It changes latency,
which changes protocols, which changes other people's blocks. It changes the architecture document.
It may change the specification.

So what engineers do, very often, is keep trying free fixes. One more tool option. One more manual
tweak. Another week.

## The turn

When restructuring cannot close timing, there are only **three** things left. It is worth knowing that
the list is short, because it turns a vague sense of trouble into a choice between three options.

## One: add latency

Put more registers in the path. More pipeline stages, each doing less work.

For a feed-forward path — no loop — this is always possible, and it is exactly Season 1 episode five:
buy throughput with latency. The clock goes up, the throughput goes up, and every item takes more cycles
to get through.

What it costs is everything that depends on latency. **Protocols**: a block that promised an answer in
three cycles now answers in five, and every block expecting three must change. **Buffering**: Season 3
episode three — bandwidth times delay — so any buffer covering this block's round-trip latency must grow.
**Credits**: Season 3 episode five — the credit count equals the round-trip, so it grows too.
**Loops elsewhere**: if this block sits inside a larger feedback loop — a request and its response, a
flow control signal — the loop just got longer, and Season 3's dependency distance rules apply at the
system level.

Which is why the most useful habit in all of timing closure is designing interfaces **latency-insensitive**
from the start. Valid and ready, from Season 1 episode eight, does exactly that: nothing upstream or
downstream assumes a fixed number of cycles. Add a pipeline stage to a valid-and-ready block and its
neighbours do not notice. Add it to a block with a fixed-latency protocol and three teams have work.

## Two: add parallelism

Do the same work with **more hardware at a lower rate**, or interleave independent work to break
dependencies.

The accumulator was this: two partial totals, interleaved. More generally, Season 3 episode two's
cycle-accounting dial. If a stage processes one item per cycle at five hundred megahertz and cannot close,
two copies of that stage each processing one item every two cycles do the same work, and each copy has
two cycles to do it — a **multicycle path by design**, with episode five's pair of constraints and its
assertion, and a hardware guarantee because the controller alternates between the two copies.

Parallelism costs area — sometimes double — and a controller to distribute and collect the work, and
sometimes reordering logic if the copies finish in a different order from how they started.

And it is especially the answer for **loops**, because latency cannot be added inside a loop without
stalling it. Loops yield only to interleaving — multiple independent loops sharing the hardware — or to
mathematical restructuring. **Carry-save** arithmetic is the classic example of the second: it keeps an
accumulator in a redundant form, two numbers whose sum is the total, so the loop never has to wait for a
carry to propagate. The full addition happens once, at the end, outside the loop.

## Three: relax the requirement

Lower the clock. Or reduce what the block must do per cycle. Or accept a lower throughput.

This is the one people resist most, and it is often the correct one. Season 1 episode eleven said the
budgets generate the design. If the budget was wrong — if the clock was chosen before anyone knew what
this block would have to do inside a cycle — then the honest fix is to the budget, not to the design.

Sometimes that means a different clock for this block, with a crossing to the rest of the chip. That costs
a clock domain and Season 1 episode seven's synchronisers, and Season 6's signoff checks. Sometimes it
means going back to the architecture document and asking whether the throughput requirement is real or
inherited from a spreadsheet nobody remembers building.

## Admit it early

Now the part of today that matters most, and it is not technical.

Here is a story that happens on real projects, in some form, constantly. A block misses timing by fifteen
percent. The designer is confident the free fixes will get there. Week one, they get halfway. Week two, a
few percent more. Week three, nothing moves. Now it is clear that a pipeline stage is needed — which
changes the latency, which affects two neighbouring blocks, which have by now been verified against the
old latency, and whose testbenches must change, and whose regressions must be re-run. The fix that would
have cost a week in week one costs six weeks in week four.

The lesson is general, and Season 3 said it first: **architectural changes get more expensive with every
day that passes**, because other people build against the current architecture. So the decision to
re-architect should be made **as early as the evidence allows** — not as late as hope allows.

And there is a practical rule for recognising the moment. After the obvious restructuring, look at two
numbers. If the **worst slack** is a small fraction of the period and the **total slack** is small, keep
going with free fixes; you are close. If the worst slack is a large fraction of the period — twenty or
thirty percent — or the failures are spread across thousands of endpoints, no amount of local work will
close it. The block is doing too much per cycle. Say so, out loud, this week.

The hardest part is social. Saying "we need another pipeline stage" is saying "my block will cost other
people work". It is much easier to say that when the block's first synthesis run happened in month two, not
month eight. Which is the other argument for Season 3 episode eleven's modelling and for synthesising early
and often: **the earliest timing estimate, however rough, is worth more than a precise one delivered too
late to act on.**

## The cost

Every option today costs something that yesterday's did not. Latency costs protocols and buffers.
Parallelism costs area and control. Relaxing costs performance, or a clock domain, or a conversation about
the specification.

And the choice among them is not a timing decision. It is an architecture decision, which means it belongs
in the architecture document, with its reasons — so that the next person to look at the extra pipeline
stage knows it is there on purpose and what it cost.

## The one thing

When restructuring cannot close it, the architecture must change: add latency, add parallelism, or relax the
requirement. Design interfaces to be latency-insensitive so the first option is cheap — and admit the change
early, because every week you spend pretending otherwise makes it more expensive.

## Commute exercise

A wide bus — five hundred and twelve bits — must travel from one side of the chip to the other. Five
millimetres. The clock is one gigahertz: one nanosecond per cycle.

On the way home, work out whether it can get there in one cycle.

Assume, very roughly, that a well-buffered wire on this process covers about one millimetre in a hundred and
fifty picoseconds. How long does five millimetres take? How much of the nanosecond is left for anything else —
the launching register, the capturing register's setup, the clock uncertainty?

Then decide how many cycles it should take, and where the registers go.

And then the question worth the drive. **Who should have known this, and when?** The number of cycles to cross
that distance was calculable from the floorplan before a single line of RTL was written. Whose document should
it have been in — and what happens to the design if it is discovered only after layout?
