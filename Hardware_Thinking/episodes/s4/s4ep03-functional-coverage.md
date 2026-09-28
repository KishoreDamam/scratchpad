---
season: 4
episode: 3
title: Functional coverage
runtime: about 11 minutes
prerequisites: s1ep09, s4ep02
one_thing: Code coverage measures what the implementation did; functional coverage measures what the specification demanded. Only the second can notice a feature that was never built.
---

> Production note: the "absent code has no lines to cover" point is the emotional
> centre. Pause after it.

## Where we are

Yesterday's FIFO. Sixty-four deep, push forty percent of cycles, pop sixty percent,
independently. Does it ever fill?

Work out the steps. The occupancy goes up only when there is a push and no pop — forty percent
times forty percent, sixteen percent of cycles. It goes down when there is a pop and no push —
sixty times sixty, thirty-six percent. So every step up is fighting a drift more than twice as
strong pulling it back to empty.

To reach full, the walk must climb sixty-four net steps against that drift. The odds of that, from
any given start, are roughly four-ninths multiplied by itself sixty-four times. That is a number
with more than twenty zeros after the decimal point. In ten million cycles, or ten billion, or
until the sun goes out, the FIFO never fills.

So the test ran ten million cycles, passed, and told you **nothing at all** about the full
condition, the almost-full threshold, the overflow protection, or the backpressure to the
producer. Every one of those has logic in it. None of that logic was exercised.

And the test result could not tell you. It was green. Green says "no checker complained". It
says nothing about what was asked.

Which is today.

## The problem

Season 1 episode nine said coverage must be planned before it is measured, and that it is a
specification, not a statistic. Today is how that becomes real.

Start with the kind of coverage every simulator gives you for free, because it is seductive.

**Code coverage.** The simulator counts which lines of your RTL executed, which branches of each
if statement were taken, which states of each state machine were entered, which bits toggled. You
switch it on with a flag and get a percentage.

And it is genuinely useful. If a line of RTL never executed in the whole regression, you have
certainly not verified it. If a state was never entered, nothing about it is tested. Code coverage
finds dead regions of your testing very efficiently.

But here is the thing about it, and it is the most important sentence in this episode.

**Code coverage can only measure code that exists.**

Suppose the specification says: when a packet arrives with the error flag set, drop it and
increment the error counter. And suppose the designer forgot. There is no error-handling logic at
all. The error flag is simply ignored.

What does code coverage say? It says a hundred percent. Every line that exists was executed. The
missing feature has no lines, so there is nothing to be uncovered. Code coverage is structurally
blind to the most important class of bug there is — the thing that was never built.

## The turn

Functional coverage is measured against the specification instead of the implementation.

You write down, as code, the situations the specification says matter. Not "was line forty
executed" but "did we ever see a packet with the error flag set". "Did we ever see a
maximum-length packet". "Did the FIFO ever become full while the consumer was stalled".

And now the missing error handler shows up immediately — not because coverage checks
correctness, but because the coverage point for errored packets tells you whether the scenario
happened. If it did, and nothing checked the counter, you know where the gap is. If it did not,
you know your stimulus never tried.

In SystemVerilog this is a **covergroup**. It contains **coverpoints** — a value you want to
watch — and each coverpoint is divided into **bins**, the ranges or values you care about.

And the design of those bins is where all the skill is.

## Bins describe the problem

Take packet length, sixty-four to fifteen hundred.

The naive covergroup makes one bin per value. Fourteen hundred and thirty-seven bins. You will
never close it, and closing it would mean nothing, because a length of seven hundred and three is
not meaningfully different from seven hundred and four.

The specification-driven covergroup asks: **which lengths behave differently?** And the answer
comes from thinking about the design's structure and the spec together.

The minimum, exactly. The maximum, exactly. One above the minimum and one below the maximum,
because that is where off-by-one errors live. If the datapath is eight bytes wide, then lengths
that are an exact multiple of eight, and lengths that leave a partial word of one byte and of
seven bytes, because the last-word logic is different. If there is a buffer of five hundred and
twelve bytes somewhere, then lengths just below, at, and just above five hundred and twelve.
Everything else, in one bin called "typical".

