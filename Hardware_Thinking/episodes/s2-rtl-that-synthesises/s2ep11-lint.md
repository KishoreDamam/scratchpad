---
season: 2
episode: 11
title: Lint, and which warnings matter
runtime: about 11 minutes
prerequisites: s2ep02, s2ep04
one_thing: A width mismatch is the most valuable warning in the field, because it is invisible in a waveform until the day the value gets big. And a thousand warnings is the same as none.
---

> Production note: the truncation story is the emotional core. Tell it as a specific
> failure with a specific consequence, not as a category.

## Where we are

Ten episodes of ways that correct-looking RTL becomes wrong silicon. Order-dependent
assignments, inferred latches, reset releases, deleted logic, hidden carry chains,
priority where you wanted parallel, FIFO overflow by one, starving arbiters, unverified
parameter configurations.

Notice something about that list: **almost every item on it is mechanically
detectable.** Not "detectable by a clever reviewer" — detectable by a program, in
seconds, with no test bench, no stimulus, and no waiting.

That program is a linter, and today is about using it as an engineer rather than as
somebody who has been told to.

## The problem

You have a design. You want to know if it is wrong.

The obvious route is simulation. Write a test bench, drive stimulus, check results.
Season 1 episode nine is all about doing that well.

But simulation has two structural limits that no amount of skill removes.

**It only finds what your stimulus reaches.** A latch in a branch nobody exercises is
a latch you will not see. A truncation that only matters when a value exceeds a width
is invisible until a test happens to produce a big value.

**It is slow in the loop.** Compile, elaborate, run, inspect. Minutes at best, hours on
a large design. Which means the feedback for a small mistake arrives long after you made
it, and after you have made several more.

So there is a whole class of defect that simulation is the wrong instrument for: things
that are wrong *structurally*, visible in the text, regardless of stimulus. Those want a
different tool, and the tool takes seconds.

## The turn: what lint actually finds

Let me go through the categories that earn their keep, because "run lint and fix
things" is not advice — knowing which findings are real is.

**Width mismatches.** This is the one. If this episode leaves you with a single habit,
make it this one.

You assign a twelve-bit value to an eight-bit signal. The language does not stop you. It
silently discards the top four bits. And here is what makes it lethal: **for most of the
life of your design, the value fits.** Your counter stays under two hundred and fifty-six,
your address stays in range, your sum does not overflow. Everything works. Every test
passes. The waveform is perfect.

Then the design runs for longer, or a buffer gets bigger, or a real workload arrives, and
the value exceeds the width. Now the top bits vanish, and your address wraps to the
beginning of a buffer, and you overwrite data that was fine. The symptom is corruption
somewhere completely unrelated to the line that caused it, appearing only under load,
after a long run.

That is the single most expensive category of bug in digital design, in my view, and it
is *entirely* mechanically detectable. The linter compares the widths and tells you, in
milliseconds, at the exact line.

And the reason it needs a linter rather than discipline is that width mismatches are
produced by *arithmetic*, not just by assignment. Add two eight-bit numbers and the true
result is nine bits. Multiply two sixteen-bit numbers and it is thirty-two. If you
assign that sum to an eight-bit signal you have silently discarded the carry — which is
overflow, unsignalled, and your average filter now occasionally outputs a small number
when it should output a large one. Nobody tracks that by hand across a whole design.
Machines do it perfectly.

So the rule: **zero width warnings, always, and every intentional truncation is written
explicitly** — an explicit slice of the bits you want, so the next reader can see that
you meant it. "I meant to drop those bits" and "I did not notice I was dropping bits"
must look different in the source.

**Unconnected and undriven signals.** Episode four told you what happens to a module
whose output port is left unconnected: it correctly vanishes. The linter finds the
unconnected port in seconds, before you spend an afternoon wondering why your block is
not in the netlist. Undriven inputs are the same failure in reverse — a signal that is
read and never assigned, which in simulation is unknown and in silicon is whatever the
synthesis tool decided to tie it to.

**Inferred latches.** Episode two, found mechanically. This is one of the three answers
to that episode's exercise.

**Incomplete sensitivity and mixed assignments.** Episode one's rule, and the blocks
that break it, checked structurally.

