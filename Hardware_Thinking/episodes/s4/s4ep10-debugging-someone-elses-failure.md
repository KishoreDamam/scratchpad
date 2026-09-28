---
season: 4
episode: 10
title: Debugging someone else's failure
runtime: about 12 minutes
prerequisites: s1ep10, s4ep05, s4ep09
one_thing: The failure is where the bug was noticed, not where it happened. Reproduce exactly, find the first divergence, decide who is wrong against the specification — and leave behind a check that would have caught it sooner.
---

> Production note: the six steps should be countable. The "who is wrong" section is
> the one experienced engineers will recognise; let it breathe.

## Where we are

Yesterday's Monday morning.

First, before looking at any single failure: bucket them by signature. Three hundred and forty
failures become a handful of problems. Then check whether any bucket is in the stable-seed regression
— those are changes in the design since the last clean run, and they point at recent commits.
Assign each bucket an owner. Only then does anybody debug anything.

The three percent: are those bins reachable at all? If so, why is the stimulus not reaching them — a
weight, a constraint, a missing sequence? And are they in the plan because the specification demands
them, or are they bins nobody can justify any more?

And which failure to pick from the big bucket. Not a random one. **The shortest one** — the seed that
fails earliest in simulated time, with the fewest transactions before the failure. Every cycle before
the failure is a cycle you have to reason about. A failure at ten microseconds and a failure at four
milliseconds are the same bug, and one of them is four hundred times less haystack. The regression
already did the work of finding the easy one for you; take it.

Today: what you do with it.

## The problem

Season 1 episode ten was about bring-up: the ladder of doubt, for when real hardware does not work.
Today is its simulation cousin, and in one way it is harder.

It is **someone else's failure**. Someone else's design, someone else's testbench, perhaps someone else's
specification. You did not write any of it. You have a seed, a log with an error message, and a
waveform database the size of a small film.

The most common approach, by far, is to open the waveform viewer at the failure point, look at signals,
and start clicking backwards through time, trying things, following hunches.

It sometimes works. It is also how a two-hour bug becomes a three-day one. It is browsing, not
debugging. And the people who seem to have a talent for debugging are, almost always, not browsing.
They are following a method, often without being able to say what it is.

Here it is, said out loud. Six steps.

## One: reproduce exactly

Before anything else, make the failure happen again, on your machine, deliberately.

The same seed. The same commit of the design and the testbench. The same simulator version. The same
parameters, the same test arguments, the same configuration. Episode two: a seed only reproduces a run
on a fixed build.

If it does not reproduce, **stop and find out why**, because nothing else is worth doing yet. A failure
that does not reproduce under apparently identical conditions means the conditions are not identical,
and whatever is different — a tool version, an environment variable, a race from episode one — is
either the bug or is hiding it.

## Two: find the first divergence

This is the heart of the method, and it is one sentence.

**The failure is where the bug was noticed, not where it happened.**

The scoreboard reported packet four thousand eight hundred and seventeen wrong at two point three
milliseconds. That is where a checker *noticed*. The bug happened earlier — possibly much earlier — when
some piece of state first went wrong, and then the corruption travelled until something checked it.

So you do not debug at the failure. You work backwards to find the **first moment anything diverged**
from what it should have been.

And you do it by halving, not by walking. Episode five's internal monitors are exactly for this: was
packet four thousand eight hundred and seventeen already wrong at the midpoint of the design? If yes,
the bug is in the first half. If no, the second. Each question halves the design. In time, the same
thing: was the state already wrong a millisecond earlier? Binary search, in space and in time, and a
design with a dozen modules takes four questions to localise.

If there are assertions inside the design, they did this for you. An assertion fires at the first
divergence by construction. That is Season 1 episode nine's argument for them, cashing out.

## Three: decide who is wrong

Now you are at the point of divergence, and the design did something the testbench did not expect. Here
is the question most people skip, and it matters more than any other.

**Who is wrong?**

There are three candidates, and you must consider all of them. The **design** may be wrong. The
**testbench** — the model, the scoreboard, a monitor, a constraint — may be wrong. Or the
**specification** may be ambiguous, and the designer and the model's author read it differently, and
each is correct by their own reading.

In a mature project, a large fraction of failures turn out to be testbench bugs. The testbench is code
too, often written faster and reviewed less.

