---
season: 5
episode: 3
title: The four constraints
runtime: about 12 minutes
prerequisites: s1ep07, s1ep11, s5ep02
one_thing: Clocks, input delays, output delays and exceptions — almost nothing else. A path you did not constrain is a path nobody timed, and the report will not mention it unless you ask.
---

> Production note: "unconstrained is not the same as passing" is the line to land.
> Repeat it in the one thing.

## Where we are

Yesterday's buffers.

Sixty-four times the load: one giant buffer is fast at its own output, and presents an enormous
input to whatever drives it — the delay just moves upstream. A chain growing by four each stage
reaches sixty-four in three stages: one, four, sixteen, sixty-four. Each stage drives four times its
input, which is close to the fastest possible arrangement, and three well-proportioned stages beat
one badly-proportioned one.

Four thousand flip-flops of reset: four to the sixth is four thousand and ninety-six, so about six
levels of buffering. A real tree, with real delay.

And does it matter if they see reset at different times? Season 2 episode three: **assert
asynchronously, release synchronously.** Assertion does not care — reset forces every flop into its
reset state regardless of the clock, and a few hundred picoseconds of spread is irrelevant. But
**release** is a timing event. If half the flops leave reset on one clock edge and half on the next,
a state machine can start in a combination of states that no legal sequence produces.

So the release through that six-level tree is a path that must be timed — just like setup and hold,
under the names **recovery** and **removal**. And whether the tool times it depends entirely on
whether you told it what the reset is and which clock releases it.

Which is today. Telling the tool what the world is.

## The problem

Season 1 episode eleven said constraints are the design — the budgets come first and generate
everything else. That was about architecture. Today is about a much narrower and more literal kind
of constraint: the file you give the synthesis and timing tools that tells them what "fast enough"
means.

The tool knows your netlist and it knows the library. It does not know how fast your clock is. It
does not know when the outside world will present data at your inputs, or when it needs your
outputs. It does not know which paths are real and which are impossible.

Without that information, it can compute delays, but it cannot compute whether any of them are
**too long**. And here is the part that hurts: **when the tool does not know, it does not fail.** It
simply does not check. The report is clean — about everything it checked.

## The turn

The constraints file sounds as if it should be huge and complicated. For most blocks, it is not.
There are four kinds of statement that matter, and almost nothing else.

## One: clocks

You declare every clock: where it enters the design, and its **period**. One hundred and
twenty-five megahertz is eight nanoseconds. That single number sets the budget for every register-to-
register path clocked by it — the data launched on one edge must arrive, with setup time to spare,
before the next.

If a clock is derived inside your design — divided by two, say — you declare it as a **generated
clock**, related to its source, so the tool knows exactly how the edges of the two line up and can
time paths between them correctly.

And one relationship between clocks that you must state explicitly: which clocks are **unrelated**.
Season 1 episode seven's two clocks, with no fixed phase between them. If you do not say so, the tool
assumes they are related, finds some worst-case alignment of their edges, and reports failures on
every path between them — failures that are meaningless, because those paths are handled by
synchronisers, not by timing. So you declare the clocks **asynchronous to each other**, and the tool
stops timing the crossings. Episode five comes back to the danger in that sentence.

Clocks are also where you tell the tool about **uncertainty** — a margin subtracted from every period
to account for the clock's own imperfection, which episode six explains. Before the real clock tree
exists, that margin stands in for everything you do not know yet.

## Two: input delays

Your block has inputs. Something outside drives them — another block, or a chip on the board. That
something launched the data from its own register, on a clock edge, and the data spent time getting
out of that register and travelling to your pin.

The **input delay** tells the tool how much of the clock period has already been used up by the time
the data arrives at your boundary. If the upstream register's clock-to-output time and the wire
between them together take three nanoseconds of an eight-nanosecond period, the input delay is three,
and your logic has the remaining five — minus setup — to get the data into a register.

## Three: output delays

The mirror image. Your outputs are captured by a register somewhere outside. That register needs the
data to arrive before its edge, with setup to spare, and the wire to get there takes time.

