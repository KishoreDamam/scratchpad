---
season: 3
episode: 11
title: Modelling before RTL
runtime: about 13 minutes
prerequisites: s1ep09, s3ep02
one_thing: Build two models, not one. A bit-accurate functional model with no timing, and a timing-approximate performance model with no bit accuracy. Conflating them produces something slow that answers neither question.
---

> Production note: the spreadsheet section should be defended sincerely. Listeners
> undervalue it because it is not code.

## Where we are

Yesterday's trap, and the answer has a twist in it.

The coefficient and state memory is read and written every cycle inside the filter's
accumulate loop. So putting it in a separate module with registered boundaries adds cycles to
that loop — and Season 1 episode five says a loop runs at the speed of the whole loop. The
naive conclusion: never do it.

But look at what yesterday's design actually was. Sixteen interleaved channels. Which means
the **dependency distance is sixteen** — channel one's next accumulate is sixteen cycles
after its last one.

So a loop that takes four or five cycles, boundary registers included, is entirely fine.
There is no hazard, because sixteen is comfortably greater than five. The interleaving bought
slack in the loop, and that slack can be spent on a module boundary.

Which sharpens yesterday's rule. It is not "never cut through a loop" as a superstition. It
is: **the loop's latency must be shorter than the dependency distance**, and interleaving is
a way of buying room. When those numbers are known, the boundary question has an arithmetic
answer instead of a doctrinal one, and you can give the colleague who wanted a shared memory
exactly what they asked for.

Notice what that required, though: knowing the dependency distance and the loop latency
before anything was built. Which is today's subject.

## The problem

Here are five real questions from the middle of a real project.

How deep must this buffer be so the display never underruns?

Does a round-robin arbiter meet the accelerator's deadline, or do we need weights?

What cache hit rate do we need before caching is worth the area?

If the memory latency turns out to be a hundred and twenty cycles instead of eighty, does the
design still work?

Is one shared multiplier enough, or two?

Every one of those is answerable. In RTL, each costs somewhere between a week and a month —
write it, verify it enough to trust the answer, build stimulus that resembles reality, measure,
then change it and do it again for the next candidate. Nobody has that time, so in practice
these questions get answered by **assertion**: somebody senior says a number, everyone writes
it down, and it becomes a specification.

Sometimes those numbers are good. They are experience, and experience is real. But they are
unaudited, they are frequently conservative by a large factor — which is area you spent for
nothing — and occasionally they are wrong in the expensive direction, which is discovered in
integration.

And here is the structural problem with asking RTL these questions: **RTL is the most
expensive possible instrument for answering them.** It is bit-accurate, cycle-accurate,
synthesisable and slow, and the questions above need none of those properties. They need
approximate timing and realistic traffic.

## The turn

Build a model. And the single most useful thing in this episode is that **you need two, and
they are different things.**

**Model one: the functional model.** Bit-accurate. No timing at all.

It computes exactly what the hardware must compute, right down to the last bit — the same
rounding, the same saturation, the same overflow behaviour, the same fixed-point scaling. And
it has no notion of cycles, no pipeline, no buffers, no clock. Give it an input, get the
correct output.

It answers: *what is the right answer?* And it should be written to be **obviously correct**
rather than fast or clever — Season 1 episode nine's argument, and the reason it must come
from the specification rather than from reading your own RTL.

Its second life is what makes it a bargain: it becomes the reference model in your test
bench. You were going to need one anyway. Writing it *first* means the algorithm is pinned
down and reviewable before any RTL exists, and it means the verification reference is genuinely
independent of the implementation rather than a paraphrase of it.

**Model two: the performance model.** Timing-approximate. Not bit-accurate at all.

It does not care what the data *is*. It tracks *when things happen*: requests issued, queue
occupancies, arbitration decisions, latencies, stalls. The data can be a dummy value or just a
size. What matters is the movement.

It answers: *is it fast enough, how deep must that buffer be, which arbiter, does the deadline
hold, what happens if the memory is slower than promised?*

And these two must be **separate artefacts**. The instinct is to build one model that does
both, and it produces something with the worst properties of each: too slow to run the millions
of cycles a performance question needs, and too cluttered with timing to be the obviously
correct reference the verification needs. Keep them apart. The functional one is short and
exact; the performance one is approximate and fast.

## Start with a spreadsheet

Before either of them, and I want to defend this properly because people dismiss it for not
being code.

A very large fraction of architectural questions are answered by arithmetic you already know
how to do. Episode two's cycles per item. Little's Law for items in flight. Bandwidth times
delay for buffer depth. Episode seven's average access time. Bandwidth per interface, summed
against what the memory can deliver.

That is a spreadsheet, it takes an afternoon, and it will settle most of your structure —
including, critically, whether the design is *impossible*, which is the cheapest thing to
discover and the most expensive thing to discover late.

