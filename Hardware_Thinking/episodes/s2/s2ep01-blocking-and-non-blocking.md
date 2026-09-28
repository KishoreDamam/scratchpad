---
season: 2
episode: 1
title: Blocking and non-blocking
runtime: about 11 minutes
prerequisites: s1ep02, s1ep04
one_thing: Non-blocking in clocked blocks, blocking in combinational blocks, never both in one block. It is one rule, it is not negotiable, and it exists because of what a register physically is.
---

> Production note: the shift register walkthrough is the whole episode. Do it
> slowly and out loud, both ways round, and let the listener hear the two
> different circuits.

## Where we are

Welcome to Season 2.

Season 1 built you a model. Hardware is space, the clock decides when answers are
believed, the timing window polices everything, datapath is space and controller
is sequence, pipelining buys throughput, memory picks your architecture,
metastability is a rate, backpressure is two wires, verification is a claim, and
constraints come first.

That model is correct and it is not enough. Because there is a second gap, and
almost nobody is told where it is: the gap between RTL that *simulates* correctly
and RTL that *becomes silicon* correctly.

This season is that gap, in detail. Twelve episodes of it. And I am going to
start with the single most consequential syntactic decision in the entire field,
because it is the one that produces bugs you cannot see in a waveform.

## The problem

Here is the situation, and it is genuinely nasty.

You write a design. You simulate it. It works — every test passes, every value
correct, waveforms beautiful.

You synthesise it and put it on hardware. It behaves differently. Not broken in
some subtle marginal way — *differently*. Different number of cycles. Different
values. A shift register that shifts two stages in simulation and one stage on
the device, or the reverse.

Now think about how bad that is diagnostically. Simulation is your only
microscope. Every technique in Season 1's verification episode assumes that if
simulation is right, the design is right. If the simulator and the silicon
disagree about what your code *means*, then your entire verification effort has
been checking a different circuit than the one you shipped.

So: how can two tools disagree about the meaning of a description? And the
answer takes us straight back to episode two of Season 1.

## The turn

Remember what a register physically does. Look, copy, hold. At the clock edge it
looks at its input, copies it, and that copy becomes its output, held still until
the next edge.

Now notice something about that description that is easy to slide past. At the
instant of the edge, the register's *input* is the old value of whatever is
upstream, and its *output* is about to become that old value. The copy happens
from the old world into the new one. Every register in the design does that
simultaneously — they all read the old state, and they all produce the new state,
and no register sees another register's new value until after the edge.

That is the physical fact. Now the language has to model it, and this is where
the two operators come from.

**A single equals sign is called a blocking assignment.** It behaves like an
assignment in software. It takes effect immediately, and the next statement sees
the new value. Statements execute in order, each blocking the next — hence the
name.

**A less-than sign followed by an equals sign is called a non-blocking
assignment.** It behaves like a register. Every non-blocking assignment in the
block evaluates its right-hand side *first*, using the old values, and only then
does every left-hand side get updated, together, at the end. Order of statements
is irrelevant. Nobody sees anybody else's new value.

Read those two descriptions again and notice that the second one is not a
programming convenience. It is a *simulation of simultaneity*. It is the language
reproducing the fact that all registers in a clock domain step from the old state
to the new state at once.

So the rule is:

**In a clocked block, describing registers, use non-blocking.**
**In a combinational block, describing logic, use blocking.**
**Never mix the two in one block.**

## Hearing the difference

Let me walk the classic case out loud, because it is the one that makes it real.

A two-stage shift register. Data comes in, goes into flop A, flop A's value goes
into flop B, and B is the output. Every clock edge, the data moves along by one.

Write it with non-blocking. Two statements: A gets the input, B gets A. Both
right-hand sides evaluate first, using the *old* values. So B gets the old A —
the value A had before this edge — and A gets the new input. That is exactly a
shift register. Two stages, two cycles of latency.

And crucially: if you write the statements the other way round — B gets A first,
then A gets the input — you get *identical* hardware. Because order does not
matter. The description is order-independent, which matches the physical reality
that the two flops do not take turns.

