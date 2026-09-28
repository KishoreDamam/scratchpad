---
season: 2
episode: 9
title: Arbiters
runtime: about 11 minutes
prerequisites: s2ep07, s2ep08
one_thing: An arbiter is where you decide who suffers. Fairness is a design decision, starvation is what happens when you skip it, and the symptom is a latency tail, not a wrong answer.
---

> Production note: the "wrong answer versus wrong distribution" distinction near the
> start is the frame for the whole episode.

## Where we are

Yesterday: a FIFO absorbs a burst and cannot fix a rate. Which leaves the question of
what happens when several things want the same resource at the same time — and that
is the block that quietly decides whether your whole system is any good.

Arbiters are where I want to make a distinction that becomes more important the more
senior you get.

Most bugs give you a **wrong answer**. An arbiter bug gives you a **wrong
distribution**. Every transaction completes, every value is correct, every test
passes — and one requester gets served far less often than it should, or occasionally
waits ten times longer than the specification allows. There is nothing to catch,
because nothing is incorrect. There is only a system that is worse than it should be,
in a way that shows up as a customer complaint about performance three months after
tapeout.

## The problem

Four masters want the same memory. One port. Each can request on any cycle.

You have to pick one per cycle. That is the whole job, and it sounds like an
afternoon.

Here is the shape of the difficulty. The decision you make this cycle changes who is
waiting next cycle, which changes the decision then. So an arbiter is not a function,
it is a *policy* unfolding over time, and its quality is only visible in aggregate
over thousands of cycles. You cannot look at one cycle's grant and say whether the
arbiter is good.

Which means you cannot debug it by staring at a waveform, and you cannot verify it
with a test that checks a value. It needs a different kind of thinking, and that is
why this gets its own episode.

## The turn: the four policies

**Fixed priority.** Requester zero always wins, then one, then two. Implemented as
the priority chain from episode seven.

It is the smallest and fastest thing you can build, and it is genuinely correct for
real situations — when the priority order reflects a true difference in urgency. A
refresh request to a memory controller really does have to beat a speculative read,
and a safety shutdown really does beat everything.

Its failure mode has a name: **starvation.** If requester zero asks every cycle,
requester three is never served. Not "served slowly" — *never*, indefinitely, for as
long as the load persists. And this is invisible under light load, because under light
load there are no conflicts. It appears exactly when the system gets busy, which is
exactly when anyone cares.

**Round robin.** Remember who you served last, and start looking from the next one
along. Rotate the starting point each grant.

This is the workhorse and it should be your default. Every requester is served within
one rotation, so the worst-case wait is bounded and calculable — with four requesters
all asking, nobody waits more than four grants. That bounded wait is the property that
matters, and it is worth understanding why: it converts an unbounded, load-dependent
risk into a number you can put in a specification.

The implementation is the priority chain again, but with a rotating starting point.
The standard trick is worth knowing: mask off everybody at or below the last grant,
run the ordinary priority logic on what is left, and if nothing remains, run it again
on the unmasked set. Two priority computations and a mux — slightly more than fixed
priority, and it buys you a bound.

**Weighted round robin.** Some requesters deserve more bandwidth than others, but
nobody should starve. Give each a number of turns per rotation, or a budget of bytes
per rotation that carries over when unused. The carry-over version is called deficit
round robin and it is how you divide bandwidth in proportions that are not whole
numbers.

Use this when the requesters are genuinely unequal — a display controller that must
never underrun, versus a background copy engine that only needs to finish eventually.
Notice that this is the first policy where you have to decide *numbers*, and those
numbers come from Season 1 episode eleven's budgets. Arbiter weights are where a
bandwidth budget becomes silicon.

**Least recently used.** Serve whoever has waited longest. The fairest of the lot by
most definitions, and the most expensive: you are maintaining an ordering over all
requesters and updating it on every grant. Worth it occasionally, and usually the
answer is that round robin is close enough for a fraction of the cost.

## The three things people get wrong

**Grants that do not last long enough.** A transaction is usually not one cycle. A
burst read occupies the resource for eight cycles, and your grant must hold for all of
them — otherwise you have interleaved two bursts and corrupted both.

