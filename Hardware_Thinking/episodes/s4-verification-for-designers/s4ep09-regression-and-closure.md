---
season: 4
episode: 9
title: Regression and closure
runtime: about 11 minutes
prerequisites: s4ep02, s4ep03, s4ep08
one_thing: A regression is a signal only if red always means something. Bucket failures by signature, kill flakiness on sight, and never let a known failure stay red.
---

> Production note: the Monday-morning scenario in the exercise pays off in episode
> ten. The "three hundred failures are three bugs" line should be said plainly, as
> a fact of life.

## Where we are

Yesterday's arbiter.

The assumption fairness needs: **a requester that is waiting keeps its request raised until it is
granted.** If requesters could drop and re-raise at will, "waiting" would have no meaning — a
requester could withdraw one cycle before its turn, every time, and appear starved by its own
behaviour. The protocol rule, "hold your request until granted", becomes the assumption.

And the covers, to prove the proofs are not over-constrained. **All four requesting at once** —
without it, arbitration was never contested, and the fairness proof might be trivially true. **A
requester waiting the full worst case** — three other grants, then its own — without it, the bound
was never approached. **The grant pointer wrapping from the last requester to the first** — the
classic round-robin bug lives at the wrap, and if the assumptions prevented it, the proof never saw
it. And **a requester dropping its request the cycle after being granted**, then re-raising — the
boundary of the hold assumption itself.

If any of those is unreachable, the environment is lying to you, and the proofs are about a smaller
world than the one your chip will live in.

That finishes the instruments. The rest of the season is about using them as a *process* — because
a thousand tests running every night is not verification. It is a pile. Today is how the pile
becomes a signal.

## The problem

A block of real size has a few hundred tests. Each is run with many seeds, because every seed is a
different random exploration. Add formal jobs, lint, and a few configurations of the parameters, and
a nightly **regression** can be ten or twenty thousand runs.

On Monday morning, three hundred and forty of them have failed.

What do you do?

The naive answer is: look at them. Start at the top of the list and debug each one. At an hour each,
that is two months, and by then there will have been sixty more nightly regressions.

And the other naive answer, the one teams actually drift into: nobody looks. The regression is always
a bit red. Everyone knows some tests are flaky and some are known failures. The red has stopped
meaning anything, so a genuinely new failure — a real bug, introduced on Friday — sits in the list
unnoticed for three weeks.

Both are the same failure. The regression has stopped being a signal.

## The turn

The turn is to treat the regression as a **measurement instrument**, and to hold it to the standard
of one: **red must always mean something, and someone must always act on it.**

Four practices get you there.

## Bucket by signature

Here is a fact of verification life: **three hundred failures are usually three bugs.**

One bug, triggered by a common scenario, fails in every test and every seed that reaches that
scenario. So the first job on Monday is not debugging. It is grouping.

Each failure produces a first error message. Normalise it — strip out the cycle number, the packet
number, the specific data values, anything that differs from run to run — and what is left is a
**signature**. "Scoreboard mismatch on output port, payload field." "Assertion failed: FIFO overflow
in the reorder buffer." "Timeout: objection still raised by the response sequence."

Group by signature. Three hundred and forty failures become perhaps five buckets, one with two hundred
and ninety failures in it and four small ones. Now you have five problems, not three hundred and
forty, and you can assign them.

And this is where episode four's advice pays off again. Assertions fail **where the bug happens**, with
a message naming the block and the rule. Their signatures are precise. A regression full of assertions
buckets cleanly; a regression that only has an end-to-end scoreboard produces vague signatures, and
different bugs land in the same bucket.

## Kill flakiness on sight

A **flaky** test is one that fails sometimes for reasons unrelated to the design. A race in the
testbench — episode one's, the one that depended on scheduling order. A timeout set too tight for a
slow machine. A dependence on something outside the simulation.

A test that fails two percent of the time for no real reason does not cost two percent. It costs
**everything**, because it trains every engineer on the team that red is sometimes noise. Once that
lesson is learned, real failures get the same shrug.

