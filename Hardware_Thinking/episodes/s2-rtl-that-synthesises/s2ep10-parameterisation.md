---
season: 2
episode: 10
title: Parameterisation
runtime: about 12 minutes
prerequisites: s2ep04, s2ep08
one_thing: Every parameter multiplies the space you must verify, so parameterise the axes somebody will actually use, check the illegal combinations at build time, and write down which configurations are supported.
---

> Production note: the verification-space arithmetic in the cost section is the
> punchline. Do the multiplication out loud.

## Where we are

We have spent two episodes on blocks you will build many times — FIFOs and arbiters.
Which raises the obvious question: build them once, properly, and reuse them.

That is parameterisation, and it is the difference between writing modules and
building a library. It is also the place where good engineers most reliably
over-engineer, so this episode is half technique and half restraint.

## The problem

You wrote a beautiful FIFO. Sixteen entries, thirty-two bits wide.

Now you need one that is eight entries and eight bits wide. So you copy the file and
change the numbers.

And now there are two. Next month there are five, and one of them has the almost-full
threshold fix and four of them do not, because the fix was made in the copy somebody
was working in that week. The bug you fixed is still in your design, four times, and
nobody knows which four.

This is the oldest failure in software and it is worse in hardware, for two reasons.
First, hardware bugs cost more, so a fix that fails to propagate costs more. Second,
each copy has probably been *verified separately and partially*, so your confidence in
five copies is not five times your confidence in one — it is lower than your confidence
in the original, because attention got divided.

So: one module, many shapes. How?

## The turn

**Parameters** are values fixed at build time. Episode four told you what happens to
them: elaboration resolves them, and afterwards there are none left — just a specific
structure of specific widths. Which means a parameter costs *nothing at runtime*. It is
not a register, not a mux, not a wire. It is a number that shaped the silicon before
the silicon existed.

That is a genuinely wonderful property and it is worth contrasting with the
alternative. A width you can change at build time is free. A mode you can change at
runtime needs both implementations present, plus a mux, plus the register holding the
mode, plus verification of the switch between them. Same apparent flexibility, wildly
different price. **Build-time flexibility is nearly free; runtime flexibility is
expensive.** Whenever somebody asks for configurability, that is the first question to
settle, and it is often settled in your favour once the cost is stated.

Three techniques, and then the restraint.

**Derived parameters.** Some values are not independent. A FIFO's address width is the
logarithm of its depth — it is not a separate choice, it is a consequence. Declare
those as locally derived constants computed from the real parameters, not as parameters
somebody can set.

This matters more than it sounds. Every parameter you expose is a thing that can be set
inconsistently. If depth and address width are both settable, somebody will eventually
instantiate a sixty-four-deep FIFO with a four-bit address, and the failure will be a
pointer that wraps early and data that vanishes — which is about the worst bug on the
list. Derive everything derivable, and the inconsistency becomes unrepresentable.

**Build-time checks.** Your parameterised module has legal and illegal configurations.
A FIFO depth that is not a power of two breaks the lap-bit scheme from episode eight. A
data width of zero is meaningless. An almost-full threshold larger than the depth is
nonsense.

You can check all of those *during elaboration* and stop the build with a message that
names the problem. Every serious language version has a way to do this, and it is one
of the highest-return five lines you will ever write, because the alternative is that
the illegal configuration synthesises into something structurally wrong and fails in
simulation as a mysterious data corruption, or — genuinely possible — synthesises into
something that works in the easy cases and fails on the wrap.

The principle: **an illegal configuration should fail at build time, loudly, naming
itself.** Not at simulation. Certainly not in silicon.

**Generate.** For structural variation rather than numeric. A generate loop replicates
— Season 1 episode one, a loop is a request for copies — so a parameterised number of
channels becomes that many instances. A generate conditional selects between
implementations: a small register-based memory below some depth and a block memory
above it, chosen by comparison at build time, with only the chosen one existing in the
netlist.

That last pattern is powerful and slightly dangerous, because you now have a module
with two internal implementations. Both need verifying. Which brings us to the cost.

## The cost, which is the real content of this episode

Here is the arithmetic that nobody does.

Your FIFO has five parameters. Width, depth, almost-full threshold, almost-empty
threshold, and a flag choosing first-word fall-through or standard read.

