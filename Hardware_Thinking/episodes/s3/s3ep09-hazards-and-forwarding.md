---
season: 3
episode: 9
title: Hazards and forwarding
runtime: about 14 minutes
prerequisites: s1ep05, s2ep05, s3ep02
one_thing: When the dependency distance is shorter than the pipeline, you stall, forward, speculate — or interleave independent work until the distance exceeds the depth.
---

> Production note: the interleaving section is the one non-processor designers will
> actually use. Give it room and do not present it as an afterthought.

## Where we are

Yesterday's two directions, and they need different operations.

The processor prepares a buffer: the data is dirty in its cache, memory is stale, so the
accelerator reads rubbish. The fix is a **flush** — write the dirty lines out — and it
must happen *before* the accelerator starts.

The accelerator writes a result: memory is correct, but the processor still holds old
copies. The fix is an **invalidate** — throw those copies away — and it must happen
*after* the accelerator finishes and before the processor reads.

Flush before, invalidate after. Two different operations in two different places, and
getting one right while forgetting the other is one of the most common bring-up bugs in
any system with an accelerator.

Then the judgement. Non-cacheable is always a little slow and *cannot* be forgotten.
Software-managed coherence is fast and fails silently, rarely, and data-dependently when
somebody forgets — on a new code path, added later, by somebody who never read the
contract.

So on debuggability, non-cacheable wins decisively. A failure that cannot occur beats a
failure that occurs once a fortnight and takes three weeks to attribute. That is a
recurring principle worth stating plainly: **prefer the design where the failure is
impossible over the design where the failure is merely unlikely**, and pay real performance
for it unless you can show you cannot afford to.

Today: what happens when the items in your pipeline are not independent after all.

## The problem

Season 1 episode five sold you pipelining with a condition attached, and the condition was
independence. Cars on an assembly line do not care about each other.

Real work cares.

Three situations, all common, all the same shape.

An accumulator: this cycle's sum needs last cycle's sum.

A filter with feedback: this output depends on previous outputs.

A processor pipeline: this instruction wants the result of the one two ahead of it, which
has not finished yet.

In each case the pipeline is deep — say five stages — and the dependency is *short*: the
next item needs the previous item's answer, and the previous item's answer will not exist
for four more cycles.

That gap is the whole subject. Call it the **dependency distance**: how many items apart
the producer and consumer of a value are. And the rule that governs everything today:

**If the dependency distance is greater than the pipeline depth, you have no problem at
all. If it is shorter, you have a hazard.**

## Naming the three hazards

Worth having the vocabulary, because these words come up in every design review involving a
pipeline.

**Structural hazard.** Two items in flight need the same physical resource in the same
cycle. One multiplier, two stages wanting it. Nothing to do with data — it is a scheduling
conflict, and the fix is either another copy of the resource, or a rule about who gets it,
which is Season 2 episode nine's arbitration inside your own pipeline.

**Data hazard.** An item needs a value that an earlier item has not finished producing.
This is the one people mean when they say hazard. Its proper name is read-after-write, and
it is the real and unavoidable one, because it reflects a genuine dependency in the work.

You will also hear about write-after-read and write-after-write. Those are not real
dependencies in the mathematics — they are artefacts of reusing the same storage location,
and they only appear when you allow things to happen out of order. If you ever find yourself
dealing with those, you have built something that reorders, and that is an enormous
step up in complexity.

**Control hazard.** You do not know what the *next* item is until the current one resolves.
A branch in a processor. In a general design: a state machine whose next state depends on a
comparison result that is three stages down the pipe. You cannot start the next item because
you do not yet know which item it is.

## The three fixes

**Stall.** Freeze the pipeline until the value is ready. Always correct, trivially simple,
and it costs exactly the throughput you were trying to buy. Four cycles of stall on a
five-stage pipeline with a distance-one dependency means you are running at one item every
five cycles — you have paid for a pipeline and got a sequential machine.

Stall is the right answer when the hazard is rare. If it happens one time in a thousand,
four wasted cycles costs you nothing measurable, and any cleverer fix is area spent on
nothing. **The frequency of the hazard decides which fix is correct**, and that means
measuring — which is episode eleven.

**Forward.** Also called bypass, and it is a lovely idea.

The value you need does exist. It is not in its final destination yet — it has not been
written back to the register or the memory — but it has been *computed*, and it is sitting in
a pipeline register two stages down. So run a wire from there back to where it is needed, and
take it from where it is rather than from where it will eventually be.

The hazard disappears and no cycles are lost. Which sounds free, and here is what it
actually costs.

You have added a mux in front of the stage's input, selecting between the normal source and
each bypass path. That mux sits **immediately before your arithmetic** — which is to say, at
the front of what is very likely your critical path. Season 2 episode seven: a mux with five
inputs written as a priority chain is five levels deep, right where you can least afford it.

