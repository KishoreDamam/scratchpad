---
season: 5
episode: 1
title: What synthesis does
runtime: about 11 minutes
prerequisites: s1ep03, s2ep04
one_thing: Synthesis happens in three phases — elaborate, optimise, map — and your intent can die in each. Structure survives elaboration, redundancy dies in optimisation, and the library decides everything in mapping.
---

> Production note: the three phases should be countable. The "structure is the one
> thing you own" line is the bridge back to Season 2 episode four; say it clearly.

## Where we are

Welcome to Season 5.

First, the debt from the end of Season 4. I asked you to write the one-page statement for a block
you know — what was verified, what was not, why that is acceptable — and then read each reason
back as if you were the person spending the money, asking: would I accept this from somebody else?

Most people find that the reasons they cannot defend share a shape. **"We ran out of time"** —
which is not a reason, it is a description of the schedule. **"It is verified at a higher level"**
— with no name attached. And **"it is simple"** — said about logic nobody measured.

Every one of those is a claim made without evidence, and the fix is always the same: either go and
get the evidence, or turn the claim into an honest gap with a real argument about likelihood and
consequence.

Hold that habit, because this season needs it in a new form. Seasons 3 and 4 were about whether the
design does the right thing. Season 5 is about whether it does it **fast enough** — and "fast
enough" is a claim that has a precise, checkable answer, produced by tools that will tell you
exactly how far you are from it. The evidence is available. The skill is reading it.

## The problem

Season 1 episode three told you timing exists: every path from one register to the next must arrive
before the capturing edge, with setup time to spare, and must not change too soon after it. Season 2
episode four told you synthesis is pattern matching that optimises within your structure but never
across it.

What neither told you is what actually happens between the RTL you write and the gates that get
timed. And not knowing it produces a specific kind of helplessness. The timing report says a path
fails. The path goes through cells with names you have never seen, in an order that does not look
like your code, and some of your logic appears to have vanished entirely. You do not know whether to
change the RTL, the constraints, or the tool settings, so you change things at random.

This season is about removing that helplessness. And it starts with a clear picture of what the tool
does.

## The turn

Synthesis happens in **three phases**. They blur together in a modern tool, but thinking of them
separately tells you where your intent survives and where it dies.

**Phase one: elaboration.**

The tool reads your RTL and turns it into a generic circuit. Not real gates yet — abstract ones. An
adder is an adder. A multiplexer is a multiplexer. A register is a register. Parameters are resolved,
generate loops are unrolled, every module is instantiated.

This is where Season 2 lives. Every always block becomes either registers or combinational logic —
and if you left a path without an assignment, this is where the latch you did not ask for appears.
Every else-if chain becomes a priority chain of multiplexers, and every case becomes a parallel
select. Episode seven's shape is fixed here.

What survives elaboration is your **structure**. The number of registers, where they are, what logic
sits between them, what depends on what. And here is the thing to hold on to: **structure is the one
thing you own.** Later phases will change almost everything else. They will not, in general, move
your registers or change which logic lives between which pair of them — unless you explicitly ask for
that, and that is a later episode.

**Phase two: optimisation.**

Now the tool rewrites the generic circuit to be smaller and faster, without changing what it
computes. This phase is where logic vanishes, and it vanishes for good reasons.

**Constants propagate.** A signal tied to zero makes half the logic it feeds redundant, and it is
removed. A register whose input is a constant becomes a constant.

**Unused logic is deleted.** A register whose output is never read, by anything that eventually
reaches an output, does not exist in the netlist. Season 2 episode four's dead logic. If you have ever
put a debug counter in a design and found it missing from the synthesised result, this is why.

**Boolean logic is minimised.** Redundant terms disappear. Expressions are factored and refactored.
A multiplication by a power of two becomes wiring. A comparison with a constant becomes a small
pattern-match rather than a subtractor.

**Shared logic is merged.** Two identical expressions computed in two places become one, feeding
both. Which is good for area, and sometimes bad for timing, because the one copy now drives twice the
load.

