---
season: 3
episode: 10
title: Partitioning and hierarchy
runtime: about 13 minutes
prerequisites: s2ep12, s3ep01
one_thing: A module boundary is four boundaries at once — timing, verification, ownership and physical. A good cut aligns all four; a bad cut aligns none, and cannot be moved later.
---

> Production note: the four-boundaries framing is the spine. Return to it explicitly when
> stating each rule.

## Where we are

Yesterday's accumulator, and the answer is better than most people expect.

Stalling gives you one item every five cycles — a fifth of the rate.

Forwarding: the running total is genuinely complete the moment the adder produces it. So you
can take it from the adder's own output register and feed it straight back to the adder's
input. And that is the insight — **the feedback loop only needs to contain the add.** The
multiply is a feed-forward operation; it can be as deeply pipelined as you like, because
consecutive items do not depend on each other's multiplies. Restructure so the loop encloses
one adder only, and you get full rate, one item per cycle, out of a five-stage machine.

Sixteen interleaved channels also give you full rate, for sixteen accumulator registers, and
no forwarding network at all.

And the last part: a million values, five cycles of latency. Stalling costs five million
cycles. Five interleaved partial sums cost about a million, plus five additions at the end.
**A five-fold speed-up bought by changing nothing but the order in which you add numbers
up** — no extra multipliers, no faster clock, a handful of registers.

That is what microarchitecture is. Not making things faster: arranging the work so the
hardware you already have is never waiting.

Today: how to cut the design up when there is more than one of you.

## The problem

One engineer, one block, no problem. Hierarchy is a filing decision.

Ten engineers and one chip is a completely different situation, and the difference is not
size. It is that **every module boundary is now a contract between people**, and people work
in parallel, which means every boundary is frozen long before anybody knows whether it was a
good one.

Two failure modes, both of which I have watched happen.

**Cut too coarsely** — five enormous blocks — and every one of them is unverifiable on its
own, un-timeable on its own, and owned by three people who keep colliding. Progress becomes
serial regardless of how many engineers you have.

**Cut too finely** — three hundred little modules — and the interfaces outnumber the logic,
nobody can see the design, the tool cannot optimise across the walls you built, and every
change touches eleven files.

And the failure that is worse than both: cut **in the wrong places**, at any granularity. A
boundary through the middle of a tightly-coupled state machine, or across a critical path,
or straight through a feedback loop. Those cuts cannot be made to work well, and because
Season 2 episode twelve told you what moving a boundary costs — three modules and a schedule
conversation — they usually are not moved. They are lived with, for the life of the product.

## The turn

Here is the frame that makes the decisions fall out. **A module boundary is four boundaries
at the same time.**

**It is a timing boundary.** If a block's outputs are registered, then everything inside it
can be timed independently of everything outside it. Its critical paths are its own. Its
owner can close timing without waiting for anyone. Season 1 episode three says the whole
design runs at the speed of its worst path — a registered boundary is how you make "whose
worst path" a question with a local answer.

**It is a verification boundary.** A block with a clean interface can have its own test
bench, its own reference model, its own coverage plan — Season 1 episode nine, done at a
scale where it is tractable. A block whose interface is forty signals with implicit timing
relationships to its neighbours can only be verified in situ, which means not until
integration, which means late.

**It is an ownership boundary.** One person is responsible. They review its changes, they
know its history, they answer questions about it. A block owned by nobody is a block where
defects accumulate; a block owned by three people is a block where they accumulate faster.

**And it is a physical boundary.** Eventually somebody places this design on silicon, and
blocks become regions of area with wires between them. A boundary carrying four hundred
signals between two blocks that end up at opposite corners of the die is a physical problem —
Season 5 episode nine — discovered months after you drew it.

**A good cut aligns all four.** The natural verification unit is also the natural timing
unit, is also one person's job, is also a compact region of silicon. When that alignment
happens, everything is easy. When it does not, every one of those four activities fights the
others for the life of the project.

And the good news: episode one already told you where those cuts are. **Cut where the rate
changes or the working set changes.** Those cuts align the four boundaries naturally, because
a rate change is where buffering and flow control live — so a register at that point was
going to exist anyway — and a working-set change is where the storage structure changes, so
the two sides are physically different kinds of thing.

## The rules

Six, and each one is an instance of the frame.

**Register the outputs at every boundary you care about.** The most valuable convention in
this episode. If every block's outputs come straight from a register, then no combinational
path crosses a boundary, and every block's timing is genuinely its own. It costs a cycle of
latency per boundary and some registers, and it buys independent timing closure for ten
people — which at project scale is overwhelmingly worth it.

