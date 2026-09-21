---
episode: 09
title: How you know it works
runtime: about 12 minutes
prerequisites: ep04
one_thing: Verification is not "my tests passed". It is a claim about what you have checked, backed by a plan you wrote before you started.
---

> Production note: the "the bug is in the part you did not think of" line is the
> emotional centre. Everything before it is setup.

## Where we are

Eight episodes in, you have a working model of how hardware thinks. Today and
tomorrow are about the two things that actually consume a hardware project's
calendar, and neither of them is design.

Today: how you know it works before you build it.
Tomorrow: what you do when it does not work after you build it.

## The problem

Start with the number, because the number is the argument.

You have a block with, let us say, sixty-four bits of input and a hundred bits
of internal state. How many distinct situations can it be in?

Two to the power of one hundred and sixty-four. That number is larger than the
count of atoms in the observable universe by a comfortable margin. If you tested
a billion cases a second from the beginning of the universe until now, you would
have covered a fraction so small it is not worth writing down.

So exhaustive testing is not merely impractical. It is not a thing. Not for this
block, not for any block, not ever, no matter how much compute you buy.

Now add the second half of the problem, which is the one that actually hurts.

In software, you ship, a bug shows up, you fix it, you push an update. The cost
of a bug found late is real but bounded.

Silicon does not work like that. A chip that goes to fabrication with a bug in
it comes back with the bug in it, in every unit, permanently. A new revision
costs a fortune and months. And even on an FPGA, where you can reprogram, a bug
found by a customer in the field costs something wildly out of proportion to a
bug found in simulation on a Tuesday afternoon.

So you have a space you cannot exhaustively explore and a failure you cannot
cheaply correct. That combination is why verification in this field is not a
phase at the end. It is typically the *majority* of the effort — commonly
quoted as somewhere between half and three-quarters of a project's engineering
time, with more people on it than on design.

If that sounds disproportionate, it is because you are still pricing bugs like
software.

## The turn

The turn is a change in what you think you are doing when you write a test.

The weak version — the one nearly everyone starts with — is: I will think of
some situations, run them, and check the answers. Directed testing. You write a
test for the normal case, one for the empty case, one for the full case, and
when they all pass you feel good.

Here is what is wrong with it, and it is not that the tests are bad.

**The bug is, almost by definition, in the part you did not think of.** You
wrote the design. The same mind that failed to consider a case while writing the
logic is now writing the tests, and it will fail to consider the same case
again, for the same reason. Directed testing systematically explores the region
where you were already paying attention.

So the turn is: stop trying to think of the cases. Build a machine that
generates them, and a separate machine that knows what the right answer is, and
set them against each other by the million.

That gives you three pieces, and they are the three pieces of every serious
verification setup in the world.

**One: a generator that produces legal but unexpected stimulus.** Random, but
not uniformly random — constrained. You tell it the rules: packets are between
sixty-four and fifteen hundred bytes, this field is never zero, bursts arrive
with gaps of one to fifty cycles. Within those constraints, it does whatever it
likes, forever, in combinations you would never have sat down and enumerated.
This is called constrained-random stimulus and it is the workhorse.

**Two: a reference model that computes the right answer independently.** Often
called a golden model. Written in software — Python, C, whatever is convenient —
and written to be *obviously correct* rather than fast or efficient. It does not
need to resemble the hardware at all. It needs to be simple enough that you can
read it and believe it.

And here is the subtle, crucial part: it must be written from the
*specification*, not from the design. If you write the reference model by
reading your own logic, you have built a mirror. It will agree with your design
precisely where your design is wrong. Ideally a different person writes it. At
minimum, write it first, before the logic exists to be copied from.

**Three: a checker that compares them, automatically, every cycle, forever.**
Not a human looking at waveforms. Nobody looks at waveforms until something has
already failed. The test either reports a mismatch with the exact cycle and the
exact values, or it says nothing and you trust it.

Run those three together overnight and you have explored more of that impossible
space by morning than a year of writing directed tests by hand.

## Assertions

One more instrument, and it is the one that changes how you write logic rather
than how you test it.

