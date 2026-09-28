---
season: 4
episode: 2
title: Constrained random, properly
runtime: about 11 minutes
prerequisites: s1ep09, s4ep01
one_thing: You are programming a solver, not writing a test. Constraints define the legal space; distributions decide where the cycles are spent — and the default distribution spends them in the boring middle.
---

> Production note: the "one in fourteen hundred and thirty-eight" example is the
> centre of the episode. Give the listener a beat to work it out before the answer.

## Where we are

Yesterday's race. The testbench waits for the clock edge and immediately sets valid high with a
blocking assignment. The design samples valid on that same edge.

What does it see? It depends on which of two processes the simulator runs first — the one that
woke up in the testbench, or the one that woke up in the design. Both were triggered by the same
edge. The language says nothing about their order.

And that is how an unrelated print statement breaks it. Adding code can change how the simulator
compiles and orders its processes, and the order is the only thing deciding the answer. Nothing
logical changed; the scheduling did.

And the design team's request derives the fix. A real upstream register changes its output a
small delay after the edge, and the value then sits stable until the next edge, where the design
samples it. So the testbench should change valid *after* the edge — a moment after, not at it —
and the design will see it on the *following* edge, cleanly, every time, on every simulator.
Drive after the edge, sample before it. You have just described a clocking block.

Now that the boundary is safe, we can start pushing things across it. Today: how to generate what
you push.

## The problem

Season 1 episode nine said: stop thinking of test cases, build a machine that generates them.
Constrained-random stimulus. You declare fields as random, write rules about what is legal, and
let the simulator pick.

So you do that. A packet class. Length is random, between sixty-four and fifteen hundred bytes.
Type is random: data or control. And one rule from the specification: control packets are always
exactly sixty-four bytes long.

You run a million packets overnight. Everything passes. Good.

Now a question. How many of those million were control packets?

Take a moment with it, because the answer is the whole episode.

The intuitive answer is half. Two types, pick one at random, half and half.

The actual answer, on a standard SystemVerilog solver, is about seven hundred. Roughly one in
fourteen hundred.

## Why

Because the solver does not pick each field separately. It looks at *all* the random fields
together, works out every combination that satisfies all the rules, and picks uniformly among
those **combinations**.

Count them. A data packet can be any length from sixty-four to fifteen hundred — that is fourteen
hundred and thirty-seven legal combinations. A control packet has exactly one legal length —
that is one combination. So there are fourteen hundred and thirty-eight solutions in total, and
control packets are one of them.

Your control path — the part of the design with its own logic, its own corner cases, and quite
possibly its own bugs — got about a thousandth of the attention you thought it did. And the
regression was green, so nobody looked.

That is not a bug in the solver. It is doing exactly what it promises. It is a misunderstanding of
what you asked for.

## The turn

The turn is a change in what you think you are writing.

**You are not writing a test. You are programming a constraint solver.** And a solver has two
separate things you control.

**The legal space.** What values are allowed at all. That is what the constraints define, and it
comes from the specification. A length outside sixty-four to fifteen hundred is illegal. A
control packet that is not sixty-four bytes is illegal. These are hard rules and they should live
in the transaction class itself, so that every test, forever, produces only legal packets unless
it deliberately says otherwise.

**The distribution within it.** Where, inside the legal space, the solver spends its time. And
here is the rule nobody tells you: **the default distribution is almost never the one you want**,
because uniform over combinations puts nearly all of the probability in the large, boring middle
of the space.

So you shape it, explicitly, with three tools.

**Ordering.** You can tell the solver to choose one field before another — choose the type first,
then the length that suits it. Now the type is decided fifty-fifty on its own, and only then is a
length picked within its rules. That one line fixes the control packet problem entirely.

**Weights.** You can give a distribution to a field instead of a range. Ten percent of the time,
exactly the minimum length. Ten percent, exactly the maximum. Five percent each for one above the
minimum and one below the maximum. The remaining sixty percent anywhere in between. That is not
cheating; that is aiming. Bugs live at boundaries — Season 2 episode eight's off-by-one, Season 2
episode eleven's value that only overflows when it gets big — and a uniform distribution visits
the exact boundary about once in fourteen hundred tries.

