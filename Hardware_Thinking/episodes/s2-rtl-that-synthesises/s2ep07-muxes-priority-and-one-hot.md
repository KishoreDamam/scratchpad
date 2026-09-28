---
season: 2
episode: 7
title: Muxes, priority and one-hot
runtime: about 12 minutes
prerequisites: s1ep01, s1ep04, s2ep02
one_thing: An if-else-if chain is a chain and a case is a tree. Identical behaviour, different depth, and you chose which one by how you typed it.
---

> Production note: the pragma warning at the end is a genuine safety item. Do not
> soften it.

## Where we are

Two episodes on arithmetic depth. Today, selection depth — which is less obvious,
more common, and where the difference between a competent design and a fast one is
frequently decided.

And at the end, the two most dangerous comment-like things you can put in
SystemVerilog, which I want you to be able to recognise and refuse.

## The problem

You have eight sources of data and you want one of them, chosen by some conditions.

You write it the way you would in software. If this condition, take source one. Else
if that condition, take source two. Else if, else if, else if, down to eight.

Correct. Readable. Reviewable. And, if the eight conditions are actually mutually
exclusive, three to four times deeper than it needs to be.

The behaviour is right, so no test will ever complain. It shows up only as a timing
report, and it shows up as a critical path through a piece of code that looks
entirely innocent.

## The turn

Read your own else-if chain the way the tool reads it, remembering Season 1 episode
one: an if is a mux, a physical two-input switch.

"If condition one, take source one, else take *everything below*." That is one mux.
Its select is condition one, one input is source one, and its other input is the
entire rest of the chain.

And the rest of the chain is itself a mux, whose other input is the rest of *that*
chain. And so on, eight deep.

So you have built eight two-input muxes in series. A signal entering at the bottom
passes through all eight before it reaches the output. **Depth proportional to the
number of branches.** It is the carry chain again in a different costume: a long thin
serial structure hiding inside a construct that looks flat on the page.

And that structure is not a mistake — it is exactly what an else-if means. Else-if
is *priority*. It says: if several conditions are true at once, the first one wins.
Implementing priority genuinely requires knowing the earlier answers before deciding
the later ones, so the chain is the honest implementation of what you asked for.

The question is whether you meant to ask for it.

Because if the eight conditions are mutually exclusive — if at most one can ever be
true — then priority is *meaningless*. There is never a conflict to resolve. You paid
eight levels of depth for a tie-breaking rule that can never fire.

What you wanted was a **parallel** selection: all eight conditions evaluated at once,
one winner, combined in a tree. Depth proportional to the *logarithm* — three levels
for eight inputs instead of eight. And on hardware that has wide selection primitives
or dedicated mux structures, potentially better still.

So: **an if-else-if chain is a chain, and a case statement over a single selector is
a tree.** Same behaviour when the conditions are exclusive. Different depth. And you
chose which one you got by how you typed it.

## Writing the tree

The cleanest way to get the tree is to make the exclusivity structural rather than a
claim.

If you have a genuine selector — a state, an opcode, a mode — write a case statement
on it. A case over one selector value cannot have overlapping branches; exclusivity
is guaranteed by the shape of the construct. The tool knows that without being told,
and builds the tree.

That is the real reason to prefer a case statement, and it is worth stating plainly:
**a case statement encodes the exclusivity in a form the tool can verify, instead of
in a promise you made in a comment.**

Which naturally leads to encoding, and to the three schemes worth knowing.

**Binary encoding.** The obvious one: sixteen states in four bits. Fewest registers.
But every use of the state requires *decoding* — logic that compares those four bits
against a pattern — and every transition requires computing four new bits from
possibly complicated logic. Small storage, more surrounding logic.

**One-hot encoding.** One register per state. Sixteen states, sixteen registers,
exactly one of them ever set.

That sounds wasteful and is frequently the fastest thing you can do, for a reason
worth appreciating. Asking "am I in state seven" becomes *reading one wire*. No
decode, no comparison, zero logic. And the next-state logic becomes beautiful: the
register for a given state is set if any of the arrows arriving at that state is
being taken — which is a simple OR of a few terms. Season 1's episode four
description of a state machine turns into almost no logic at all.

And selection becomes an AND-OR structure: AND each data source with its own hot
bit, then OR everything together. Wide, shallow, regular, and fast.