Now write the same thing with blocking assignments. A gets the input — and that
takes effect immediately. Then B gets A — and A is already the new input. So B
also gets the new input. Both flops now hold the same value. You have built a
one-stage shift register with a redundant flop, or arguably a single flop, and
your two cycles of latency have become one.

And if you swap the statement order, you get the two-stage shifter back.

So with blocking assignments in a clocked block, **the behaviour depends on the
order you typed the lines in**. The circuit is a consequence of your text layout.
That alone should be enough to never do it.

But it gets worse, and this is the part that produces the simulation-versus-
silicon disagreement.

Suppose the two flops are in two *separate* clocked blocks, both using blocking
assignments. Now nothing in the language says which block the simulator
evaluates first. It is genuinely unspecified. One simulator may pick one order,
another simulator another order, the same simulator may pick differently after an
unrelated code change — and the synthesis tool, which is not simulating anything
at all, makes its own structural interpretation.

That is a race condition in your description. Not in your circuit — in your
*description of* the circuit. The same file means different things to different
tools, and it can mean different things to the same tool on different days.

And here is what makes it a career-defining trap rather than a beginner's
mistake: **it often works.** Simple cases frequently come out right by accident.
You build a habit that appears fine for months, and then a design gets big
enough, or a tool version changes, and you have a bug that moves when you look
at it.

## Why blocking exists at all

If non-blocking is the one that models hardware, why keep the other?

Because combinational logic is not simultaneous — it is a *chain*. When you
describe a lump of logic, you often want intermediate values: compute a sum, then
compare the sum, then select on the comparison. Those are not registers. They are
steps in the settling of a single cycle's worth of logic, and inside that
settling, ordering is exactly what you mean. A wire's value genuinely does depend
on the wire before it.

So in a combinational block, blocking is correct and non-blocking is wrong — and
wrong in a specific way worth knowing. Non-blocking in a combinational block
means the intermediate value you computed is not available to the next statement,
because non-blocking updates happen at the end. Your logic reads the *previous*
value, which in a combinational block is meaningless — it models neither logic
nor a register. Simulation typically produces something stale-looking that is
very hard to interpret.

Two more clauses to carry, both of which are lint rules in every shop worth
working for.

**Never assign the same signal from two different blocks.** In hardware that is
two things driving one wire, which is a short circuit, and the tool will tell you
so in language you may not immediately recognise.

**Never mix blocking and non-blocking in the same block.** Even when you can
reason out what a particular mixture does, the next person cannot, and neither
can you in eight months.

## The cost

The cost of this rule is that you must know, for every block you write, whether
you are describing registers or logic — *before* you write the first line.

That sounds trivial. In practice it is the discipline that separates clean RTL
from the other kind, because it forces the Season 1 episode-four split into your
actual file layout. Clocked blocks hold state. Combinational blocks compute. You
cannot drift between them casually, and the moment you find yourself wanting to
mix, it is a sign that you have not decided what the structure is.

The other cost is that this is a rule you follow mechanically, without judgement,
even in the cases where you are sure it does not matter. That is genuinely
uncomfortable for a thoughtful engineer — it feels like cargo cult. It is not.
The rule is the distilled form of an argument you do not want to re-derive at
two in the morning, and the cases where it "does not matter" are exactly the
cases where a later edit makes it matter silently.

## The one thing

Non-blocking in clocked blocks, blocking in combinational blocks, never both in
one block, never one signal from two blocks. Four clauses, applied mechanically,
and the whole class of simulation-versus-silicon mismatch disappears.

## Commute exercise

A three-stage shift register: input into A, A into B, B into C. Written in one
clocked block, with blocking assignments, in that order.

On the way home, work out what it actually does — how many cycles of delay you
get from input to C.

Then work out what happens if the three statements are written in the *reverse*
order: C gets B, B gets A, A gets the input, still blocking.

You will find one of those two orderings accidentally produces the correct
three-stage shifter. Which one — and, more importantly, why does that make
blocking assignments *more* dangerous rather than less?

The answer to that last question is the real lesson, and it applies to a great
deal more than this one operator.