The spreadsheet's limit is worth knowing precisely: **it handles averages and steady state,
and it cannot handle interaction or burstiness.** It will tell you that the memory has enough
average bandwidth. It will not tell you that when the display and the DMA engine burst
simultaneously, the display's buffer runs dry for eight microseconds every third frame. Queues
interacting under bursty load is genuinely hard to do in closed form, which is where a real
model earns its keep.

So the rule: **spreadsheet until it cannot answer the question, then model.** Not the other way
around, and not a model for something a division would have settled.

## Building the performance model

Practical notes, because this is the part people have not done before.

**Keep it small.** A few hundred lines. Queues, latencies, an arbiter, a traffic generator per
master. If it grows past a thousand lines you are probably re-implementing the design, which
means you have lost the speed advantage that was the whole point.

**Python is fine.** You need to simulate millions of cycles, not billions. If it is too slow,
model at transaction granularity rather than cycle granularity — a burst as one event with a
duration rather than sixty-four individual beats. Coarsening the time granularity is the main
lever, and most performance questions survive it intact.

**Drive it with real traces.** This is the most important sentence in the section. Synthetic
uniform traffic will validate a design that fails on real traffic, every time, because the
failures come from correlation and burstiness that uniform stimulus does not contain. If the
input is video, use the timing of real video with its blanking intervals. If it is network
traffic, use a capture. If it is a processor's memory accesses, get a trace from a simulator or
from the previous product.

A trace from reality is worth more than a cleverer model. Episode two's peak-versus-average
warning is exactly this: the average is in the spreadsheet, and the peak is in the trace.

**Report distributions, not averages.** Season 2 episode nine, again: measure the tail. A
model that reports mean latency will pass a design that occasionally misses a deadline by a
factor of ten. Report the maximum, and the ninety-ninth percentile, and the worst-case buffer
occupancy — because those are the numbers your specification is actually written against.

**Then sweep.** This is the payoff and the reason the model exists. Run it with buffer depths
from four to two hundred and fifty-six and plot where the curve flattens. Run it with three
arbitration policies. Run it with memory latency at eighty, a hundred and twenty, and two
hundred cycles, because you do not yet know what it will be.

That last one is the highest-value thing a performance model does: it tells you **how
sensitive** your design is to a number you are not sure of. A design that works at eighty
cycles and collapses at ninety is a fragile design, and knowing that before committing is
worth the entire modelling effort. A design that degrades gently is one you can ship against
an uncertain memory.

## The cost

**Two artefacts to maintain**, and they will drift from the RTL. The usual failure is that the
design changes and the model does not, so the model's answers quietly become fiction while
still being quoted in reviews.

Two defences. Keep a date and a version on every number the model produces, so a stale answer
is visibly stale. And **calibrate**: once the RTL exists, run the same traffic through both and
compare. If the model predicted forty cycles of latency and the RTL delivers ninety, the model
was wrong, and every conclusion you drew from it needs revisiting. A model that has never been
compared against the real thing is an opinion in a spreadsheet's clothing.

**And the temptation to over-build.** A performance model is not the product, it will not be
shipped, and it does not need to be beautiful. Every hour past the point where it answers the
question is an hour taken from the design. The discipline is to know which question you are
asking, answer it, and stop.

There is one more benefit worth naming, because it justifies the effort on its own in a team
setting. **The model is the thing you hand to the systems and software people to argue with
before silicon exists.** When somebody claims their software needs a shorter latency, or wants
to know whether adding a fourth stream will work, you can run it rather than debating it. The
argument moves from opinion to measurement, months before anybody could otherwise have
measured anything — and that is a genuinely different way to run a project.

## The one thing

Two models, not one: a bit-accurate functional model with no timing, which becomes your
verification reference, and a fast timing-approximate performance model with no bit accuracy.
Spreadsheet first, real traces always, distributions rather than averages, and sweep the
numbers you are unsure of.

## Commute exercise

You must decide the depth of one buffer: the display block's prefetch FIFO from episode seven.

On the way home, plan how you would decide it, in three stages.

First, the spreadsheet answer. What is the arithmetic, and what does it depend on?

Second, name precisely what the spreadsheet cannot tell you. Be specific about which
interaction it misses.

Third, describe the performance model you would build. What is in it, what traffic drives it,
and what output would you plot to pick the depth?

Then the question worth the drive. The answer comes out as sixty-four entries. Somebody
suggests using a hundred and twenty-eight, because memory is cheap and it feels safer.

Make the argument *against* that, properly — not "sixty-four is enough" but a reasoned case
about what the extra sixty-four entries actually cost you, including at least one cost that is
not area.

If you can find the non-obvious cost, you have understood something about buffering that most
people learn the hard way, and it will come up again in Season 7.
