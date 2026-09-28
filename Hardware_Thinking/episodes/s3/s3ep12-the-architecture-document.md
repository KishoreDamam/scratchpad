---
season: 3
episode: 12
title: The architecture document
runtime: about 13 minutes
prerequisites: all of season 3
one_thing: The document's job is to pin down what is expensive to change and leave everything else open. Its test is whether two engineers reading it separately build blocks that connect.
---

> Production note: season finale. Recap the twelve one-things as a single run. End on the
> lab project.

## Where we are

Yesterday's last question: argue against making the display buffer a hundred and
twenty-eight entries when sixty-four is the computed answer.

The area and the power are the obvious costs, and they are the weaker half of the argument.

The first real cost is **latency**. A deeper prefetch buffer means the display is showing
data that was fetched further in advance. For a passive video output, nobody cares. For
anything interactive — a user interface responding to touch, a camera preview, a head-mounted
display where latency is measured against somebody's vestibular system — that buffer is
directly in the specification, and doubling it may violate it.

And the second cost is the one worth carrying, because it is a general principle:

**Buffering hides the symptom of an inadequate bandwidth budget.**

A generous buffer will absorb a shortfall during testing and pass. Then the design meets
worst-case real traffic — a busier system, a different workload, a slower memory part than the
one you had on the bench — and it fails in the field, and the failure looks like a mysterious
glitch rather than the arithmetic error it actually is. The right-sized buffer fails *in the
lab*, loudly, while somebody can still fix the budget.

That is Season 2 episode eight's rule with teeth in it: a buffer absorbs a burst, it cannot
fix a rate. An oversized buffer does not fix a rate either — it just delays the discovery.
And "delays the discovery" is, in this field, another way of saying "multiplies the cost".

Today: the document that holds all of this, and then the season.

## The problem

You have done the work of this season. You have rates, working sets, module boundaries, cycle
budgets, buffer depths with arguments behind them, a traffic matrix, a topology, an
arbitration policy, models that were swept and calibrated.

Almost all of it is in your head.

And that is a genuine engineering failure, for three reasons that have nothing to do with
tidiness.

**Ten people cannot build against your head.** Every decision you made implies a constraint on
somebody else's block, and they cannot discover those by reading your RTL, because your RTL
does not exist yet and when it does it will not explain *why*.

**Your head is not durable.** In six months you will not remember whether that threshold was
computed or guessed. In eighteen months you may not be on the project.

**And an undocumented decision cannot be challenged.** This is the important one. The
arithmetic you did is probably right, and some of it is wrong, and the only mechanism that
finds out which is somebody else reading it. A decision that nobody can see is a decision that
nobody can correct.

## The turn: what it must contain

Nine sections. This is not a template I am inventing for the sake of it — each one exists
because leaving it out has a specific, observed consequence.

**One: what it does, in one paragraph, and what it explicitly does not do.**

The second half matters more. A stated non-goal is a decision; an unstated one is a fight
later. "This block does not handle fragmented packets. It does not support runtime
reconfiguration of the coefficient set. It does not implement the optional modes of the
standard." Each of those sentences prevents a conversation in month five.

**Two: the budgets.** Season 1 episode eleven and episode two of this season. Bytes per
second at every interface, bytes stored and in which tier, cycles per item per module, area,
power.

**And the assumptions next to them.** A budget without its assumptions is a number that will
be quoted at you by somebody who does not know what it depended on.

**Three: the block diagram with named interfaces.** From episode one. Modules, rates, working
sets, and every interface named with its protocol.

This is the section people actually read, so it is worth making good — one page, legible, with
the rates on the arrows.

**Four: the clock, reset and power domain map.** Season 2 episode three, and Season 6 in full.
Which clocks exist, which blocks live in which, where every crossing is and what structure
implements it, how reset is asserted and released per domain, and in what order the domains
come up.

Every crossing, listed. If a crossing is not in this document it does not exist, and if it
exists and is not in this document, that is a defect.

**Five: the address map and register map.** Where everything lives, which blocks decode what,
and which registers exist with their fields and reset values. Ideally generated from a machine
-readable source — Season 7 episode seven — so the document, the RTL and the software header
cannot disagree.

**Six: the arbitration and quality-of-service policy.** Season 2 episode nine's one paragraph
that costs nothing and saves weeks: **for each requester, its bandwidth share under saturation
and its worst-case wait.** Two numbers per requester. Without them the arbiter gets designed by
whoever integrates, and the behaviour under load is discovered by measurement.

**Seven: latency and throughput per interface.** Both numbers, separately, because Season 1
episode five spent an episode establishing that they are different and people still quote one
when they mean the other. And the initiation interval where it differs from the latency —
episode two.

**Eight: the ordering and coherence contract.** Episode eight. What is guaranteed about the
order in which things complete, what software must do to see a consistent view, who is
responsible for flushes and invalidates. This is the section that, when missing, produces the
bug that takes three weeks to attribute.