So an arbiter has state: it is granted, and it stays granted until the current
transaction says it is finished. Which means the arbiter needs to *know* when a
transaction ends, which means it needs the completion signal from the resource, which
means Season 1's valid-and-ready and often a last-item indication. Arbiters that
forget this are among the most common integration bugs in the field, and the symptom
is intermittent data corruption under specific traffic patterns — which reads exactly
like a hardware problem and is not.

And the related trade: **long grants improve efficiency and ruin latency.** A
sixty-four-cycle burst uses the bus beautifully and makes everybody else wait sixty-
four cycles. Whether that is right depends entirely on whether anything in your
system has a deadline, and that is a question for the architecture, not the arbiter.

**The priority chain in a feedback loop.** From yesterday's exercise. The arbiter sits
between a request arriving and a grant going out, and that path is frequently inside a
loop — the grant changes the state that decides the next grant. Thirty-two requesters
in a linear chain caps your clock, and the fix is the tree from episode seven.

And if a tree is not enough, you register the decision — which costs a cycle of
latency on every transaction, applies whether the resource is busy or idle, and is
often entirely acceptable. But it is a change to the interface contract, so it has to
be documented and the requesters have to be built for it.

**No fairness requirement written down anywhere.** This is the real one.

Almost nobody specifies arbitration. The block gets built by whoever is integrating,
using whatever policy seems reasonable, and the behaviour under load is discovered
later by measurement. Then somebody has a performance problem, and three weeks go into
finding out that the arbiter is the cause, and changing it late is expensive because
several blocks now depend on the timing it happens to produce.

The fix costs one paragraph in the specification, written early: **what is the
worst-case wait for each requester, and what share of bandwidth does each get under
saturation?** Two numbers per requester. Once those exist, the arbiter design is
nearly mechanical, and — more valuable — it is *testable*. You can write a test that
saturates every requester and checks the distribution, which is the only way this
class of bug is ever caught before silicon.

## How you verify a distribution

Worth saying explicitly, because it is different from everything in Season 1 episode
nine.

You cannot check a grant. You check *statistics over a long run*. Saturate all
requesters, run for a hundred thousand cycles, and measure two things: the share each
requester received, against your specified share; and the maximum wait any requester
experienced, against your specified bound.

The maximum is the one that matters. Averages hide the failure — an arbiter can
deliver a perfect long-run share and still have made one requester wait four thousand
cycles once, and if that requester was feeding a display, the user saw it.

So: **measure the tail, not the mean.** And then add a Season 1 episode nine assertion
that fires if any request is outstanding for longer than your specified bound. That
single assertion turns an invisible performance property into a loud functional
failure, which is exactly the trade you want.

## The cost

An arbiter designed properly needs a specification it usually does not have, holds
state it is easy to forget, sits on a critical path, and requires a statistical test
bench rather than a value-checking one.

And it will still be a compromise, because it is fundamentally a decision about who
waits. There is no arbiter that is best; there is only an arbiter that matches what
your system needs, which means somebody has to have decided what your system needs.
That somebody is you, and this is the block where architecture and RTL touch most
directly.

## The one thing

An arbiter is where you decide who suffers. Round robin by default because it bounds
the wait; fixed priority only where urgency genuinely differs; weights straight from
your bandwidth budget. Hold the grant for the whole transaction, keep the priority
logic a tree, and verify the tail rather than the mean.

## Commute exercise

Three masters on one memory port.

Master A is a display controller. It reads continuously, it must never run dry, and it
needs forty percent of the bandwidth. If it ever waits more than about two hundred
cycles, the screen visibly tears.

Master B is a processor. Bursty, unpredictable, and *latency* is what the user
experiences — a long wait feels like a slow machine.

Master C is a background copy engine. It needs a lot of bandwidth in total and does
not care at all when it gets it.

On the way home, design the arbiter. Which policy, and what weights.

Then find the conflict. Because A has a hard deadline and B wants short latency and C
will happily consume everything left over — and there is a straightforward-looking
design that satisfies A and C beautifully and makes B feel terrible.

Find it, then work out what you would change. The answer probably involves treating one
of these masters differently in kind rather than in degree, and noticing which one is
the actual insight.