Whatever your house convention is, have one, and write it in the architecture document.
"Some blocks register their outputs" is the worst of all worlds, because then nobody knows
what to assume.

**Keep interfaces narrow.** Count the signals. A boundary with a valid, a ready, and a
data bus is a good boundary. A boundary with sixty control signals is two blocks that did
not want to be separated. Narrow interfaces are easier to verify, easier to document, and
cheaper physically.

**Never cut through a feedback loop.** Season 1 episode five: a loop runs at the speed of
the whole loop. If a loop crosses a boundary, and boundaries are registered, you have made
the loop longer — and possibly capped the clock of the entire design. A loop belongs
entirely inside one module, always.

**Never cut through a tightly-coupled state machine.** If two modules' state machines must
agree cycle by cycle, they are one state machine that has been split across a boundary, and
they will be verified together, debugged together and changed together. Merge them.

**Put every clock domain crossing at a boundary, never inside a block.** This is Season 2
episode twelve's review order made structural: if crossings only ever happen at named
boundaries, then a reviewer can find all of them by reading the hierarchy, and the tools can
be pointed at them precisely. Crossings scattered inside blocks are how a design acquires
crossings nobody knows about.

**And assign teams to the cuts, not cuts to the teams.** This one is organisational and it
matters. The decomposition should come from episode one's rate and working-set analysis, and
then people are allocated to it. When it happens the other way round — boundaries drawn to
match who is available — you get a structure that reflects the staffing of one particular
quarter, permanently, in silicon.

## Budgeting across the boundary

One more thing that only appears at scale, and it is the reason registered boundaries matter
so much.

Ten people cannot all close timing on one chip by meeting about it. So the period gets
**budgeted**: this block may use up to sixty percent of the clock period on its internal
paths, the interconnect between blocks gets the rest, and each owner works to their share
independently.

That only works if the boundaries are registered, because otherwise a path starts in one
person's block and ends in another's, and now two people share a failure neither can fix
alone. This is why the convention is not bureaucracy — it is what makes parallel work
possible. Season 5 episode ten is the full treatment; for now, it is another argument for
the same rule.

## The cost

**Registered boundaries cost latency and area.** A design with eight levels of hierarchy,
all registered, has eight cycles of latency it did not strictly need. For a throughput
design that is free. For a latency-critical path it is not, and that is a genuine reason to
flatten part of a hierarchy deliberately.

**Hierarchy walls can prevent optimisation.** Season 2 episode four: the tool optimises
within your structure. Hierarchy can stop it optimising even *inside* that structure,
because it will not restructure logic across a module boundary unless you let it flatten the
hierarchy first. A design cut into very small modules can synthesise worse than the same
logic written flat, and the fix is usually to let the tool flatten the small stuff while
keeping the boundaries you care about — which means knowing which boundaries you care about,
and why.

**And a boundary is expensive to move.** This is the cost that makes this episode's
decisions Season 3 material rather than Season 2 material. Once four blocks are built
against an interface, changing it is a schedule conversation. So the boundaries are, in
practice, chosen once, early, by somebody with incomplete information — which is exactly why
having a *method* for choosing them, rather than an instinct, is worth the hour it takes.

## The one thing

A module boundary is a timing boundary, a verification boundary, an ownership boundary and a
physical boundary simultaneously. Cut where the rate or the working set changes, register the
outputs, keep interfaces narrow, and never cut through a loop or a shared state machine.

## Commute exercise

Take yesterday's interleaved accumulator design, and imagine it as part of a larger block:
an input interface, a format converter, the sixteen-channel filter with its interleaved
accumulator, a memory holding per-channel coefficients and state, and an output packetiser.

On the way home, cut it into modules. Use episode one's criteria, then check your cuts
against today's four boundaries.

Then find the trap. The coefficient and state memory is used by the filter every cycle, in
the middle of the interleaved pipeline. Ask yourself where the boundary goes — is the memory
inside the filter block, or a separate module beside it?

Work through what each choice costs. One of them puts a registered boundary inside a
feedback loop. Say which, and what the consequence is.

And then, the question that will come up in a real review: somebody wants the memory outside
the filter so it can be shared with a second filter instance later. Is that a good enough
reason? Work out what they are asking you to pay, in the currency of this episode, and
whether the flexibility they want is worth it — or whether there is a third structure that
gives them what they need without putting a boundary where it must not go.
