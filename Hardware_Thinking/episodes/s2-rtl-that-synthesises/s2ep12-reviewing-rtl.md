---
season: 2
episode: 12
title: Reviewing RTL
runtime: about 13 minutes
prerequisites: all of season 2
one_thing: Review in the order in which mistakes are expensive to fix, which means interface first, clock and reset second, and the logic almost last.
---

> Production note: season finale. Recap the twelve one-things as a single run, as in
> Season 1 episode 11.

## Where we are

The end of Season 2. Eleven episodes of specific ways that reasonable-looking RTL
becomes wrong silicon.

Today: how to look at a page of RTL — someone else's, or your own from three months ago
— and find the problems in the order that matters. And this is the episode that makes
the rest of the season usable, because a checklist you apply in the wrong order finds the
cheap problems first and runs out of attention before the expensive ones.

## The problem

You are given four hundred lines of RTL and an hour.

The instinct is to start at the top and read down, checking the logic as you go. Does
this expression compute the right thing. Is this condition correct. Is that increment in
the right place.

Two things are wrong with that.

**You will run out of attention before you run out of file.** Careful logic review is
expensive per line, and attention is a depleting resource. Whatever is at the end of the
file gets less of you than what was at the start, and there is no reason to believe the
bugs were considerate enough to cluster near the top.

**You are checking the cheapest class of mistake.** A wrong expression is found by
simulation, often in minutes, certainly before tapeout. A wrong *interface* is found in
integration, three months later, after four other blocks have been built against it — and
fixing it then means changing five modules and re-verifying all of them.

So review is not "read the code carefully". Review is a search, and you order the search
by **how expensive each class of mistake is to fix later**, not by how the file is laid
out. Most expensive first, while you are still sharp.

## The turn: the order

**One: the interface.** Before any internals. Before a single line of logic.

What are the ports, what do they mean, what protocol do they speak. Is it the house
standard — valid and ready, or whatever your organisation uses — or has somebody invented
a private handshake for this one block. Are the clock and reset per-domain and named so
you can tell which domain each port belongs to. Is every signal's direction and width
justified. Is there anything here that should have been a parameter, or a parameter that
should have been a port.

This is first because an interface is a *contract with other people's code*. Every other
mistake in the file is local. This one is the only one that will propagate into modules
that do not exist yet.

And the highest-value review comment in the whole field lives here: **"this interface
does not need to be different from the one we use everywhere else."** That comment,
made early, saves integration weeks. Made late, it is unaffordable and gets waived.

**Two: clocks and reset.** Still before any logic.

How many clock domains does this module contain? If more than one, where exactly is the
crossing, what structure implements it, and is that structure a proven one rather than
something hand-built? Episode three and Season 1 episode seven. Is reset asynchronously
asserted and synchronously released, once per domain? Which registers are not reset, and
is that documented as a decision?

Second because these produce intermittent failures — which Season 1 episode ten taught
you are the most expensive bugs to *diagnose*, regardless of how easy they are to fix. A
CDC bug found in silicon can take weeks to even characterise.

**Three: the structure.** Can you see the shape of the design from the file, in two
minutes, without reading expressions?

Can you tell which part is datapath and which is control? Season 1, episode four. Where
are the registers — can you find the pipeline stages? Are the clocked blocks and the
combinational blocks clearly separated, following episode one's rule? Is there a state
machine, and can you find its states and transitions without reconstructing them from
scattered conditions?

Third because structure is what determines whether the block can be *understood, timed,
and modified* at all. A block whose shape you cannot see will be mis-modified by the next
person, and you cannot review logic you cannot locate.

The question to ask out loud: "if I had to add a pipeline stage to this block, would I know
where to put it?" If the answer is no, that is a finding, and it is a more important
finding than three wrong expressions.

**Four: state machines and defaults.** Now you are in the logic, but at the level of
completeness rather than correctness.

Every combinational block: are all outputs defaulted at the top? Episode two. Every case:
is there a default? Every state machine: what happens in an illegal state, and does it
recover to a known one? Season 1, episode four.

Fourth because this class is mechanically checkable and you want to spot the ones the
tool has not been pointed at yet.

**Five: widths and parameters.** Episode eleven. Every arithmetic expression, every
assignment, every port connection. Is anything silently truncated? Are the parameters
checked for legal ranges at build time? Are derived values derived rather than
independently settable?

Ideally your linter has done this before the file reached you, which is why episode
eleven insists on lint as a build gate: **a reviewer's attention is far too expensive to
spend on what a machine checks in milliseconds.** If you are finding width mismatches in
review, the real finding is that lint is not gating the build, and that is the comment to
make.