**Soft constraints.** A rule the solver follows unless a stronger rule contradicts it. Use them
for defaults. The base packet has a soft rule that it carries no error. A specific error-injection
test adds a hard rule that it does, and the soft one quietly steps aside. The base class never
needs to know error tests exist.

## Randomise the time, not just the data

Here is the thing beginners miss, and it is where most of the real bugs are.

It is natural to randomise the *contents* of transactions — lengths, addresses, payloads — and
then send them back to back, one per cycle, with the downstream always ready.

That tests the datapath. It barely tests the design at all.

Season 1 episode eight: backpressure is a way of thinking, and the bugs in a valid-and-ready
design live in the *timing* — the cycle where valid rises at the same moment ready falls, the
buffer that fills on exactly the cycle the consumer stalls, the burst that arrives while a
previous one is still draining.

So randomise the timing, as deliberately as the data. Random gaps between transactions,
sometimes zero, sometimes long. And, crucially, random backpressure: the testbench playing the
downstream side should drop its ready at random, in bursts, sometimes for one cycle, sometimes
for fifty. A testbench whose downstream is always ready has never tested the stall logic, and
the stall logic is where the bugs are.

## Reproducibility

One more property that makes random testing usable rather than chaotic.

The randomness is not random. It comes from a pseudo-random generator started from a **seed**, a
single number. Same seed, same code, same simulator — same simulation, cycle for cycle.

Which means a failure is not "something went wrong last night". A failure is a seed. You rerun
that seed and it fails again, exactly, every time, and now you can debug it.

So the discipline is simple and absolute: **every run records its seed.** A random failure with no
recorded seed is a rumour. You know a bug exists and you cannot find it. That is the worst state
a verification engineer can be in, and it is avoided by one line in a log file.

The one caveat worth knowing: change the testbench code and the same seed may produce a completely
different run, because the sequence of random calls has shifted. A seed reproduces a failure on a
fixed build, not across edits. When you fix a bug, you rerun the failing seed to confirm — and then
you need coverage, not the seed, to tell you the scenario is still being exercised.

## The cost

**Constraints can conflict.** Write two rules that cannot both be satisfied and the solver fails.
If your code does not check whether randomisation succeeded, you get a transaction with stale or
default values and the test carries on, happily sending garbage. Always check, and fail loudly.

**Worse, constraints can be too tight without conflicting.** This is the silent one. A rule meant
to be narrow is accidentally narrower — you meant length at most fifteen hundred and wrote less
than fifteen hundred — and an entire region of the space quietly disappears. Nothing fails.
Nothing warns. The maximum-length packet is simply never generated, forever.

**And you lose the most comforting thing about directed testing.** With a directed test, you know
exactly what it did. With a random test, you know only what it was allowed to do. Whether it
actually produced a full buffer, or a maximum-length control packet during backpressure, you do
not know by looking at it.

Which is why random stimulus and coverage are not two techniques. They are one technique in two
halves. The stimulus explores; coverage is how you find out where it went. That is tomorrow.

## The one thing

You are programming a solver, not writing a test. Constraints define the legal space from the
specification; ordering, weights and soft rules decide where the cycles are spent — and the
default spends them in the boring middle, far from the boundaries where the bugs live.

## Commute exercise

A FIFO, sixty-four entries deep. Your test pushes with a probability of forty percent each cycle
and pops with a probability of sixty percent. Random, independent, every cycle. You run it for ten
million cycles.

On the way home, work out whether the FIFO ever becomes full.

Think of the occupancy as a walk: each cycle it steps up, steps down, or stays. Which direction
does it drift? Then think about what it would take to climb all the way from empty to sixty-four
against that drift. You do not need an exact number; you need an order of magnitude, and it is
very large.

Then the question worth the drive: the test ran ten million cycles and passed. **What did it tell
you about the full condition?** And how would you ever have known, from the test result alone,
that it told you nothing?