An assertion is a statement of something that must always be true, written into
the design itself, checked continuously by the simulator. "This queue never
overflows." "Valid is never withdrawn before a transfer." "These two control
signals are never high at the same time."

Three things make them worth more than their weight.

They catch the bug **where it happens** rather than where it is eventually
noticed. Without an assertion, a queue overflows at cycle nine hundred, the
corrupted data flows downstream, and the test fails at cycle forty thousand with
a wrong output — and you spend a day walking backwards. With an assertion, the
simulator stops at cycle nine hundred and names the queue.

They are **executable documentation**. A comment saying "these must be mutually
exclusive" is a hope. An assertion saying it is a fact that gets checked a
billion times a night.

And they keep working forever. An assertion written today fires during a test
written by someone else in three years, on a scenario nobody has imagined yet.
It is the cheapest long-term verification you will ever write.

## Coverage, and the trap in it

So you run a billion random cycles. Everything passes. Are you done?

You have no idea. Random stimulus explores what it happens to explore, and there
is no reason to think it ever produced a full queue at the same moment as a
reset, or a maximum-length packet followed immediately by a minimum-length one.
Passing tests tell you about the cases that ran. They say nothing whatsoever
about the cases that did not.

So you measure. Which lines of logic were exercised, which states were entered,
which transitions were taken, which combinations of interesting conditions
occurred together. The last one — combinations of things you have declared
interesting — is called functional coverage, and it is the one that matters.

And now the trap, which is the most important thing in this episode.

**Coverage has to be planned before it is measured.**

Because if you write the design, run the tests, and *then* sit down to define
what counts as covered, you will define it in terms of what the tests already
do. The bins will be drawn around the existing results. You will get a high
number and it will mean nothing, because you have measured your tests against
themselves.

The coverage model is a *specification document*. It says: here are the
situations that matter for this block, here are the combinations that are
dangerous, here is what must be exercised before anyone claims this works. It is
written early, by someone thinking about the problem rather than the
implementation, and then the tests are pushed until they hit it.

Which brings me to the sentence this whole episode exists for.

"My tests pass" is not a statement about your design. It is a statement about
your tests.

The real deliverable of verification is a *claim*: here is what this block is
required to do, here is the space of situations it must handle, here is the
evidence that it was placed in those situations and behaved correctly, and here
is what remains unverified and why we accepted that.

That last clause is the mark of a professional. Everything is unverified
somewhere. Saying where, out loud, in writing, is the difference between an
engineer and someone who ran some tests.

## The cost

Verification costs more than design and it is not as much fun. That is simply
true and pretending otherwise helps nobody.

It costs a second implementation — the reference model is real code that has to
be written, reviewed and maintained, and when the specification changes it
changes in two places.

And it costs a particular kind of discipline that is genuinely rare: the
willingness to spend a week proving something works when you are personally
already sure it does, with no visible progress to show for it, because "I am
sure" is not evidence and the calendar cost of being wrong is measured in
months.

If your instinct is to enumerate cases systematically and be uncomfortable when
a case is unaccounted for, that instinct is worth a great deal here. This is the
part of the field where being methodical is not a personality trait to manage
around. It is the core competence.

## The one thing

Verification is not "my tests passed". It is a claim about what you checked,
backed by a coverage plan written before you started, and honest about what you
did not check.

## Commute exercise

A queue. Sixteen items deep. Someone can push, someone can pop.

On the way home, build the coverage model out loud. Not the tests — the *model*.
The list of situations that must be exercised before anyone is allowed to say
this queue works.

Start with the easy ones: empty, full, push into empty, pop from full.

Then push on it. What about push and pop in the same cycle when it is empty?
When it is full? What about a reset while it is half full — and what should even
happen there? What about the cycle where it becomes full: does the producer
learn in time, or does it learn one cycle late and overflow?

You will find you get about six situations easily, then have to work for the
next ten, and that the ones you work for are the ones that sound like real bugs.

Then ask the question that matters: which of those situations would a random
test hit by accident in a billion cycles, and which would it essentially never
hit? The ones in that second group are exactly why directed tests still exist
alongside random ones — and knowing which is which is the judgement the job
actually pays for.