And the tiebreaker is never the model and never the design. **It is the specification.** Go back to the
document, find the sentence that governs this behaviour, and read it. If the design matches it, the
testbench is wrong. If the model matches it, the design is wrong. If neither can be decided from the
document — the specification is silent or ambiguous — then neither engineer gets to decide alone. That
is a question for the specification's owner, and the answer goes into the document, in writing.

The worst outcome of a debug session is "fixing" the design to match a testbench that was wrong. It
turns a verification bug into a design bug, and nobody notices, because the regression goes green.

## Four: minimise

Before fixing, shrink.

Can the failure be reproduced with fewer transactions? With a smaller configuration? With backpressure
turned off, or on? With one stream instead of two?

Every simplification that still fails tells you something the bug does *not* depend on. And the
simplification that makes it pass tells you something it *does*. A minimal failing case — a dozen
transactions, one specific stall pattern — is often where the cause becomes obvious. It is also the
case you will turn into a directed test.

## Five: fix, and leave something behind

Now fix it. And then do the part that separates engineers from firefighters.

**Leave behind a check that would have caught it sooner.** If the bug was found by the scoreboard
thousands of cycles after it happened, add the assertion that would have fired at the moment it
happened. The next bug of this kind will be found in minutes.

**Leave behind a coverage point for the scenario.** If the bug needed a specific combination —
maximum-length packet, FIFO one from full, consumer stalled — and that combination was not in the
coverage model, add it. Otherwise the regression has no way to know it is still exercising the scenario
after the next testbench change reshuffles the random seeds.

**And if it was found by a random seed, add the directed case** from step four to the regression, so it
is exercised deliberately rather than by luck.

## Six: ask whether it is a category

Last, the question from Season 2 episode twelve and Season 3 episode one. **Is this an instance or a
category?**

If the bug was an off-by-one in one FIFO's almost-full threshold, check every other FIFO the same
engineer wrote. If it was a misreading of the specification, check every other place that reads the
same sentence. If it was a missing reset on one register, check the whole block's reset.

Bugs cluster, for a reason: they come from habits and misunderstandings, and those do not affect one
line. The fix you just made is worth an hour. The sibling bugs you find by asking this question are
often worth a week.

## A note on waveforms

None of this says "do not use the waveform viewer". It says **do not browse it**. Before you open it,
write down a hypothesis and the thing you expect to see if it is true. "If the pointer wrapped early, the
write pointer will reach zero one cycle before the fifteenth push." Then look for exactly that.

Either it is there, and you have confirmed something, or it is not, and you have eliminated something.
Both are progress. Clicking around to see what looks odd is not, because in a large design, something
always looks odd.

## And for "it passed last week"

A special case worth a tool. If the stable-seed regression was passing on Tuesday and failing on
Thursday, the bug is in a commit between them. Rerun the failing seed on the commit halfway between, and
halve again. Version control has a command that automates exactly this, and for a regression failure it
is often faster than any amount of reasoning.

## The cost

The method is **slower on easy bugs**. If you can see the cause in thirty seconds, see it. The method is
for when you cannot — and the trouble is that you rarely know in advance which kind you have, and the
hunch-driven approach has no stopping rule. It is the same trade Season 1 episode ten made with the
ladder of doubt: discipline costs a little on every bug and saves a great deal on the bad ones.

## The one thing

The failure is where the bug was noticed, not where it happened. Reproduce exactly, find the first
divergence by halving, decide who is wrong against the specification, minimise — and leave behind a
check that would have caught it sooner.

## Commute exercise

The scoreboard reports: packet four thousand eight hundred and seventeen, payload byte seventeen wrong,
at two point three milliseconds. You have the seed and the waveforms.

On the way home, plan your first three moves. Be specific — what exactly do you look at, and what are you
trying to learn from each?

Then suppose you reach the divergence and find this. The design treats a packet whose length is an exact
multiple of the bus width one way; the reference model treats it another. You go to the specification.
It is silent. Both readings are reasonable.

The question worth the drive: **where should this have been caught, and by whom, long before it became a
failure in a regression?** Not which engineer was careless — neither was. Which document should have
forced the question to be asked, and answered, before any test or any RTL existed?
