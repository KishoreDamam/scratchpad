---
season: 4
episode: 4
title: Assertions
runtime: about 11 minutes
prerequisites: s1ep08, s1ep09, s4ep03
one_thing: An assertion that never fires might be proving your design correct, or it might never have been asked. Pair every implication with a cover on its trigger.
---

> Production note: say "vacuous" clearly and define it immediately. It is the word
> this episode exists to install.

## Where we are

Yesterday's awkward property: every request must receive a grant within eight cycles.

You can force it into a covergroup. A counter in the testbench, started when the request rises,
stopped when the grant arrives, sampled at the grant, with bins for each wait from one to eight
and an illegal bin for nine or more. It works.

But notice what you built. A state variable, a counter, a start event, a stop event — a small
hand-written state machine, just to observe one sentence from the specification. And it only
handles one request at a time; if a second request can start before the first is granted, your
counter needs to become a queue of counters.

That is the sign of the wrong language. Covergroups are for values at moments. This sentence is
about a sequence across time. And there is a language for exactly that, built into
SystemVerilog, which answers yesterday's last question as well: it can verify the property,
cover it, and — in episode eight — prove it.

## The problem

Season 1 episode nine introduced assertions: statements that must always be true, written into
the design, checked continuously. "This queue never overflows." It told you why they are worth
it — they catch the bug where it happens rather than forty thousand cycles later where it is
noticed, they are executable documentation, and they keep working forever.

What it did not tell you is how to write good ones, and what goes wrong with bad ones. And
something does go wrong, silently, in a way that makes an assertion worse than useless.

## Two kinds

**Immediate assertions** are simple. At this point in the code, this condition must be true.
They are checked when the line runs, like an assertion in software. "The index is less than the
depth." They are fine for sanity checks inside testbench code and not much else.

**Concurrent assertions** are the ones that matter. They are evaluated on every clock edge, they
can talk about time, and they live alongside the design, watching it continuously. This is the
language called SystemVerilog Assertions, and it has two building blocks.

A **sequence** is a pattern in time. "Request high, then, between one and eight cycles later,
grant high." You describe it as a series of conditions with delays between them — a fixed number
of cycles, or a range.

A **property** is a claim built from sequences. And the most important construct in the whole
language is **implication**: *if* this sequence happens, *then* that one must follow. "If request
rises, then grant must arrive within one to eight cycles."

The left side is called the **antecedent** — the trigger. The right side is the **consequent** —
what must follow. And there are two flavours of implication, which differ by one cycle: one says
the consequent starts on the same cycle the antecedent finishes, the other says it starts on the
next cycle. Getting that one cycle wrong is the most common assertion bug there is, and you will
make it, and the assertion will fire on correct behaviour, and you will spend an hour convinced
the design is broken.

## Where they come from

Two sources, and they have different owners.

**Designer assertions.** Inside the RTL, written by the person who wrote the logic, about things
only they know. This state machine never reaches an illegal state. These select signals are
one-hot. This internal FIFO never overflows. This counter never wraps. They are the designer's
assumptions made checkable — and the best time to write one is the moment you think "this can
never happen", because that thought is exactly an untested assumption.

**Interface assertions.** At the boundaries, about the protocol. And Season 1 episode eight's
valid-and-ready rules are the canonical example. Once valid is raised, it must stay high until
ready is seen. While valid is high and ready is low, the data must not change. These belong to the
protocol, not to any one block, so you write them once and **bind** them onto every interface
that uses the protocol — SystemVerilog lets you attach a checker to a module from outside, without
editing the module. Every valid-and-ready interface in the chip gets the same checks for free.

Both kinds need one more clause: **disable during reset**. While reset is asserted, the protocol
rules do not apply, and an assertion that fires during reset is noise. Every concurrent assertion
you write should say what disables it.

## The trap

Now the thing that goes wrong.

Take the valid-and-ready stability rule. "If valid is high and ready is low, then on the next
cycle valid is still high and the data has not changed." A perfectly good implication.