Perhaps a dozen bins. Each one exists because you can say, out loud, why a design might behave
differently there. That is what "describe the problem, not the implementation" means. The bins
are a written theory of where the bugs could be.

## Crosses, and the explosion

Some bugs need two things at once. A maximum-length packet is fine. A full FIFO is fine. A
maximum-length packet arriving *while* the FIFO is one entry from full is where the overflow bug
is.

That is a **cross**: coverage of combinations of two or more coverpoints.

And crosses explode. Twelve length bins crossed with four types crossed with eight ports is three
hundred and eighty-four bins. Add FIFO occupancy with five bins and it is nearly two thousand. Most
of those combinations are uninteresting, some are illegal, and closing them all would take forever.

So you do not cross everything. You cross **what the specification says interacts**. Does packet
type affect how length is handled? If control packets are always sixty-four bytes, crossing type
with length is mostly illegal combinations — mark those as illegal, and now if one ever appears,
it is a failure rather than a coverage hit. Does the port affect anything except routing? If not,
cross port with nothing.

Every cross should have a sentence behind it: "these two interact because...". A cross without
that sentence is compute spent on bins that measure nothing.

## Sample what was checked

One more rule, and it separates real coverage from theatre.

**Coverage should be sampled where checking happens.** Usually that means on transactions seen by
the monitors at the design's interfaces — episode five — at the moment the scoreboard confirms the
result was correct.

Why does that matter? Because a coverage bin that says "we saw a maximum-length packet" is only
evidence if something verified what the design did with it. If you sample coverage at the input,
and the output was never compared, you have proven that the scenario occurred and nothing about
whether it worked. The coverage number goes up; the confidence should not.

Covered and checked, at the same moment, from the same transaction. Otherwise the number is
describing your stimulus, not your design.

## The cost

**The model is real work.** A good covergroup for one interface is a page of thought and a page of
code, and it needs review by someone who understands the specification. It is the verification
plan made executable, which is episode eleven.

**The last few bins cost disproportionately.** The first ninety percent of a coverage model closes
itself in a few nights of random regression. The last ten percent are the rare combinations, and
each one needs either a constraint change — episode two's weights — or a directed test written
specifically to reach it. That long tail is where most of the calendar goes, and it is also where
most of the remaining bugs are, which is why it is worth it.

**And a hundred percent of a bad model means nothing.** Season 1's trap again, now with a
mechanism. If the bins are drawn after the tests exist, they will be drawn around what the tests
already do. The number will be high, and it will be measuring the tests against themselves. The
model must come from the specification, before the tests, by someone thinking about the problem.

Use both kinds together. Functional coverage says whether the specification's situations
happened. Code coverage says whether any of the implementation was never touched — and an
unexercised region of RTL that no functional bin explains is either dead logic, or a scenario your
coverage model forgot. Either is worth knowing.

## The one thing

Code coverage measures what the implementation did; functional coverage measures what the
specification demanded. Only the second can notice a feature that was never built — so draw the
bins from the specification, cross only what interacts, and sample where you check.

## Commute exercise

A property from a specification: **every request must receive a grant within eight cycles.**

On the way home, try to cover this with a covergroup. What would you sample, and when? What would
the bins be?

You will find it awkward. A covergroup samples values at moments. This property is about a
*sequence* of moments — a request, then some number of cycles, then a grant — and the thing you
care about is the distance between them.

Work out how you would force it to fit. Perhaps a counter in the testbench that measures the wait,
sampled when the grant arrives, with bins for one to eight cycles and an illegal bin for nine or
more.

Then the question worth the drive: that works, but it took a counter, a state variable, and a
sampling event you had to build by hand. **Is there a better language for statements about
sequences in time?** And if there were, would it be verifying the property, or covering it — or,
somehow, both?
