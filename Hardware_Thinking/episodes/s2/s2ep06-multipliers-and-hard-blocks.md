---
season: 2
episode: 6
title: Multipliers and hard blocks
runtime: about 12 minutes
prerequisites: s2ep05
one_thing: The fastest multiplier is the one already built into the die, the cheapest is the one you turned into shifts, and the best divider is the one you removed.
---

> Production note: the division section is the practically useful part. Give it
> more time than multiplication.

## Where we are

Yesterday: the carry chain. Wide arithmetic is deep, comparison is subtraction,
equality is cheap, and a counter is a carry chain in a feedback loop.

Today, the operator one step up, where the cost model is much more dramatic — and
then the operator you should usually refuse to write at all.

## The problem

Multiply two numbers, sixteen bits each.

Again, one character in your source. But now think about what multiplication is
when you do it on paper: for every bit of one operand, you either add a shifted
copy of the other operand or you do not. Sixteen bits means sixteen shifted
copies, and then you have to add all sixteen together.

So a multiplier is not one adder. It is a *field* of them.

And the cost model is brutal in a way addition's is not. **Area grows roughly with
the square of the width.** Double the width, quadruple the hardware. A
thirty-two-bit multiplier is around four times a sixteen-bit one, not twice.

That squared growth is the single most important number in this episode, because it
means multiplication is the first operator where the width you choose has serious
consequences, and where "let us use thirty-two bits everywhere for safety" stops
being harmless and starts being a decision somebody should review.

The depth is better than you might fear — adding sixteen partial products can be
done in a tree, so delay grows with the logarithm — but the area is real and it is
not negotiable by cleverness.

## The turn: use the silicon somebody already built

Chip vendors know multiplication is common and expensive. So they build it into the
fabric.

On an FPGA, there are dedicated arithmetic blocks — hard multipliers, usually with
an accumulator and some registers attached, sold under various product names. They
are purpose-built silicon, far denser and faster than the same function assembled
out of general-purpose logic. A mid-sized part has hundreds of them, sitting there,
already paid for.

On an ASIC, you have the library's multiplier implementations and, for anything
serious, likely a vendor-supplied hard macro.

So the first rule of multiplication is: **land in the hard block.** And doing so is
a pattern-matching question, exactly as episode four described. The templates are
documented, and missing them is quiet and expensive.

Three ways people miss it, all worth recognising.

**Widths that do not fit.** The block has a native size. Ask for one bit more than
it supports and the tool builds a composite out of several blocks plus glue logic,
or gives up and uses general logic. Knowing the native width of your target's
multiplier — and designing your data widths to sit inside it — is one of the highest
leverage facts you can hold about a part.

**Registers in the wrong places.** These blocks have internal pipeline registers,
and they only reach their rated speed when those registers are used. That means your
RTL has to present registers *immediately* at the block's inputs and outputs, so
the tool can absorb them inside. Put a lump of logic between your register and the
multiply and the tool cannot pull the register in, so the internal pipeline stays
unused and you get a slow multiplier. This is a real and common outcome: the right
hardware, running at a third of its capability, because of where a register sits
two lines away.

**Extra features the block does not have.** A reset on a port that has no reset, an
enable it does not support, an asymmetric rounding mode. One unsupported detail and
the whole thing falls out of the hard block into general logic.

So: read the report's hard-block usage line. Every time. It is one number and it
catches a twenty-times mistake.

## The cheapest multiplier of all

Now the case that comes up more often than the general one.

**Multiplying by a constant is not multiplication.** If one operand is fixed at
build time, there are no partial products to select — you know exactly which shifted
copies are needed. Multiply by eight, and that is a shift by three, which in hardware
is *free*: it is a renaming of wires, no gates at all. Multiply by ten, and that is a
shift by three plus a shift by one, so one addition. Multiply by a hundred and
twenty-seven, and rather than seven additions you can compute a shift by seven and
subtract the original — one subtraction.

The tool does this automatically. It is called strength reduction, and it is very
good at it. Which gives you a design principle with real force behind it: **a
constant known at build time is worth an enormous amount.** A coefficient that is a
parameter costs you a shift and an add. The same coefficient in a register that
software can change costs you a full multiplier, hundreds of times the area.

So when somebody asks for "just a bit of runtime configurability" on a coefficient,
that is not a small request, and you now have the numbers to say so precisely. This
is episode four's constant propagation, viewed from the design side, and it is one
of the most useful trades you can put in front of a systems engineer.

