---
season: 5
episode: 5
title: False paths and multicycle paths
runtime: about 12 minutes
prerequisites: s4ep04, s5ep03, s5ep04
one_thing: A timing exception is a claim about how the design behaves. Make the hardware guarantee it, write an assertion that checks it, and never let a claim that depends on somebody's software stand alone.
---

> Production note: the multicycle hold trap needs to be told slowly, as a story
> with edges numbered. It is the most common exception bug there is.

## Where we are

Yesterday's configuration register, written once at boot, failing setup by a nanosecond.

The case for a false path is real: if the value truly never changes while the datapath runs, a slow
path from it cannot matter, because nothing ever travels along it at a moment anybody samples.

And the case against is stronger. "Never changes during operation" is not a property of the
hardware. It is a property of **software** — somebody's boot code, today. On the first cycle after
the write, the value has just changed, and the datapath may already be reading it. And in two years
a new feature will write that register with traffic flowing, and nothing in the hardware will stop
it. The false path will still be in the constraints file, and the tool will still not be timing it,
and the resulting failure will be intermittent, corner-dependent, and very hard to find.

The better answer changes the hardware so the claim becomes true by construction. For instance: the
register only takes effect when the datapath is idle, through an explicit apply step that waits for
idle, or the datapath is held off for a few cycles after any write. Now the path genuinely has
several cycles, the hardware guarantees it, and you can say so with a constraint that still checks
something — a multicycle path, or a maximum delay — rather than one that checks nothing.

That is today's whole subject in one example.

## The problem

Episode four ended with STA's third kind of pessimism: it does not know what the logic computes, so
it times paths that can never matter. And it reports them as failures.

Every real design has some. Paths between two modes that are never active together. Paths from
registers that really are quasi-static. Paths between clocks that are handled by synchronisers.
Paths that the design only uses every other cycle.

So engineers need a way to tell the tool, and the constraints language provides one. And because
each of those statements makes a failure disappear, it is the most tempting tool in the kit when a
deadline is close. A report with two hundred failures becomes a report with none after a dozen lines
— and nobody can tell, by looking at the report, whether those lines were true.

## The turn

There are two exceptions that matter, and they say very different things.

**A false path** says: *this path does not exist, for timing purposes.* Do not time it. Not
slowly — at all.

**A multicycle path** says: *this path is real, but the design guarantees it has more than one period
to arrive.* Time it, against a longer budget.

The difference is enormous. A multicycle path keeps the tool checking; it just moves the goal. A false
path turns the tool off for that path, permanently, for every future change to the logic along it.
Somebody adds three levels of logic to that path next year and nothing reports it.

So the first rule is: **prefer the weaker statement.** If a path has four cycles, say four cycles, not
"infinite". If it only needs to be bounded, say so with a maximum delay. Use a false path only when the
path genuinely cannot carry a meaningful transition at a meaningful time.

## False paths that are really true

Legitimate false paths exist. Three common kinds.

**Mutually exclusive modes.** A test mode and a functional mode that share logic, where a path from a
test-only register to a functional register can never carry data while the functional mode runs.

**Asynchronous crossings.** Paths between clocks declared unrelated, handled by synchronisers. These
are usually removed by declaring the clocks asynchronous as a group, which has the same effect as a
false path on every crossing.

And even here, there is a catch that bites hard. A single-bit synchroniser does not care how long the
path into it takes, within reason. But a **multi-bit** crossing — a Gray-coded pointer from Season 2
episode eight's asynchronous FIFO — relies on all the bits arriving within about one period of each
other, so that the receiving side never sees two bits change in the same sample. Remove timing
entirely and nothing bounds that skew. The bits could arrive a full cycle apart after layout, and the
Gray code's one-bit-at-a-time guarantee is broken. So the correct constraint for those paths is not
false. It is a **maximum delay** — typically about one period of the faster clock — which still leaves
the synchroniser to handle metastability, but keeps the bus's bits together.

**Static configuration** — with a hardware guarantee, as today's opening showed. Without one, it is not
a false path. It is a hope.

## Multicycle paths, and the trap