And a few structural rewrites that are **your choice, not the tool's default**: state machine
re-encoding, where the tool may change your binary encoding to one-hot if you allow it; and
**retiming**, where it is permitted to move registers across logic to balance paths. By default, most
flows are conservative about both, because they change the structure you own, and that structure is
what your verification ran against.

**Phase three: technology mapping.**

Finally, the generic, optimised circuit is built out of real cells from a specific **library** — the
catalogue of gates the foundry, or the FPGA vendor, actually provides. A generic two-input AND becomes
a specific AND gate cell with a specific size. A generic adder becomes a particular adder architecture
built from those cells. A multiplier might become a hard multiplier block, if Season 2 episode six's
pattern was recognised.

And now, for the first time, **timing is real**. Every cell has a characterised delay. The tool
chooses cells and sizes to meet the constraints you gave it — faster, larger cells on critical paths,
smaller, slower ones elsewhere to save area and power. It re-optimises as it goes, because a mapping
choice on one path changes the load on another.

Mapping is where the library decides everything. The same RTL mapped to two libraries gives two
different circuits with different critical paths. Tomorrow is about the library.

## What that means for how you write

Three consequences, and they are the practical point of today.

**First: the tool can improve logic, but not architecture.** It will minimise the Boolean expression
between two registers far better than you can by hand. It will not add a pipeline stage, split a
feedback loop, or turn your priority chain into a tree if the priority was part of the behaviour you
described. If a path is ten levels of logic deep because that is what you wrote, it will be about
ten levels of optimised logic deep afterwards.

So do not hand-optimise Boolean logic. Do optimise structure. That is exactly the split between
episodes seven and eight of this season.

**Second: missing logic is a message, not a mystery.** If something you wrote is absent from the
netlist, the tool proved it had no effect on any output. Sometimes that is correct — a debug counter
nobody reads. Sometimes it is the symptom of a bug: an output accidentally left unconnected, which
made its entire cone of logic "unused", which the tool helpfully deleted. Synthesis logs report what
was removed. **Read the removal messages.** A block that shrinks by forty percent in synthesis did not
get forty percent more efficient.

**Third: what you simulated and what you built are not the same artefact.** Simulation ran your RTL.
The chip will run the netlist. They should be equivalent, and Season 4 episode eight's equivalence
checking is how the flow proves they are. But there are known ways for them to differ — Season 2
episode two's latches, Season 2 episode one's ordering mistakes, anything relying on initial values in
simulation that real hardware does not have. Equivalence checking catches the tool's errors. It
cannot catch the difference between what you meant and what you wrote.

## The cost

The cost of understanding synthesis is that it takes away the comforting idea that the tool is
magic — and replaces it with responsibility.

When the tool was magic, a timing failure was the tool's problem. Now you know that it optimised
faithfully within the structure you gave it, and that the path is long because you made it long. The
fix is usually in your RTL, and occasionally in your constraints, and almost never in finding the
secret tool option that makes it go away.

And a quieter cost. The more you know about what the tool does, the more tempting it becomes to write
RTL for the tool — manually instantiating cells, fighting its choices, hand-mapping logic. Resist that
in almost all cases. It makes the design non-portable, hard to review, and brittle when the library
changes. Write clean structure, give the tool honest constraints, and intervene only where a timing
report has shown you it is necessary.

## The one thing

Synthesis happens in three phases — elaborate, optimise, map. Structure survives elaboration and is
yours; redundancy dies in optimisation, and the removal messages tell you what died; and the library
decides everything in mapping, which is where timing first becomes real.

## Commute exercise

A small design. On the way home, predict what synthesis builds for each piece.

A thirty-two bit counter, of which only the bottom twenty-four bits are ever read by anything.

A multiplication of a sixteen-bit signal by eight.

A comparison checking whether a sixteen-bit signal equals a particular constant.

A debug register that captures an internal value, which nobody reads because the debug port was never
connected.

And a four-bit input to the block that, at the top level, is tied to zero.

For each one: what survives, what vanishes, and what does it become?

Then the question worth the drive. The block's area drops by a third between elaboration and the final
netlist. Your manager is pleased. **What would you check before being pleased too?** Which of the five
cases above is a normal optimisation, and which one is a bug that the tool has just quietly hidden from
you?
