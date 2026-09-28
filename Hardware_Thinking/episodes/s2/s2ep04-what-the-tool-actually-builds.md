---
season: 2
episode: 4
title: What the tool actually builds
runtime: about 11 minutes
prerequisites: s2ep02
one_thing: Synthesis optimises within your structure, never across it. It will match patterns, delete anything unobserved, and propagate every constant — but it will not fix your architecture.
---

> Production note: "my logic disappeared" is a real experience many listeners have
> had. Name it early so they know this episode explains it.

## Where we are

Three episodes of the tool doing things you did not expect. An order-dependent
circuit, a latch you did not write, a reset that works nine times in ten.

The common cause is that you have been reasoning about your code and the tool has
been reasoning about something else. So today we stop guessing and go look at what
synthesis actually does — three phases, in order — because once you know the
phases, almost every surprising result becomes predictable.

## The problem

Here is the experience, and if you have built anything you have probably had it.

You write a block. You synthesise. And the report says your block contains almost
nothing. Twelve registers where you expected four hundred. Or the opposite: a
modest-looking expression has become an enormous pile of logic that blows your area
budget and your clock target together.

Or the one that really unsettles people: you add a debug counter, purely to
observe something, and it does not appear. You look for it in the netlist. It is
not there. You did not delete it. The tool did, and nothing in your code says it
was allowed to.

You cannot design confidently in a flow that does things you cannot predict. So
the goal today is not to learn tool options. It is to be able to predict, from
reading your own code, roughly what comes out.

## The turn: the three phases

**Phase one: elaboration.** The tool reads your hierarchy and makes it concrete.
Parameters get their values. Generate statements are resolved — the loops unroll,
the conditionals pick a branch, and we are back to Season 1, episode one, where a
loop is a request for copies. Module instances become real objects. Every constant
that is knowable at build time is known.

After elaboration there are no parameters left. There is a specific, fixed
structure of specific, fixed widths. If you got a parameter wrong, this is where
the wrongness became permanent, and nothing later will notice.

**Phase two: inference and mapping.** Now the tool reads your behavioural
description and matches it against a set of templates. This is the phase that
matters most to how you write code, so let me be blunt about its nature:

**Synthesis is pattern matching.** It is not understanding. There is a template
for a register, a template for a latch, a template for a memory, a template for an
arithmetic operator, a template for a shift register, templates for the hard blocks
in your target technology. Your code either matches a template or it does not.

Match the register template and you get flip-flops. Match it in a way you did not
intend and you get the latch from episode two. Write a memory in a way that matches
the memory template and the tool hands you a dense purpose-built array; write it in
a way that misses the template by one detail — an extra reset on the read port, a
read and a write on the same address in the same cycle described the wrong way — and
you get the same storage built out of individual registers, twenty times the area,
and a report line you have to know to look for.

This is the single most practical consequence of this episode: **there are canonical
ways to write each structure, and departing from them does not give you a variation,
it gives you something else entirely.** The templates are documented. Learning the
five or six that matter is an afternoon and it pays forever.

Then mapping: the generic gates get replaced with real cells from the technology
library — real inverters, real adders, real flops, with real delays and real areas.
Everything becomes specific.

**Phase three: optimisation.** And this is where the surprises come from, because
the tool is now allowed to change anything at all, provided the *observable
behaviour at your module's outputs* is unchanged.

Three optimisations are worth knowing by name because they explain most of the
shocking results.

**Constant propagation.** Anything the tool can prove is constant, it substitutes.
If you tie a mode input to zero at the level above, every piece of logic that only
matters in mode one evaporates — correctly, because it genuinely cannot do anything.
This is why a configurable block instantiated in a fixed configuration can be a
fraction of its apparent size, and it is one of the best reasons to parameterise
rather than to build runtime switches.