So the trade is registers for logic depth, and on parts where registers are
plentiful — which is most FPGAs and many ASIC flows — one-hot wins for anything
performance-critical. It also has a pleasant property for the unspoken-states
problem: an all-zeros one-hot vector is detectably illegal, so you can build an
explicit check that the machine has fallen out of its legal set.

**Gray encoding.** Consecutive values differ in exactly one bit. Two uses, both from
Season 1: crossing clock domains safely, because a single changing bit cannot produce
a phantom value; and saving power in a counter, because one bit toggling per step is
far less switching than a carry rippling through eight.

## Arbitration is the same problem

Worth noticing before tomorrow's FIFO episode and Friday's arbiter episode: "find
the first requester that is asserting" is a priority chain. Thirty-two requesters
written as an else-if chain is a thirty-two-deep structure, sitting in the request
path of everything that shares that resource.

Priority is genuinely wanted there — that is what arbitration is. But the *depth* is
not, and there is a standard trick: compute the priority in a tree, the same way the
carry-lookahead adder computes carries in a tree. You break the requesters into
groups, work out in parallel which groups contain any request at all, pick the group
in a tree, and pick within the group in parallel. Logarithmic instead of linear,
same behaviour.

That is the whole intellectual move of the last three episodes, and it is worth
naming because it generalises: **look for the linear structure hiding inside a
construct that looks flat, and replace it with a tree.** Carries, comparisons,
selections, priority — it is the same shape every time.

## The two dangerous pragmas

Now the safety item, and I want to be direct about it.

SystemVerilog has, historically, let you annotate a case statement with directives
that tell the synthesis tool things it cannot verify. Two of them:

One says: treat these branches as parallel — assume no two conditions can be true at
once, so build a tree instead of a priority chain.

The other says: treat this case as fully covered — assume no unlisted value can
occur, so do not build anything for the missing branches.

They do exactly what you want. They also do it by *assertion*, not by proof. And the
synthesis tool believes them while the **simulator does not.**

Sit with that. The simulator, which is your only microscope, evaluates the real
priority and the real incompleteness. Synthesis builds something else. Your
simulation is now checking a different circuit than the one you ship.

So if your promise is wrong — if two conditions *can* both be true, perhaps only in
some rare configuration nobody tested — then simulation shows the priority behaviour,
silicon shows something undefined, and every technique in Season 1 episode nine has
been validating the wrong design. That is the worst class of bug in this field and
these directives manufacture it on purpose.

The modern answer removes the hazard properly: SystemVerilog has case *qualifiers* —
keywords in the language itself, not comment-like pragmas — that state the same
intent while making **both** tools agree, and which cause the simulator to report a
violation if your claim ever turns out to be false. You get the tree and you get told
when your assumption breaks. That is the whole point.

So: never the old pragmas. Use the language qualifiers, and understand you are making
a claim the simulator will hold you to. And best of all, prefer a construct where
exclusivity is structural — a case over a real selector — so that no claim is
required.

## The cost

The cost is that you now have to know, for every selection you write, whether the
conditions are exclusive and whether you meant priority. That is another small tax
on writing, and it is the same tax as the last two episodes.

There is a second cost, subtler. One-hot encoding and tree-structured priority are
both *less readable* than the naive version. An else-if chain reads like English; a
one-hot next-state block reads like a machine. When you make this trade, the comment
explaining why is not optional — and if the block is not performance-critical, the
readable version is the correct engineering answer. Depth only matters where depth
matters.

## The one thing

An if-else-if chain is a chain and a case is a tree. Ask whether you meant priority.
Encode one-hot when speed matters, Gray when transitions matter, binary when
registers are scarce. And never let a directive make the simulator and the synthesis
tool disagree about your design.

## Commute exercise

An interrupt controller. Sixteen sources. You must output the index of the
highest-priority active one, and a flag saying whether any is active at all.

Priority here is genuine and required — that is the definition of the block.

On the way home, first work out the depth of the naive else-if version, in levels of
logic.

Then restructure it as a tree: split the sixteen into four groups of four, and think
about what you compute per group and how you combine the results. Work out that
depth.

Then the question that makes it a design exercise rather than an optimisation
exercise: your tree is now several levels of logic deep, and this block sits in the
path between a request arriving and a grant going out. Is that path inside a feedback
loop? Because if it is, Season 1 episode five says your clock is capped by it — and
the fix is not a better tree, it is a register, and a register changes the *behaviour*
of the interface by a cycle.

Work out where that register can go, and what you have to promise the requesters
about it.
