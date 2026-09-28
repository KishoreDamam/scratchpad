---
season: 5
episode: 10
title: Budgeting across hierarchy
runtime: about 9 minutes
prerequisites: s3ep10, s5ep03, s5ep07
one_thing: A path that crosses a boundary belongs to two people, so its time must be divided before either starts. Register at boundaries by default, and write the budget down for every path that cannot be.
---

> Production note: short and practical. The convention should sound like relief,
> and the exceptions like work.

## Where we are

Yesterday's two blocks and one path.

B's engineer needs an input delay: how much of the two nanoseconds A has already used by the time the
signal reaches B's port. A's engineer needs an output delay: how much B will still need after the
signal leaves A. Each number comes from the other block — and neither block exists yet in a form the
other can measure.

So without an agreement, each engineer guesses. A assumes B needs little. B assumes A uses little. Both
pass alone. The assembled path fails.

And the convention that makes the problem disappear: **every block registers its outputs.** Then A's
contribution to the path is one clock-to-output delay and nothing else. B knows exactly how much of the
period is gone before the signal arrives, and has nearly all of it. The number is the same for every
interface in the chip, and nobody has to meet.

That is today's whole method — and the rest is what to do about the paths where the convention cannot
hold.

## The problem

A chip is built by many people at once. Each owns blocks. Each synthesises and times their blocks
separately, because timing the whole chip at once is slow, and because each engineer needs to iterate
many times a day on their own piece.

But paths do not respect ownership. A path that crosses from one block to another is timed at the top level,
eventually. Until then, each owner sees only their half, and the halves were budgeted by people who did not
talk to each other.

What happens without a method is familiar to anyone who has integrated a chip. Every block is clean. The top
level has three thousand failures, all on inter-block paths. Nobody owns them, because each owner's half
passed against the numbers they were given. And the numbers they were given were guesses.

## The turn

The turn is to treat inter-block timing as a **budget**, divided in advance and written down — the same way
Season 3 divided bandwidth and memory.

The method has three layers, from cheap to expensive.

## Layer one: the convention

**Register at the boundary.** Outputs come straight from flip-flops. Ideally, inputs go straight into
flip-flops too.

With registered outputs, every inter-block path starts with only a register's clock-to-output delay, plus the
wire between blocks. With registered inputs as well, it ends with only a setup time. Everything in between is
wire. The budget is trivial and universal: the output delay and input delay are the same small numbers for every
port, written once, in a shared file that every block's constraints include.

Most well-run chips make this the default, and the default is enforced — a lint rule or a script that checks every
output port is driven directly by a register, and flags any that are not. Each exception must be justified.

It costs a cycle at each boundary, sometimes two. For most interfaces, with valid-and-ready, nobody notices.

## Layer two: explicit budgets

Some paths cannot be registered at both ends. A handshake where the response must come back in the same cycle.
A combinational path through a block that is deliberately part of a larger one-cycle operation. A tight feedback
between two blocks.

For those, you **split the period explicitly**. A common starting point is to give the driving block and the
receiving block each a fraction of the period, with a slice left for the wire between them. The exact split
depends on who has more logic, and it is decided in a conversation between the two owners, recorded in the
interface's section of the architecture document — Season 3 episode twelve's latency section, now with
picoseconds in it.

Then each owner's constraints reflect it. A's output delay is B's share plus the wire. B's input delay is A's share
plus the wire. Both blocks are timed against numbers that, if both are met, add up to the period.

**And the budget has an owner.** Somebody — an integrator, a lead — keeps the list of every budgeted interface and
checks, periodically, that the top-level path is still closing. Budgets drift. One owner's half starts to fail, they
ask for a little more, and the other half must give it back. Without an owner, that negotiation happens at
integration, in the dark.

## Layer three: top-level timing

Eventually the whole chip, or a large subsystem, is timed flat or with detailed models of each block. That is where
budgets are checked against reality: the wire between blocks is now real, the blocks' actual output timings are
known.

And the discipline is to do this **early and repeatedly**, with rough versions of the blocks, rather than once at the
end. Top-level timing with unfinished blocks is imprecise; it is still the only thing that finds a budget that does
not add up while there is time to change it.

## What an abstract model is

Timing a whole chip flat is expensive, so blocks are often represented at the top level by an **abstract** — a model
that keeps only what the top level needs: the timing of every path touching a port, and nothing about the internal
paths from register to register. Internal paths are the block owner's business, and they have already been closed.

The abstract is a contract. It says: *if you drive my inputs within these constraints and load my outputs like this,
my ports behave like this.* Which is exactly what episode three's input and output delays were, from the other side.

## The social half

The technical method is simple. What makes it work or fail is people.

**Budgets must be agreed before the logic exists.** A budget decided after both sides have written their logic is not
a budget. It is a dispute about who has to redo their work.

**Budgets must be written down** — in one place everybody reads. An agreement in a meeting, remembered differently by
two engineers, is Season 3 episode twelve's "two engineers build blocks that do not connect", in timing form.

**And budgets must be revisited when either side's design changes.** A block that grows a new pipeline stage changes
every budget on its boundary. A block that becomes slower eats its neighbour's slack. The integrator's list is what
makes those changes visible rather than surprising.

## The cost

The convention costs latency at every boundary. The budgets cost conversations, a document, and an owner. Top-level
timing costs compute and effort before anybody feels ready for it.

And the alternative costs more than all of those together: three thousand failures at integration, owned by nobody,
at the moment the schedule has no slack to absorb them.

## The one thing

A path that crosses a boundary belongs to two people, so its time must be divided before either starts. Register at
boundaries by default and enforce it; for every path that cannot be registered, write the budget down, give it an
owner, and check it at the top level early and often.

## Commute exercise

Tomorrow I will read a timing report aloud, line by line. To get ready, rebuild the arithmetic from episode four in your
head, from memory.

On the way home, say out loud, in order, every term that goes into a setup check. Start from the launching clock edge.
What is added to get the data's **arrival** time — list every piece. Then start from the capturing clock edge. What is
added and subtracted to get the **required** time — list every piece.

You should end up with about eight or nine terms in total.

Then the question worth the drive. A path fails by three hundred picoseconds. For each of those terms, ask: **if this one
were the cause, what would it look like in the report?** A single huge number? Many small ones? A clock term that differs
between launch and capture? You are building a diagnostic table in your head, and tomorrow we use it.