## Division

Now the operator to be frightened of.

Division has no equivalent of the partial-product field. There is no shallow,
reasonable, general structure for it. The honest algorithms are *iterative* — they
determine the answer a bit or two at a time, like long division, each step depending
on the previous one.

Which means division is intrinsically **multi-cycle**. Divide two thirty-two-bit
numbers and you are looking at something in the order of tens of cycles, with a state
machine driving it, and a valid signal telling the rest of the design when the answer
is ready.

And if you write a division operator in a single-cycle expression, one of two things
happens, both bad. Either the tool builds the entire iterative structure unrolled as
one enormous combinational lump — which will be gigantic and will destroy your timing
comprehensively — or it refuses. Neither is a surprise you want during synthesis of a
design you thought was finished.

So the rule is: **do not write a division operator.** Instead:

**If the divisor is a power of two, it is a shift.** Free. Note this includes a
divisor that is a *parameter* which happens to be a power of two — and it is worth
choosing your constants to be powers of two for exactly this reason, in buffer
sizes, in scaling factors, in averaging windows. A great deal of practical hardware
design is quietly arranging for the numbers to be powers of two.

**If the divisor is any other constant, multiply by its reciprocal.** Precompute
one over the divisor as a fixed-point constant at build time, multiply by that, and
shift. One multiply and a shift instead of an iterative machine, and since the
reciprocal is a constant, strength reduction may make even the multiply cheap. There
is rounding to reason about and it is worth doing carefully, and it is still
overwhelmingly the right answer.

**If the divisor is genuinely variable, build it as a multi-cycle block on purpose.**
A small state machine, a valid-and-ready interface from Season 1 episode eight, and a
documented latency. And then — critically — go back to your architecture and ask how
many divisions per second you actually need, because if it is few, one shared
iterative divider serves the whole design. That is Season 1 episode eleven's
budgeting, applied to the most expensive operator you own.

**And best of all, restructure the mathematics so the division is not there.** An
astonishing fraction of divisions exist only to compare a ratio against a threshold —
is A over B greater than some value? Multiply both sides instead and the division
vanishes entirely, replaced by one multiply and one compare. This one substitution
has probably saved the industry more area than any compiler optimisation.

## And a word about floating point

Same theme, bigger numbers.

Floating-point arithmetic in hardware means handling exponents, normalising,
rounding, and a pile of special cases for infinities and not-a-numbers. An adder
becomes a substantial block; the whole thing is an order of magnitude more expensive
than the fixed-point equivalent and several times deeper.

For the large majority of signal processing, control and image work, **fixed point is
the right answer** — integers with an agreed, documented binary point. The cost is
that you now own the scaling: you must reason about range and precision at every
stage, decide where to round, and decide what happens on overflow. That reasoning is
real work and it belongs in your specification, not in the code.

The compensation is a design that is a fraction of the size, and — worth
appreciating — *exactly* reproducible, bit for bit, against your reference model.
Which makes the verification of Season 1 episode nine straightforward in a way that
floating point never quite is.

## The cost

The cost of this episode is arithmetic literacy as an ongoing tax. Every operator you
type now needs a moment's thought about what it becomes: is this constant, is it a
power of two, does it fit the hard block, is there a register where the block needs
one, could this ratio be a cross-multiplication.

That is a genuine slowdown while writing. It is repaid the first time you avoid
discovering, late in a project, that one line of source is forty percent of your area
budget.

## The one thing

Land in the hard block and put the registers where it wants them. A constant
multiplier is shifts and adds, so constants are worth a great deal. Never write a
division operator — shift it, reciprocal-multiply it, make it multi-cycle and shared,
or restructure it away.

## Commute exercise

You are averaging a stream of numbers over a window and comparing the average against
a threshold. So, conceptually: sum the last N samples, divide by N, compare with the
threshold.

On the way home, remove the division. There are at least three independent ways, and
they are not equivalent.

One removes it by choosing N. One removes it by moving the division to the other side
of the comparison. One removes it by noticing the threshold is a constant and
pre-scaling it at build time.

Work out all three. Then decide which you would actually ship, and be clear about
what each one costs — in area, in flexibility, and in how easy it is for the next
engineer to understand what the code is doing. That last consideration is a real
engineering criterion and it does not always lose.
