---
season: 2
episode: 5
title: Adders and the carry chain
runtime: about 12 minutes
prerequisites: s1ep03, s1ep05, s2ep04
one_thing: The carry is why wide arithmetic is slow, comparison costs the same as addition, and a counter is a carry chain inside a feedback loop.
---

> Production note: the "a comparator is a subtractor" reveal should land as a
> surprise. Do not signpost it in the introduction.

## Where we are

Yesterday: three phases, pattern matching, and a clean division of labour — the
tool owns the logic between registers, you own where the registers go.

Today we look inside the most common piece of logic in the world, because the
critical path in an enormous number of real designs is an addition, and the reason
is one specific wire.

## The problem

Add two numbers, thirty-two bits each.

In software this is one instruction and you never think about it. In your RTL it is
one character. So it feels atomic — a primitive, free, not a thing with internal
structure.

Then you read your timing report and the critical path is the adder. And you have
no idea what to do about that, because how do you make a plus sign faster?

## The turn

Do the addition by hand, the way you learned as a child, and watch what you
actually do.

Rightmost column first. Add the two digits. If the result is too big for one digit,
write down the remainder and carry one into the next column.

Now the next column. And here is the thing: **you cannot start it until you know
the carry from the previous one.** Not "it is faster if you know" — you genuinely
cannot produce the correct digit without it. The information has to arrive.

That is the whole episode. In a simple adder, each bit position computes its own
sum from its two input bits and the carry coming in from below, and produces a
carry out to the bit above. So the carry walks up from the bottom, one bit at a
time, and the top bit of your thirty-two-bit sum is not correct until the carry has
propagated through thirty-one stages ahead of it.

This is a **ripple carry adder**, and its delay grows in proportion to its width. A
sixty-four-bit add is roughly twice the delay of a thirty-two-bit add, which is
roughly twice a sixteen. It is one of the very few places in digital design where
the cost model is that simple and that unforgiving.

And notice what it is: a chain. A long, thin, serial dependency inside what looked
like one atomic operation. Season 1, episode three told you the critical path is the
longest chain of logic between two registers. Very often, that chain is a carry.

## Making it faster, and what that costs

The good news is that people have been attacking this since the nineteen-fifties and
the results are excellent. The key insight is worth having, because it is a
beautiful piece of engineering.

For any bit position, you can work out *without knowing the incoming carry* whether
that position will **generate** a carry regardless — both input bits are one — or
will merely **propagate** whatever carry arrives — exactly one input bit is one.
Generate and propagate are computable immediately, in parallel, everywhere, from the
inputs alone.

And once you have generate and propagate for every position, you can combine them in
a *tree* to work out all the carries at once, in a depth proportional to the
logarithm of the width rather than the width itself. Thirty-two bits becomes five or
six levels instead of thirty-two.

There is a family of these — carry-lookahead, carry-select, and the parallel-prefix
structures with names like Kogge-Stone and Brent-Kung — and they trade area and
wiring for depth in different proportions. Kogge-Stone is about as fast as it gets
and uses a lot of wires; Brent-Kung is a little slower and much tidier.

Here is the part that matters to you as a designer: **you almost never build these.**

On an FPGA, there is dedicated carry hardware built into the fabric — a special fast
path between adjacent logic cells, designed precisely for this, far faster than
anything you could assemble from general logic. Write a plus sign and you get it.
Hand-build a clever adder out of gates and you will be *slower*, because you have
opted out of the dedicated silicon. This surprises people and it is worth
remembering: on an FPGA, the fancy adder is usually the wrong answer.

On an ASIC, the synthesis tool has a library of adder architectures and picks one
based on your timing constraint. Give it a tight constraint and it spends area on a
fast tree. Give it a loose one and it saves area with something simple. Which means
the way you control adder architecture is **by writing a correct constraint**, not by
writing clever RTL. This is the first clear instance of a pattern that repeats
through the rest of the season: the lever is often in the constraints file, not the
source.

So the practical rule is: write the plus sign, constrain properly, read the report.
Build your own adder only when you have a report proving the tool's choice is
inadequate, which will be rare and will feel like an event.