**Nine: open questions, each with an owner and a date.**

This is the section that distinguishes a live document from a monument. Not everything is
decided. Write down what is not, who will decide it, and by when — because an open question
with an owner is a project management item, and an open question without one is a landmine.

And then, feeding Season 4: what claims must be *proven* about this design. The verification
plan's input.

## What not to put in it

Equally important, because the main way architecture documents fail is not by being thin. It
is by being fat and therefore stale and therefore ignored.

**No implementation detail.** If it is visible in the RTL and does not constrain anybody else,
it does not belong here. Whether your state machine is one-hot is not architecture.

**Nothing that will go stale faster than it is useful.** Signal-level tables that change
weekly. Exact pipeline stage counts inside a block. If a section needs updating every time
somebody edits a file, it will not be updated, and its wrongness will discredit the rest.

Which gives you the governing principle, and it is the one thing from today:

**Pin down what is expensive to change. Leave open what is cheap.**

Interfaces, clock and power domains, budgets, ordering rules, arbitration policy, address map
— all expensive, all documented, all decided early even when the information is incomplete.

Internal structure, encodings, exact pipeline depths, the shape of any given state machine —
all cheap, all deliberately left to the block owner.

That principle keeps the document short enough to stay current, which is the only property that
determines whether it gets read.

## The test

One test, and it is worth using literally.

**Two engineers read the document separately and build the blocks on either side of an
interface. Do the blocks connect?**

Not "is it comprehensive" — comprehensive documents are usually unread. The question is whether
the parts that constrain other people are unambiguous. If two competent readers can produce
incompatible blocks, the document has failed at its one job, and the ambiguity is exactly the
thing to fix.

Run that test in review, deliberately, on the interfaces that matter. It takes twenty minutes
and it finds things.

## Season 3 in twelve sentences

**One.** Cut the design where the rate changes or the working set changes.

**Two.** Clock rate over item rate is your budget, and it sets the area-time dial for you.

**Three.** Latency you cannot remove, you can cover — for storage equal to bandwidth times
delay.

**Four.** When the unit of dependency is a block, use two buffers and an ownership handshake.

**Five.** Credits turn round-trip delay from a correctness problem into a throughput problem.

**Six.** Write the traffic matrix; most cells are empty, and the topology is what connects the
rest.

**Seven.** A cache is a bet on reuse, and if you can predict, prediction is cheaper.

**Eight.** Coherence is a distributed protocol whose real cost is the state space you must
verify.

**Nine.** A hazard exists when the dependency distance is shorter than the pipeline depth.

**Ten.** A module boundary is a timing, verification, ownership and physical boundary at once.

**Eleven.** Two models: bit-accurate without timing, and timing-approximate without bit
accuracy.

**Twelve.** Document what is expensive to change and leave the rest open.

## The lab project

Before Season 4, build one thing, in this order, and the order is the point.

**Write the document first.** Two or three pages, using the nine sections, for a streaming
block of your choosing — something with a rate change and a working set larger than one item.
A scaler, a filter chain, a packet framer, a small DMA engine.

**Then write the functional model**, in Python or C, from that document. Bit-accurate, no
timing, obviously correct.

**Then the performance model**, separately, and use it to pick your buffer depths and confirm
your cycle budget. Sweep at least one number you are unsure of.

**Then the RTL**, using Season 2's habits — and then verify it against the functional model you
already have.

The discipline being practised is the sequence. Most people write the RTL and then work
backwards to a document nobody reads and a reference model that agrees with the implementation
because it was derived from it. Doing it forwards feels slower for about a week, and then it is
faster forever, for a reason worth stating plainly: **every architectural mistake you make will
be found by the document or the model, both of which cost hours to change, rather than by the
RTL, which costs weeks.**

That is the whole argument for this season.

## Where Season 4 goes

You now have a design you can defend and a reference model that is independent of it.

What you do not have is proof. Season 4 is verification in the languages and frameworks the
industry actually uses — constrained random, functional coverage, assertions, scoreboards,
UVM, formal — and it is the season that decides whether anybody else is willing to trust the
blocks you build.

## The one thing

Pin down what is expensive to change, leave open what is cheap, and test the document by
asking whether two people reading it separately would build blocks that connect.

## Commute exercise

The last one of the season.

Take a block you have actually worked on, or one you know well. On the way home, go through the
nine sections out loud and ask, for each one: *did this exist, in writing, before the RTL was
written?*

Be honest. Most designs score three or four.

Then, for each missing section, work out what it cost — because it cost something. An
undocumented ordering contract cost somebody a debugging week. An undocumented arbitration
policy cost a performance surprise. An undocumented set of non-goals cost an argument in month
five.

And then the question to actually act on: of the nine, which one would have been **cheapest to
write and saved the most**?

Write that one, this week, for whatever you are working on now. Not all nine — one. That is a
realistic change and it will do more for your next project than the rest of this episode.

Thanks for the season.