Take conservative counts of interesting values: four widths, five depths, three
thresholds each, two read flavours. Multiply. Three hundred and sixty configurations.

**Each one is a different circuit.** Not a different input to the same circuit — a
structurally different netlist, with different corner cases. The wrap behaviour of a
four-deep FIFO exercises paths that a thousand-deep FIFO will not reach in a realistic
test. A fall-through variant has control logic the standard variant does not contain at
all. An almost-full threshold equal to the depth minus one is an edge case; equal to
one is a different edge case.

You are not going to verify three hundred and sixty circuits. Nobody is. So what
actually happens is that two or three configurations get verified properly — the ones
in the current project — and the rest are *available and unverified*, which is much
worse than unavailable, because the next engineer will instantiate one in good faith
and a parameter set nobody has ever simulated will go to silicon.

This is the central tension of reuse, and there are only three honest responses. You
need all three.

**Parameterise fewer axes.** For each parameter, ask: has anyone ever needed this to
vary, or did I add it because it was easy? Width and depth, almost always yes. A
choice between three memory implementations, usually no — pick the right one based on
depth and derive it. Every axis you delete divides the space.

**Declare the supported set.** Write down, in the module header, which configurations
are supported and tested. "Depth must be a power of two between four and one thousand
and twenty-four. Width between one and five hundred and twelve. Threshold at least
two." Then enforce every one of those with a build-time check. The space you claim and
the space you check must be the same space, and now the space you have to verify is
bounded and stated rather than infinite and implied.

**Verify the corners, parameterically.** You cannot test three hundred and sixty
configurations, but you can test the extremes and a random sample — smallest legal,
largest legal, each flavour, a handful of random legal middles, regenerated on every
regression run. A random configuration per nightly run means that over a few months you
have swept a great deal of the space with no extra effort. That is the cheapest real
coverage available to a parameterised module and very few people do it.

## The other cost: readability

Heavily parameterised RTL is harder to read. Widths become expressions. Structure hides
inside generate blocks. Following the data path requires you to first work out what the
parameters are in this instantiation.

There is a real tipping point where a module becomes so general that understanding it is
harder than writing a new one. When you reach it, you have not built a reusable
component, you have built a small programming language with one user.

The signal that you have crossed the line is usually this: you cannot describe what the
module does in one sentence without conditionals. "A FIFO" is fine. "A FIFO, or a
register slice if depth is one, or a bypass if depth is zero, and optionally a memory
with an output register unless the fall-through flag is set" is three modules wearing
one name, and splitting them will make everything better, including the verification
arithmetic.

## One more trap

Avoid global text substitutions — the ones defined with a preprocessor directive and
visible across every file that includes them. They look like parameters and they are
not. They are not scoped, so two modules cannot have different values; they do not
appear in the module's interface, so an instantiation does not show what shape it got;
and they can be redefined by whoever included what last, which makes the actual value a
property of your file ordering.

Configuration belongs in the module's parameter list, where it is visible at every
instantiation, scoped per instance, and checkable. Package-level constants are the right
answer for genuinely global, genuinely fixed facts — an address width the whole system
shares — and even then, pass them in as parameters rather than reading them from the
ether, so the module remains testable on its own.

## The one thing

Parameters are free at runtime, derive everything derivable, and fail illegal
configurations at build time. Then remember that every axis multiplies the space you
must verify, so expose the ones somebody will really use, declare the supported set,
and sweep the corners in regression.

## Commute exercise

Take yesterday's arbiter and parameterise it.

On the way home, first list every axis you *could* parameterise. Number of requesters,
policy, weights, whether grants are held for a burst, the width of the burst counter,
whether the priority logic is a chain or a tree, registered or combinational output. Get
to seven or eight.

Then multiply out the configuration space with a couple of plausible values each, and
say the number out loud.

Then cut it. For each axis, decide: real parameter, derived value, fixed decision, or
separate module. Get the space down to something you could genuinely verify.

And notice which axis you end up cutting by making it a *separate module* rather than a
parameter — because there is at least one on that list where "these are two different
blocks" is obviously the right answer once you say it, and recognising that split is the
skill this episode is actually teaching.