**Six: arithmetic and selection depth.** Episodes five, six and seven. Where is the
widest arithmetic, and is it inside a feedback loop? Are there comparisons that could be
equality tests? Is there an else-if chain that wanted to be a case? Are the multipliers
going to land in hard blocks, with registers where the blocks want them? Is there a
division operator anywhere, and if so, why?

Sixth because this is a *performance* class, not a correctness class. It matters, and it
will be found by a timing report if you miss it, which makes it cheaper than everything
above.

**Seven, and last: the logic.** Is the computation right.

Last — genuinely last — because this is the class that simulation is *good* at. Your
verification, if it is any good, is a far better logic checker than a human reading. What
a human reading is uniquely good at is everything above, none of which simulation can see.

## The other half of the review

One thing that is missing from most review culture and should not be.

**Review the test bench and the coverage plan, not only the design.** Season 1, episode
nine. A block arriving for review with no statement of what has been verified is an
incomplete submission — as incomplete as one with no reset.

And the questions are short. What is the reference model, and was it written from the
specification or from this design? Which parameter configurations have actually been run?
What is on the coverage plan, and what is deliberately not on it? Which situations are
known to be unverified, and why is that acceptable?

That last question, asked routinely and without hostility, does more for a team's silicon
success rate than any amount of logic review. It is also, notably, the question that
makes people write the plan — because they know it is coming.

## How to leave comments people act on

Briefly, because the technique is what makes the rest land.

**Separate the blocking from the optional, explicitly.** A reviewer who mixes "this will
corrupt data under load" with "I would name this differently" in one undifferentiated list
gets both ignored. Say which is which.

**Prefer a comment that eliminates a category.** "Default all outputs at the top of this
block" is better than three comments each naming an inferred latch, because it prevents
the next one too. The best review comment changes a habit or a house rule, not a line.

**Ask about intent when you cannot infer it.** "Why is this register not reset?" is a
better comment than "reset this register", because roughly a third of the time there is a
good reason and you have just learned something — and the other two thirds, the author
discovers they do not have one, which is a more durable fix than complying with an
instruction.

**And say when something is good, specifically.** Not for morale — for *propagation*. A
named, specific piece of praise is how a good pattern spreads to the rest of the team,
and it costs one line.

## Season 2 in twelve sentences

Here is the season, the way Season 1 ended.

**One.** Non-blocking in clocked blocks, blocking in combinational blocks, never mixed.

**Two.** Incompleteness is a request for memory, so default every output.

**Three.** Assert reset asynchronously, release it synchronously, once per domain.

**Four.** Synthesis optimises within your structure, never across it.

**Five.** The carry is a chain, a comparison is a subtraction, and a counter is both
inside a loop.

**Six.** Land in the hard block, constants become shifts, and never write a divider.

**Seven.** An else-if chain is a chain and a case is a tree.

**Eight.** Equal pointers mean full and empty both, and the producer must stop on
almost-full.

**Nine.** An arbiter is where you decide who suffers, so verify the tail, not the mean.

**Ten.** Every parameter multiplies the space you must verify.

**Eleven.** A width mismatch is invisible until the value gets big, and a thousand
warnings is none.

**Twelve.** Review in order of what is expensive to fix later, which puts the logic almost
last.

## The lab project

Before Season 3, build these two things.

**A parameterised synchronous FIFO.** Lap-bit pointers, almost-full and almost-empty
with justified thresholds, build-time checks on every parameter, a documented read
flavour, assertions on overflow and underflow. Lint clean at zero warnings. A
self-checking test bench that runs at least the smallest legal configuration, the
largest, and a random one.

**A round-robin arbiter.** Parameterised requester count, tree-structured priority,
grants held for a burst, and a test bench that saturates every requester and measures both
the bandwidth share and the worst-case wait — then asserts on the bound.

Small, unglamorous, and everything in Seasons 3 through 8 uses one or both. Build them
well enough that you would put them in a library, because that is what you are doing.

## The one thing

Review in the order in which mistakes are expensive to fix. Interface, then clock and
reset, then structure, then completeness, then widths, then depth, then — last — the
logic.

## Commute exercise

The last one of the season, and it is a real professional situation.

You are reviewing a block. You find, in this order as you read down the file: a wrong
increment in a counter; a private handshake protocol on the output port instead of the
house standard; one combinational block without defaults; and a clock domain crossing
implemented with a single register instead of a synchroniser.

You have twenty minutes of the author's attention, in person, today.

On the way home: what do you say, in what order, and what do you leave in writing for
later?

Then the harder half. Two of those four findings will take the author a day to fix. One
will take an hour. One will require changing three other modules and a conversation with
their manager about the schedule.

Work out which is which. Then decide whether you still raise it today — and what happens
to the project if you decide not to.

That decision, made well, is what senior engineers are actually paid for. Thanks for the
season.
