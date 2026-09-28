---
season: 5
episode: 7
title: Closing timing, part one
runtime: about 11 minutes
prerequisites: s2ep05, s2ep07, s5ep04
one_thing: Diagnose before you fix. Name the path's disease — too deep, too wide a fanout, a late arrival, or a long wire — and apply the restructuring that cures that disease without changing latency or behaviour.
---

> Production note: the four diseases should be countable, and each fix should be
> tied to its disease explicitly. The "diagnose first" line opens and closes.

## Where we are

Yesterday's late select.

The select arrives late, and then the chosen value still has to pass through all of F. So F gets only
what is left of the cycle after the select finally shows up — which may be almost nothing.

Restructured: compute F of A and F of B in parallel, both starting early, as soon as A and B arrive.
Then the late select chooses between two finished results with a single multiplexer at the very end.
Now the select only has to get through one multiplexer. The function is identical. The path is short.

The trade is two copies of F. That is obviously right when F is small relative to what it saves — a
few gates to rescue a failing path. It is obviously wrong when F is a multiplier. And the tool usually
does not do this for you because it is a structural change that doubles logic, and Season 2 episode four
said the tool optimises *within* your structure, not across it. Some tools will attempt limited
duplication of this kind if you allow them; none will do it for anything large on their own initiative.

That is the pattern for today: fixes that change structure without changing behaviour.

## The problem

A timing report says a path fails. What do you do?

What most people do, especially the first few times, is try things. Upsize a cell. Add a pipeline
register somewhere. Change a synthesis option. Rewrite a bit of the logic and see if the number moves.
Sometimes it does, and nobody knows why. Sometimes the path gets better and a different path gets
worse.

That is episode ten of Season 4, again — browsing instead of debugging. And the method is the same too:
**diagnose before you fix.**

## First: is it real?

Before anything else, three questions, because they are cheap and they eliminate a surprising fraction
of failures.

**Are the constraints right?** A wrong input delay, a missing generated clock, a clock period somebody
typed in the wrong unit — each produces failures that no amount of logic restructuring should fix.

**Is the path real?** Episode five. Is it a path the design can actually exercise? If not, the answer
is an exception — with its justification and its assertion — not a logic change.

**Is it a single path, or a family?** Episode four's total negative slack. If one path fails, you have a
path problem, and today's fixes apply. If ten thousand fail, you probably have an architecture problem,
and today's fixes will exhaust you. That is tomorrow.

## The four diseases

A real failing path almost always has one of four diseases. Each has a recognisable signature in the
timing report — episode eleven will read one aloud — and each has its own cure.

## One: too deep

**The signature:** many levels of logic between the two registers, each contributing a modest delay. No
single cell is the villain; there are just too many of them.

**The cures** are about **shape**.

**Chains to trees.** Season 2 episode seven. An else-if chain is a priority chain, depth proportional to
the number of cases. A parallel select is a tree, depth proportional to the logarithm. Eight cases in a
chain is eight levels; in a tree, three. The same goes for arithmetic: summing eight values as a running
total is seven adders deep; as a balanced tree, three.

**Decode early.** If a register's value is going to be decoded — compared against a constant, turned into a
one-hot select — do it before the register, not after. The register stores the decoded form, and the next
stage gets it for free. One-hot state encoding is a special case of this: the state register already *is*
the decoded form, so no decoder sits on the path out of it.

**Precompute.** If a comparison is needed next cycle — "is the counter about to reach the limit?" — compute
it this cycle, from values available now, and register the answer as a flag. The consumer reads one flop
instead of evaluating a comparison. Season 2 episode eight's almost-full flag is exactly this.

## Two: too wide a fanout

**The signature:** one cell with a huge delay, driving an enormous load, often followed by a run of buffers
with no logic in them. Episode two's buffer tree, on your critical path.

**The cure** is **duplication**. If one register drives two thousand loads, make four copies of the register,
each driving five hundred. Each copy is loaded a quarter as heavily and sits closer to its loads. The four
copies compute the same thing, so behaviour is unchanged. It costs three flops. Tools will often do this
automatically for registers, if allowed — and they will often not, if the register's name is preserved for
debug, or if the flow forbids it. Worth checking which.