A multicycle path is correct when the **design** only captures a value every so many cycles. The
classic case: a slow computation launched by an enable, and the result captured by another enable that
fires two cycles later, every time, by construction. Then the path genuinely has two periods, and you
tell the tool so.

And now the trap, which catches nearly everyone once.

Number the clock edges. The data is launched at edge zero. Normally, setup is checked at edge one — the
next edge — and hold is checked at edge zero, the same edge, to make sure the data does not change too
soon.

You tell the tool the setup check should be at edge two instead. Multicycle of two. Good: the path now
has two periods for setup.

But by default, the tool keeps hold one edge *before* the setup edge. The setup edge moved from one to
two. So the hold edge moved from zero to **one**. And a hold check at edge one says: *the new data must
not arrive before edge one.* That is a requirement that the path take **at least one full period** — a
minimum delay of a whole clock cycle.

The tool dutifully tries to meet it. It fills the path with delay buffers — hundreds of them, sometimes
— to slow it down to over a period. Area balloons, power rises, and the path is now far slower than it
ever needed to be. Or it cannot meet it at all, and reports a spectacular hold violation on a path you
thought you had just fixed.

The fix is a second line: a **hold multicycle** of one less than the setup multicycle, moving the hold
check back to edge zero, where it belongs. Setup at two, hold back by one. Every multicycle constraint
you write comes as a **pair**, and a lone setup multicycle in a constraints file is almost always a bug.

## An exception is a claim about behaviour

Now the idea that ties this to Season 4.

Look at what every exception actually says. "These two modes are never active together." "This enable
fires only every second cycle." "This register does not change while the datapath runs."

**Those are claims about how the design behaves.** And Season 4 gave you an instrument for checking
claims about behaviour: the **assertion**.

So every exception should come with one. Next to the multicycle path, an assertion in the RTL: the
capturing enable is never high on two consecutive cycles, and always two cycles after the launching
enable. Next to the static-configuration exception: the register is never written while the datapath is
busy. With a cover on each, so you know the assertion was exercised.

Now the exception is not just a line in a constraints file that somebody once believed. It is a
property checked in every simulation, every night. If a design change breaks the premise, the assertion
fires — in simulation, in the regression, long before silicon. That is how an exception becomes safe:
**the constraints file tells the timing tool the claim, and the assertion tells the verification
environment to check it.**

## The discipline

Four habits, and they are the difference between a constraints file that is trustworthy and one that
is folklore.

**Every exception has a comment explaining why it is true** — not what it does, why it is *true*.

**No wildcards that match more than you meant.** A false path from "every register whose name contains
config" is a false path on whatever gets named that way next year.

**Every exception is reviewed** by someone other than the person who wrote it, against the RTL.

**And every exception has an assertion.** Or, at minimum, the tools that exist specifically to check
exceptions against the design have been run, and their findings read.

## The cost

The cost is that fixing a timing failure this way is no longer quick. Adding a line to a file took a
minute. Justifying it, writing the assertion, getting it reviewed, and perhaps changing the hardware so
the claim is actually guaranteed — that takes a day.

And that is the right price, because the alternative is a failure that cannot be found by any test in
the lab, since at room temperature on a typical chip the path is usually fast enough anyway. Exception
bugs appear in the field, at the hot corner, on the slow chips, as intermittent corruption. That is the
most expensive kind of bug there is, and a day is cheap insurance against it.

## The one thing

A timing exception is a claim about how the design behaves. Prefer the weaker statement, pair every
setup multicycle with its hold, make the hardware guarantee the claim, and write an assertion that
checks it — never let a claim that depends on somebody's software stand alone.

## Commute exercise

Two registers, side by side, in the same clock domain. One launches, the other captures. Because of how
the clock tree was built, the clock arrives at the capturing register a hundred and fifty picoseconds
**later** than it arrives at the launching one.

On the way home, work out what that does to each check.

For setup: the capturing edge is later. Does that help or hurt?

For hold: the capturing register is still taking the old value a hundred and fifty picoseconds after the
launching register has already released the new one. Does that help or hurt?

Then the question worth the drive. The path from these two registers fails setup by fifty picoseconds.
The path *leaving* the capturing register has two hundred picoseconds of spare slack. **Could you deliberately
delay the clock to the capturing register to fix the first path — and what would that do to the second?**