So forwarding trades cycles for combinational depth, in the worst possible location. And the
paths multiply: with a deep pipeline and several stages that might need several earlier
results, the number of bypass paths grows with roughly the square of the depth. A fully
bypassed deep pipeline is a mass of wires converging on one point, and it is frequently the
thing that caps the clock.

The discipline, therefore: **bypass the paths that measurement says are frequent, and stall
on the rest.** A design that bypasses everything is usually slower overall than one that
bypasses the common case and accepts a stall for the rare one, because the clock is set by
the worst path and the worst path is now the bypass network.

**Speculate.** For control hazards. Guess which item comes next, start it, and if you
guessed wrong, throw away everything you started and begin again.

This is what branch prediction is, and it works because guesses can be very good. The costs
are two, and the second is the one to be careful of.

The obvious cost is the **flush**: when wrong, you discard the work in flight, so the penalty
is roughly the pipeline depth. Deep pipelines punish misprediction harder, which is one of
the reasons pipelines are not made arbitrarily deep.

The subtler cost is that you must be able to *undo*. Nothing speculative may have a visible
effect — no memory written, no state committed, no output emitted — until the guess is
confirmed. That means every side effect needs holding back, and the mechanism that holds it
back and then either commits or discards is substantial control logic that only runs on the
uncommon path.

Which is Season 1 episode five's warning, sharpened: **your recovery logic is the least
tested logic in the design.** It activates only on misprediction, only in specific states,
and a test bench that mostly predicts correctly will barely exercise it. Verify the recovery
path deliberately, with stimulus designed to mispredict constantly.

## The fourth fix, which nobody teaches

Now the one I most want you to have, because it is the fix that applies outside processors
and it is consistently underused.

**Interleave independent work.**

The hazard exists because the dependency distance is shorter than the pipeline depth. There
are two numbers in that sentence, and every technique so far attacks the depth. Attack the
other one.

Suppose you have a five-stage accumulator pipeline and a distance-one dependency — hopeless.
Now suppose you have *five independent streams* to accumulate. Feed them into the pipeline
round-robin: stream one, stream two, three, four, five, then stream one again.

Now, when stream one's second item enters the pipeline, stream one's first item has had five
cycles to get all the way through. **The dependency distance is now five, the depth is five,
and there is no hazard at all.** No stall, no bypass, no speculation. Full throughput, one
item per cycle, from a deeply pipelined machine with a tight feedback loop in it.

The cost is exactly one thing: **you keep state per stream.** Five accumulators instead of
one, five sets of filter history, a wider memory indexed by stream. And you need genuinely
independent work to feed it.

But look how often you do. Multiple channels of audio. Multiple video planes. Multiple
packet flows. Multiple connections. Multiple pixels of the same image where the filter is
independent per pixel. Most streaming hardware has natural parallelism sitting right there,
unused, while somebody agonises over a bypass network.

This is the same idea as hardware multithreading in processors, and in the FPGA world a
related transformation is sometimes called C-slow retiming. The principle is simple enough to
carry: **if you cannot shorten the pipeline, lengthen the dependency distance by interleaving
independent work.**

And notice it composes with episode two's budget. If you have a thousand cycles per item, you
have room to deeply pipeline one shared unit and interleave many streams through it — which
is both the fastest and the smallest design, and it was visible from the very first division
you did.

## The cost

Hazard handling is where pipelines stop being elegant. Every fix costs something specific:
stalling costs throughput, forwarding costs critical path and a wiring mess, speculation
costs a recovery mechanism you cannot easily test, and interleaving costs state per stream
plus the requirement that independent work exists.

There is also a documentation cost that gets skipped. A pipeline with hazard handling has a
*contract*: how many cycles before a result is usable, what happens on a stall, which
combinations of back-to-back operations are supported at full rate. That contract must be
written down, because the next person to use your block will assume it has none.

## The one thing

A hazard exists when the dependency distance is shorter than the pipeline depth. Stall if
it is rare, forward the frequent paths only, speculate if you can afford to undo — and
before any of those, ask whether you can interleave independent work until the distance
exceeds the depth.

## Commute exercise

A five-stage multiply-accumulate pipeline. One multiply and one add, five cycles from input
to result available. You are accumulating a sum: each item adds to the running total.

On the way home: what throughput do you get if you just stall? Express it as items per
cycle.

Then: can you forward? Think carefully about *where* the running total exists and whether
taking it early is legal — there is a specific stage after which the value is genuinely
complete.

Then the interleaving version. You have sixteen independent channels to accumulate. What
throughput now, and what extra storage does it cost?

And finally the arithmetic that makes the point. Suppose you need to accumulate a single
stream of a million values, and you have five stages of latency. Work out the time with
stalling. Then work out this: split the one stream into five partial sums — item one, six
and eleven into the first, item two, seven and twelve into the second, and so on — accumulate
the five in an interleaved fashion, and add the five partial sums together at the very end.

How long does that take? And notice that you have just turned a hopeless serial dependency
into a full-rate pipeline by changing nothing but the order in which you add numbers up.