One warning. Synthesis will happily **merge** duplicates you wrote by hand, because to it they are redundant
— episode one's optimisation phase. If you duplicate deliberately, tell the tool to keep them.

## Three: a late arrival

**The signature:** most of the path is fine, but one input to it arrives very late — from a slow block, from
an input port with a large input delay, from the end of a long computation.

**The cure** is **reordering**: arrange the logic so the late signal enters **as close to the end as
possible**. Yesterday's exercise was this disease exactly. Duplicate the logic after the late signal and move
the late signal's multiplexer to the output. Or, in a Boolean expression, re-associate it so that everything
early is combined first and the late signal meets the result at the final gate.

Tools do some of this automatically within a single expression. They cannot do it across your structure — if
the late signal feeds a multiplexer at the front of a large block, only you can move that multiplexer.

## Four: a long wire

**The signature:** little logic, but big delays on the connections — the path runs between two cells that are
physically far apart. You often cannot see this until layout, but it is the disease of episode nine and the
subject of it. The cure is a register near the middle, which is not free — it changes latency — and therefore
belongs to tomorrow.

## The universal preventive

One habit prevents a large fraction of all four diseases at module boundaries: **register your outputs.**

If every module's outputs come straight from flip-flops, then every path that crosses a module boundary starts
at a register, right at the edge. Nothing on the other side of the boundary can be surprised by how much logic
you put before your output, because there is none. Timing between blocks becomes almost trivial — each block
owns its own internal paths, completely. Episode ten builds a whole method of cross-hierarchy budgeting on
exactly this convention.

It costs one cycle of latency at each boundary, which is why it cannot always be applied. But as a *default*,
it is the single cheapest timing decision you will ever make.

## Retiming

A final technique that sits on the border between free and not.

**Retiming** moves registers across logic without changing the number of registers on any path from input to
output. If a path from A to B has ten levels of logic and the path from B to C has two, moving register B
backwards by four levels gives six and six. Same latency, balanced stages.

The tool can do it for you, if you enable it. And it is the correct technique for a pipeline you have
deliberately given extra stages to — write the logic, add the registers at the end, and let the tool distribute
them.

But retiming has a price: the registers in the netlist no longer correspond to the registers in your RTL. Their
values mean something different. That makes debug harder and equivalence checking harder, and some flows forbid
it for exactly that reason. Turn it on where you meant it, not everywhere.

## The cost

The cost of today's fixes is small but real. Duplication costs area and power. Precomputed flags cost a flop and
the discipline of keeping the precomputation correct. Trees instead of chains sometimes cost a little area.
Reordering makes code less obvious to read.

And one cost is not small: **the RTL now differs from the obvious description.** Somebody reading it in a year
will see F computed twice and the output multiplexer at the end and may "simplify" it back. A one-line comment —
"duplicated for timing: select arrives late, see timing report" — prevents that. Every timing-motivated
restructuring deserves that comment.

## The one thing

Diagnose before you fix. Name the disease — too deep, too wide a fanout, a late arrival, or a long wire — and
apply the restructuring that cures that disease without changing latency or behaviour: trees, early decoding,
precomputation, duplication, reordering. And register your outputs by default.

## Commute exercise

An accumulator. Every cycle, a new value arrives and is added to a running total held in a register. The total
feeds back into the adder for the next cycle. The adder is wide, and at the target clock it fails setup.

On the way home, try every fix from today.

Can you turn a chain into a tree? Is there a late arrival to reorder? Is there fanout to duplicate? Can you
pipeline it — put a register in the middle of the adder?

You will find that the last one breaks something. Work out exactly what. Season 1 episode five said pipelining
buys throughput with latency. What happens to a loop when you add latency inside it?

Then the question worth the drive. None of today's free fixes work on this loop. Something has to change about
what the circuit does, cycle by cycle, while still producing the same final sum. **What could it be?** Season 3
episode nine has the answer, in a different costume.