**Multiple drivers.** Two blocks assigning one signal — two things driving one wire.
Caught immediately.

**Combinational loops.** A path from a block's output back to its own input with no
register in it. This is the one finding I would treat as an emergency: it is not a style
issue, it is a circuit that does not have a defined value.

**Case statement problems.** Missing defaults, overlapping branches, values that can
never be matched — including the case where a branch tests against a pattern wider than
the selector, so it is simply unreachable.

**Clock and reset misuse.** A signal used as a clock in one place and as data in
another; a reset that is not asynchronously asserted; a clock that has been through
combinational logic, which is how you accidentally create a gated clock with a glitch on
it. Real CDC signoff is a separate and much deeper tool — Season 6 — but the structural
version of these checks lives in lint and catches the obvious cases early.

## The part everybody gets wrong

Now the management of it, which matters more than the tool choice.

Run a linter on any real design for the first time and you will get hundreds or
thousands of findings. Most will be trivial. Some will be genuine. And the human response
to a list of two thousand items is to scan it, feel overwhelmed, decide the tool is
noisy, and close it.

**A thousand warnings is exactly as useful as no warnings.** Both mean nobody is looking.
This is the most important sentence in the episode, and it applies well beyond lint.

So the discipline is curation, and it goes in this order.

**First, choose your rule set deliberately.** Not the default, not everything. Pick the
rules whose findings you consider defects — start with the categories above — and switch
the rest off. A rule you will not act on is noise, and noise is what kills the whole
practice.

**Second, get to zero.** Not "down to a manageable number". Zero. Because zero is a
condition a machine can check and a human can see at a glance, and any other number
requires somebody to remember what the acceptable number was last week.

**Third, waive explicitly, in the source, with a reason.** Some findings are genuinely
acceptable. Fine — waive them where the code is, with a comment saying who decided and
why. Never in a separate global exclusion file, where waivers become permanent, silent,
and inherited by people who never saw the argument. A waiver with a reason is engineering.
A waiver without one is a place where a bug will hide, on purpose, forever.

**Fourth, make it a gate.** Lint runs in continuous integration and a finding fails the
build, exactly like a failing test. Because if it is advisory, the count goes up under
schedule pressure, which is precisely when you most need it at zero.

**And fifth — the sequencing that people miss — lint before you simulate.** Always. It
takes seconds, it finds a different class of problem, and finding a width mismatch before
you spend twenty minutes on a simulation that was never going to be meaningful is simply
faster. Lint is the fastest loop you have. Use it as the first loop.

## The cost

Lint is not free of judgement, and there are two real costs.

**False positives that are expensive to silence.** Some rules will flag patterns that are
correct in your house style, and getting to zero means either changing the style or
waiving in dozens of places. That is a genuine cost and the answer is to drop the rule
rather than to litter the source.

**The illusion of safety.** A design that lints clean is a design free of one specific
class of defect. It says nothing about whether your arbiter is fair, your FIFO threshold
is right, or your architecture makes sense. Nothing on this list would have caught nine of
the eleven items in this season's list of ways to go wrong. Clean lint is a floor, not a
ceiling, and treating it as an achievement rather than a precondition is how teams end up
with immaculate code that does the wrong thing.

## The one thing

Width mismatches are the most valuable finding in the field, because truncation is
invisible until the value gets big. Curate the rule set, get to zero, waive in the source
with a reason, gate the build, and lint before you simulate.

## Commute exercise

Two related things to work through.

First: you have an eight-bit counter and a sixteen-bit accumulator. Every cycle the
accumulator adds the counter to itself. The accumulator is assigned from an expression
that adds the accumulator and the counter.

Work out where the width mismatch is. Then work out *when* it first produces a wrong
answer — roughly how many cycles of operation before anybody could notice. Think about
whether your simulation would run that long.

Second, and this is the one to chew on: go back to episode two's exercise, where one
branch of a four-branch case assigned only two of three outputs. I said there were at
least three mechanisms that would have caught it.

Lint is one. The other two are not lint, and they are both things you do while *writing*
the code rather than after. Work out what they are.

If you get both, you have the shape of tomorrow's episode, which is about what a reviewer
looks for — and why the best review comment is one that makes a whole category of bug
impossible rather than fixing one instance of it.