So flakiness is treated as a bug, with a priority above most design bugs, and the rule is simple: a
test that is known to be flaky is fixed immediately, or removed from the regression until it is. It is
never left in, red, with everyone knowing to ignore it.

The same rule applies to **known failures** — real bugs that have been found and not yet fixed. They
are not left red. They are marked expected-to-fail, with a bug number, so they appear as a known item
rather than as noise. When the fix lands, they turn from expected-failure to pass, and the tracking is
automatic.

## Two kinds of seed

Random stimulus serves two purposes, and they pull in opposite directions.

**Exploration** wants new seeds every night. Every new seed is a new walk through the space, a new
chance of finding something nobody has seen.

**Stability** wants the same seeds every night, so that a failure today that passed yesterday means
the *design changed*, not the dice.

So run both. A fixed set of seeds, known to pass, as the stable regression — a new failure there is a
change in the design, and you can find the commit that caused it by rerunning the same seed on older
versions until it passes. And a fresh set of random seeds, as the exploration — a new failure there is
a newly *discovered* bug, which might have been in the design for months.

Mixing the two is how teams end up not knowing whether a failure is new, which makes every failure
cost twice as much to triage.

## Merge coverage, and close it

Each run produces coverage. Merge it across the whole regression and you have episode three's
functional coverage and the code coverage, for everything that ran.

Now closure. For every coverage hole — every bin with a count of zero — you have to decide which of
three things it is.

**Unreachable.** The combination cannot happen in a correct design, or the specification forbids it.
Exclude it — with a written reason, reviewed by someone else, because "unreachable" is exactly the
thing an engineer under deadline wants to believe about a hard-to-hit bin.

**Reachable but not reached.** The stimulus never went there. Change the weights, from episode two, or
write a directed test. This is the normal, grinding work of closure.

**A hole in the plan.** Sometimes a coverage hole reveals that the coverage model is measuring the
wrong thing, or that a scenario was never in the plan at all. That goes back to episode eleven's
document.

And one more lever: **test ranking.** Once coverage is merged, you can ask which tests contributed
coverage that no other test did. Often a small fraction of the tests produce almost all of the unique
coverage, and the rest are repetition. Keep the unique ones in the fast regression, move the rest to a
weekly run, and the nightly results come back hours sooner — which is worth more than the compute.

## The bug curve

The last signal a regression gives you is the **rate at which new bugs are found**. Early in a
project, many per week. Later, fewer. When the curve flattens and coverage is closed, you are
approaching the point where stopping is defensible — which is the subject of episode twelve.

But be careful with that curve. A flat line can mean the design has few bugs left. It can also mean
the tests have stopped looking anywhere new. If the stimulus has not changed in a month and the bug
rate has fallen, you have not learned much. Vary something — new sequences, new weights, formal on a
new property — and see whether the curve moves. If it does, it was not flat. It was blind.

## The cost

**Compute.** Tens of thousands of runs a night is a real cost, and it is why ranking and tiering
matter.

**And ownership.** None of this happens by itself. Someone has to own the regression every morning —
triage the buckets, assign the owners, chase the flaky tests, keep the expected-failure list honest.
It is not glamorous. It is often rotated. And a team without that owner has a pile, not a regression,
no matter how good the tests are.

## The one thing

A regression is a signal only if red always means something. Bucket failures by signature, kill
flakiness on sight, mark known failures rather than living with them, and keep stable seeds apart from
exploratory ones.

## Commute exercise

Monday morning. Twelve thousand runs overnight, three hundred and forty failures. Coverage has been
stuck at ninety-seven percent for three weeks.

On the way home, plan the morning, in order.

What do you do first — before looking at any single failure? What do you do with the buckets once you
have them? Who gets what?

Then the three percent. What three questions would you ask about the uncovered bins, before anyone
writes a single new test?

Then the question worth the drive. You are going to debug one failure personally. Out of the biggest
bucket, with two hundred and ninety failures, **which one do you pick** — and why is the choice not
random? Think about seeds, about simulation length, and about which run will waste the least of your
day.