Now suppose your testbench's downstream side is always ready. Ready is tied high. What happens to
this assertion?

The antecedent is "valid high and ready low". Ready is never low. So the antecedent is never true.
And an implication whose trigger never happens is **vacuously** true — true because nothing was
ever asked of it.

The assertion passes. Every cycle, for the whole regression, green. And it has checked nothing.
The stability logic in the design could be completely broken — data changing mid-stall, valid
dropping early — and this assertion will pass forever, because the situation it was written for
never occurred.

That is **vacuity**, and it is the single most important idea about assertions. A passing
assertion looks exactly the same whether it was satisfied a million times or asked zero times.
From the result alone, you cannot tell.

## The turn

The fix is mechanical, and it is the one thing from today.

**For every implication, write a cover on its antecedent.**

A **cover property** is the third use of the same language. Instead of saying "this must always
hold", it says "tell me when this happens, and count it". So alongside the stability assertion,
you write a cover for "valid high and ready low". At the end of the regression, if that cover has
a count of zero, the assertion was vacuous, and you know — with certainty — that the stall logic
was never exercised.

Look back at yesterday. That cover is functional coverage. The same language that verifies the
property also measures whether it was tested. Assertion and coverage, the two halves, written
side by side from the same sentence in the specification.

And there is a third use waiting for episode eight. The same property can be written as an
**assumption**: instead of checking it, you *require* the environment to obey it. Assert, cover,
assume — one language, three meanings. In simulation you mostly assert and cover. In formal
verification all three matter, and the assumptions become the most dangerous lines in the file.

## Safety and liveness

One more distinction, because it bites in simulation specifically.

"Grant arrives within eight cycles" is a **bounded** property. It can fail at a definite moment:
cycle nine, no grant, failure.

"Grant arrives eventually" is an **unbounded** property — a liveness property. And in a simulation
that runs for a finite time, it cannot fail in any useful way. If the grant never comes, the
simulation simply ends with the property still waiting. Some simulators report that as a failure
at the end; some do not; none tell you *when* it went wrong.

So in simulation, **prefer bounded properties**. If the specification says "eventually", ask what
the real bound is — there almost always is one, somewhere in a latency requirement — and write
that. "Eventually" is a promise nobody can check with a stopwatch.

## The cost

**Assertions can be wrong.** An assertion that is too strict fires on correct behaviour and wastes
a day of debugging the wrong thing. One that is too lax passes broken behaviour. They are code, and
they need review — ideally by the person who owns the specification, because an assertion is a
claim about what the specification means.

**They cost simulation speed.** Thousands of assertions evaluated every cycle add up. In practice
it is rarely the bottleneck, and the debugging time they save dwarfs it, but on very large designs
teams do switch some off in long runs.

**And the timing syntax takes practice.** The one-cycle difference between the two implications,
the ranges, the way sequences can overlap — it takes a few weeks of writing them before you stop
getting the cycle wrong. Expect that. Write a small test for each tricky assertion, with one trace
that should pass and one that should fail, until you trust your reading of the syntax.

## The one thing

An assertion that never fires might be proving your design correct, or it might never have been
asked. Pair every implication with a cover on its trigger, disable it during reset, and prefer a
bound to "eventually".

## Commute exercise

The valid-and-ready stability rule, in words: while valid is high and ready is low, valid must stay
high and the data must stay the same on the next cycle.

On the way home, do three things with it.

First, say it as an implication. What exactly is the antecedent, and what is the consequent, and on
which cycle does the consequent apply?

Second, what should happen during reset — and what happens on the first cycle after reset is
released, if valid happens to be high?

Third, the one worth the drive. Your testbench from episode two randomises backpressure, so ready
does go low. The cover on the antecedent shows a count of forty thousand. Good — not vacuous.

But now suppose the scoreboard compares output packets against expected ones, and every packet
matched. **Is the stability assertion still adding anything?** Or does the scoreboard already catch
everything it would catch? Think about what a scoreboard compares, and what it cannot see.