The **output delay** tells the tool how much of the period the outside world needs. If the downstream
needs two nanoseconds for wire and setup, your logic must get the data from its last register to the
output pin within the remaining six.

Input and output delays are how a block's timing connects to everything around it. Get them wrong
optimistically and every block passes on its own, and the chip fails when they are connected. Episode
ten is entirely about how those numbers get agreed across a large design.

## Four: exceptions

And last, the statements that say "this path is not what it looks like".

**False paths**: this path exists in the netlist but can never be exercised in a way that matters, so
do not time it.

**Multicycle paths**: this path is real, but the design guarantees it has more than one clock period to
arrive.

**Maximum and minimum delays**: time this path against a specific number rather than the clock.

These are the most powerful lines in the file, because each one can remove a failure from the report.
They are also the most dangerous, because each one can remove a *real* failure from the report. Episode
five is entirely about them.

## The one that nobody mentions

Those are the four. A few smaller statements exist — how strongly the inputs are driven, how much load
the outputs see, which operating corner to use — and they matter for accuracy, but they rarely change
the story.

Now the thing that matters more than any of them.

**An unconstrained path is not a passing path.** If an input has no input delay, the tool — depending on
the tool and its settings — either does not time the path from that input at all, or times it as if the
data arrived at the very start of the cycle, which is optimistic. If a clock is not declared, every
register on it is unclocked, and every path through them is invisible. If a generated clock is missing,
the paths between it and its source are timed wrongly or not at all.

None of that shows up as a violation. The timing summary says everything passes. It passes because
nothing was asked.

You have heard this shape three times in Season 4. The vacuous assertion. The empty scoreboard. The
over-constrained proof. Here it is again, in timing: **silence that looks like success.**

And the defence is the same shape too. Every timing tool can report **unconstrained endpoints** —
registers and outputs that no constraint reaches — and **unclocked registers**. Run those checks on every
constraints file, and the target is zero. Not "a few, which are probably fine". Zero, or a written
reason for each.

## Constraints are a specification

One more framing, because it changes how the file is treated.

The constraints file is not tool settings. It is a **specification** — a machine-checkable statement
of how fast the design must be and how it relates to its environment. It deserves the treatment any
specification deserves: it is written from the architecture, not from what happens to pass. It is
reviewed. It is version-controlled with the RTL. And each exception in it has a comment explaining why
it is true.

A common failure is the constraints file written by trial and error — tighten something, relax
something else, add an exception to make a failure go away — until the report is clean. That file
describes a design that passes timing. It does not describe the environment the chip will live in, and
the difference is discovered on the board.

## The cost

The cost is that you now own a second artefact that can be wrong, and whose wrongness is invisible in
simulation. Your RTL simulations do not read the constraints file at all. A wrong input delay, a
missing clock, an exception that is false — none of those produce a single failing test. They produce
a chip that works at room temperature on your bench and fails at the hot corner in a customer's box.

So constraints need their own verification. The unconstrained-endpoint check. A review against the
architecture document's interface timing. And, for exceptions, the kind of scrutiny episode five
describes.

## The one thing

Clocks, input delays, output delays and exceptions — almost nothing else. The constraints file is a
specification, not a settings file, and a path you did not constrain is a path nobody timed: the
report will not mention it unless you ask for unconstrained endpoints and demand zero.

## Commute exercise

Your block's input comes from a chip on the board, clocked by the same one hundred and twenty-five
megahertz clock — eight nanoseconds. That chip's data sheet says its outputs change up to three
nanoseconds after the clock edge. The board trace adds another nanosecond.

On the way home, work out the input delay. Then work out how much time your logic has, inside the
block, to get that input into its first register.

Then two follow-ups.

First: suppose you forget the input delay entirely. What might the tool do with that path, and why is
every possibility optimistic?

Second, the one worth the drive: once the constraints are right, the tool has everything it needs to
check every path in the design, at every corner, without running a single simulation. **How can it
possibly do that, when simulation needs a billion cycles to explore anything?** What is it computing,
and what is it deliberately *not* computing?