## The reveal

Now the thing that changes how you read your own code.

How do you compare two numbers? Ask whether one is less than the other.

Subtract them and look at the sign.

And subtraction is addition — with one operand inverted and a carry forced in at the
bottom. Which means **a comparator is an adder.** It has a carry chain. A
thirty-two-bit "less than" costs you the same propagation delay as a thirty-two-bit
addition, and it never looks like it in the source, because a comparison is a
punctuation mark.

Say that back: a wide comparison is as slow as a wide add.

Now go and think about every place you have written a comparison. Address range
checks. Threshold detection. A counter tested against a limit. Priority logic
comparing values. All carry chains. All potential critical paths, all invisible.

Two related facts worth carrying while we are here.

**Equality is different and much cheaper.** Asking whether two numbers are *equal*
needs no carry at all — you compare each bit position independently and combine the
results in a tree. So "is equal to" is a shallow tree and "is less than" is a carry
chain. If you can restructure a comparison into an equality test — comparing against
a constant, or testing a counter against zero rather than against a limit — you have
made a real structural improvement for free.

**Adding three numbers is not one and a half adders.** Two chained additions is two
carry chains in series, because the second addition needs the first's complete
result. If you have several numbers to sum, the shape matters: a chain of additions
is deep, a tree is shallow, and there are tricks — compressor trees — that defer
carry propagation entirely until one final addition at the end. The tool will often
build the tree for you if your constraint demands it. It cannot if you have written
the sums into separate pipeline stages in a chain, because then you have made the
structure and it is yours.

## The counter problem

And now let us put two episodes together, because this is where it bites hardest.

A counter is its own value plus one, fed back. So it is a carry chain *inside a
feedback loop*.

Season 1, episode five: a feedback loop runs at the speed of the whole loop, and
pipelining cannot help it. Today: a carry chain's delay grows with its width.

Therefore: **a wide counter has a hard maximum clock frequency, and there is no
standard trick that removes it.** A forty-eight-bit counter at a high clock rate is
a genuine design problem, not a tuning problem.

The escapes are all structural, which is the point.

Split it. Keep a narrow low counter that runs fast, and increment a separate high
counter only when the low one is about to wrap — and note "about to", one cycle
early, so the high counter's own addition has a full cycle. You have replaced one
long loop with two short ones.

Or change what you count in. If all you need is a cycle of a known length rather
than a readable number, a shift register or a linear feedback shift register moves
through states with almost no logic and no carry at all. It counts in a strange
order, which is fine when nobody reads it.

Or count down to zero instead of up to a limit — because "is it zero" is an equality
test, not a comparison, so you delete a whole second carry chain from the loop.

That last one is one of the highest-value-per-character changes in this whole
season, and it is entirely invisible unless you know what a comparison is made of.

## The cost

What this takes away is the illusion that arithmetic is free punctuation. Every plus
and every less-than in your source is now a structure with a depth, and you have to
carry a rough sense of that depth as you write.

The compensation is that you can now predict your critical path before you have a
report — usually by looking for the widest arithmetic inside the tightest loop. That
guess will be right more often than not, which is a genuinely useful party trick and
also how senior engineers appear to be psychic in reviews.

## The one thing

The carry is a chain, so wide arithmetic is deep. A comparison is a subtraction and
costs the same as an addition. Equality is cheap. And a counter is a carry chain
inside a feedback loop, which is why wide counters cap your clock.

## Commute exercise

A thirty-two-bit counter. Every cycle it increments. Every cycle it is also compared
against a thirty-two-bit limit register, and when it reaches the limit it resets to
zero and raises a pulse.

On the way home, find every carry chain in that description. There are more than
you would say from a quick read.

Then work out which of them are inside the feedback loop and which are outside it,
because only the ones inside cap your clock frequency.

Then redesign it to be fast. You have three tools from today: count down instead of
up, split the counter, and turn comparisons into equality tests. You can get this to
a design whose loop contains almost no carry at all — and when you find it, notice
that the behaviour at the module's boundary has not changed by a single cycle. That
is what structural optimisation feels like.