**Dead logic removal.** Anything that cannot be observed at an output is deleted.
That is your missing debug counter. It counted, and nothing ever looked at it, and a
thing whose value nobody reads is indistinguishable from a thing that does not
exist. The tool is not being unhelpful; it is applying the definition of
equivalence. If you want to keep it, give it an observer — bring it out to a port,
or attach it to something that leaves the module.

This is also the explanation for the more alarming version: an entire block
disappears because its output port was left unconnected at the level above. One
missing wire in an instantiation, and hundreds of gates correctly vanish. This is
why the unconnected-port warning in episode eleven is not a nitpick.

**Resource sharing and restructuring.** Two adders used in mutually exclusive cases
may become one adder and a mux, which is usually a good trade and occasionally
destroys a critical path you were relying on. Logic gets re-associated: a chain of
additions can be rebalanced into a tree if your timing constraint demands it, which
is the tool doing genuinely clever work on your behalf.

## What it will not do

Now the important half, and it is the sentence to remember.

**Synthesis optimises within your structure. It does not optimise across it.**

It will make your logic between two registers as fast as the library allows. It
will not decide that your logic needs an *extra* register — it will not pipeline
your design for you. Some tools can do limited retiming, moving logic across
register boundaries you already placed, but nothing in the flow will look at a
four-level-deep computation and invent the pipeline stage it needed. That is
episode five of Season 1 and it is your job.

It will not restructure your algorithm. It will not notice that your priority chain
should have been a tree — that is episode seven of this season, and it is your job.

It will not fix a feedback loop that limits your clock. It cannot; the loop is in
the mathematics.

It will not choose a better memory architecture. It will not merge your three
separate small memories into one. It will not decide your arbiter is unfair.

So the division of labour is clean, and it is worth stating because it tells you
where your effort goes: **the tool owns everything between two registers. You own
everything about where the registers are.** Gate-level cleverness is not your job
and you will lose that competition. Structure is entirely your job and nothing else
in the flow will do it.

## Reading the report like an adult

Four numbers, every time, in this order, and it takes two minutes.

**Register count.** Compare it to your mental estimate. If they differ by more than
a little, find out why before anything else. Too few means something got optimised
away or a memory absorbed it. Too many means you inferred storage you did not
intend.

**Latch count.** Should be zero. Episode two.

**Memory inference.** Did your memories become memory blocks, or did they become
thousands of registers? This is a one-line check with a twenty-times consequence.

**Hard-block usage.** Did your multipliers land in dedicated hardware or get built
out of gates? Tomorrow's episode.

Then the warnings, and there is one class you never skip: **anything about
unconnected, undriven, or width-mismatched signals.** Those three are not style
issues. They are the tool telling you, politely, that it built something other than
what you meant.

## The cost

The cost of working this way is that you have to hold a rough model of the tool in
your head while you write, and you have to read the report every single time,
including the boring times.

There is a subtler cost too. Once you know the templates, there is a temptation to
write for the tool rather than for the reader — contorted code because you know
which pattern it matches. Resist it beyond a point. The canonical patterns are
canonical partly *because* they are readable; if you find yourself writing
something clever and unreadable to get a particular gate structure, you are usually
solving a problem that belongs in the constraints or in the architecture.

## The one thing

Synthesis is three phases: elaborate, pattern-match, optimise. It will delete
anything nobody observes, propagate every constant, and make your logic as fast as
the library permits — within your structure. Where the registers go is yours alone.

## Commute exercise

You have written a module with a configuration input three bits wide. Inside, a big
case statement selects between eight completely different processing modes, and each
mode is a substantial lump of arithmetic.

At the level above, you instantiate it twice. One instance has the configuration
input driven by a real register that software can change. The other has it tied
permanently to the value two.

On the way home: estimate the relative area of the two instances. Not precisely —
just the shape of the answer, and the reasoning.

Then the interesting part. Somebody proposes replacing the tied-off instance with a
hand-written module that only implements mode two, arguing it will be smaller.
Will it? And if the answer is "no, roughly the same", what is the *actual*
argument for or against doing it — because there is a real one, and it has nothing
to do with area.
