---
season: 4
episode: 1
title: SystemVerilog for verification
runtime: about 13 minutes
prerequisites: s1ep09, s2ep01, s3ep11
one_thing: The testbench is software running in simulated time. Its only genuinely hard part is the boundary where it touches the hardware — drive after the edge, sample before it, and let a clocking block enforce both.
---

> Production note: the "two languages in one file" framing is the spine. Say the
> drive/sample rule slowly, twice, the second time as the one thing.

## Where we are

Welcome to Season 4.

First, the debt from the end of Season 3. I asked you to take a block you know, go through
the nine sections of an architecture document, and find the one that would have been cheapest
to write and saved the most.

For most people, most of the time, it is one of two.

**The non-goals.** One paragraph. "This block does not do the following four things." It costs
ten minutes, and its absence costs the argument in month five where somebody discovers the
block does not handle a case they had assumed it did — and by then it is not an argument about
the specification, it is an argument about whose schedule absorbs the fix.

**Or the arbitration paragraph.** Two numbers per requester: bandwidth share under saturation,
and worst-case wait. Its absence costs a performance surprise at integration, which is the most
expensive place to be surprised.

But look at the ninth section again, because I slipped something into it. Open questions — and
then, *what claims must be proven about this design*. That list is where this season starts.
Season 3 taught you to decide what to build. Season 4 is about proving that what you built is
what you decided. Not believing it. Proving it, to a standard somebody else will accept.

## The problem

Season 1 episode nine gave you the philosophy: a generator, a reference model, a checker, run
against each other by the million, with coverage planned in advance. That was the idea.

This season is the practice, and the practice happens in a language.

Here is the uncomfortable thing about that language. The industry standard for verification is
SystemVerilog, and SystemVerilog is also — confusingly — a design language. The same file
extension. The same keywords for modules and ports and always blocks. Many engineers learn the
design half, see that the verification half uses the same syntax, and assume it is more of the
same.

It is not. And the failure mode is specific. You write a testbench the way you write RTL —
everything as wires and always blocks and registers — and it works, sort of, for small things.
Then it needs to generate a random packet of variable length, keep a queue of expected results,
wait for a response that might take a variable number of cycles, and compare out of order. And
writing that as hardware is miserable, because none of it is hardware.

## The turn

The turn is to see that there are **two languages in one file**, and they have different jobs
and different rules.

**The design subset describes hardware.** Everything in it has to become gates. Nothing is
created or destroyed while the circuit runs. The number of registers is fixed at compile time.
Season 2 was entirely about this subset and its discipline.

**The verification subset is a software language.** Honestly, it is a general-purpose
object-oriented language that happens to run inside a simulator. It has classes, with
inheritance. Objects created and garbage-collected while the simulation runs. Dynamic arrays
that grow. Queues you can push to and pop from. Associative arrays — a map from keys to values
— for tracking things by identifier. Strings. Threads that fork and join. Mailboxes and
semaphores for passing things between threads.

None of that is synthesisable. None of it needs to be. Your testbench never becomes a chip.

And once you see it as software, the natural shape of a testbench changes. A packet is an
object, with fields for its length and type and payload. A test creates a thousand of them. A
queue holds the ones you expect to see come out. A thread waits for the output, pops the
expected one, compares. That is ordinary programming, and SystemVerilog lets you do it
directly.

So the first habit of this season: **when you are writing testbench code, think like a software
engineer.** Objects, data structures, threads. Not always blocks.

## The one thing that is not software

But there is exactly one place where the software mindset will betray you, and it is where the
testbench touches the design.

The software lives in simulated time. It says "wait for the clock edge, then set this input".
The design lives in the same simulated time and says "on the clock edge, sample this input". And
now you have two pieces of code both triggered by the same clock edge, one writing a signal and
one reading it.

Which runs first?

This is Season 2 episode one, back to haunt you. In RTL, you fixed it with a mechanical rule —
non-blocking assignments for anything clocked — so that every register sampled the old value and
updated together. In a testbench, the same race exists between your stimulus and the design, and
if you drive an input with an ordinary blocking assignment right at the clock edge, whether the
design sees the new value or the old one depends on the order the simulator happened to schedule
two processes. That order is not defined by the language. Change simulators, or change an
unrelated line of code, and it can flip.

The symptom is the worst kind: a test that passes on one simulator and fails on another, or
passes today and fails after an innocent edit. The design has not changed. The test has not
logically changed. Only the scheduling has.

## The rule

The rule is one sentence, and it is worth saying slowly.

**Drive after the edge. Sample before it.**

The testbench should change the design's inputs a little *after* the clock edge — so that at the
next edge, the new value has been sitting there, stable, exactly as if a real upstream register
had produced it. And the testbench should read the design's outputs a little *before* the edge —
so it sees the value the design settled on during the previous cycle, not a value that is in the
middle of changing.

That is not a testbench convention. It is Season 1 episode three. A real upstream register
launches its output just after the edge and it arrives before the next one, and a real
downstream register samples just before the edge. Your testbench is pretending to be the
registers on either side of the design, so it must honour setup and hold in the same way — just
in simulated time rather than picoseconds.

SystemVerilog gives you a construct that enforces this so you do not have to remember it: the
**clocking block**. You declare, once, which clock the interface runs on, which signals the
testbench drives and which it samples, and the skews — how long after the edge to drive, how
long before to sample. Then every drive and every sample through that clocking block happens at
the right moment automatically.

Pair that with an **interface** — a bundle that groups the signals of one protocol together so
they travel as one thing between the design and the testbench — and you have the standard
structure: the design connects to an interface, the interface has a clocking block, and the
testbench's software objects never touch a raw signal. They talk only through the clocking
block. The race is designed out rather than debugged out.

That is the whole boundary. On one side, hardware with its strict timing rules. On the other,
software with objects and queues. And a thin, carefully timed layer in between.

## What the software side is for

Now that the boundary is safe, it is worth naming what the software side buys you, because it is
most of this season.

**Randomisation, built in.** You can declare a field in a class as random, write rules about
what values are legal, and ask the simulator to produce a value that satisfies them. That is
tomorrow, and it deserves a whole episode.

**Coverage, built in.** You can declare the situations you care about, and the simulator counts
how often each one happened. Episode three.

**Assertions, built in.** Temporal statements — this must be followed by that within so many
cycles — checked continuously. Episode four.

**Classes that can be extended.** A basic packet, and a derived packet with extra rules for an
error-injection test, without editing the basic one. That property is what makes the UVM
framework in episodes six and seven possible.

Each of those would be a library in an ordinary software language. In SystemVerilog they are part
of the language itself, which is why it won — not because it is elegant, but because it put the
generator, the checker and the measurement into one place that already understood simulated time.

## The alternatives

A fair word about the other choices, because they are real.

**cocotb** lets you write the testbench in Python, driving the same simulators. For your own
lab work it is often the better choice: the language is friendlier, the reference model from
Season 3 is probably already in Python, and it runs on free simulators. It handles the boundary
for you in much the same way, by letting you wait for an edge and then wait a little more.

**Plain SystemVerilog without a framework** is fine for a small block.

But in industry, for anything large, the standard is SystemVerilog with the UVM framework, and
reading it is a professional requirement even if you write your own tests in Python. So this
season teaches the ideas in the language the industry uses, and every one of them transfers.

## The cost

**Two mindsets in one file.** You will switch between them constantly, and the switch is where
mistakes happen. The most common one runs in the other direction from today's race: somebody
writes design code with verification constructs in it, a class or a dynamic array or a wait
statement, and it simulates beautifully and then synthesis refuses it or, worse, quietly builds
something else. Keep design files and testbench files separate, and let lint enforce the
boundary.

**A large language.** The verification subset is enormous and parts of it are strange. You do
not need most of it. Classes, queues, associative arrays, randomisation, coverage, assertions,
interfaces and clocking blocks — that is nearly all of what real testbenches use. Learn those
properly, and treat the rest as reference.

**And the simulator matters.** The free simulators support the design subset well and the
verification subset partially. The full language, with UVM, generally needs a commercial
simulator. That is the one genuine paywall the roadmap warned you about, and it lands this
season.

## The one thing

The testbench is software running in simulated time. Think like a programmer everywhere except
the boundary — and at the boundary, drive after the edge, sample before it, and let a clocking
block enforce both.

## Commute exercise

A small scenario. A testbench waits for the rising edge of the clock and then, immediately, with
an ordinary blocking assignment, sets the design's valid input high. The design has a register
that samples valid on the same rising edge.

On the way home, work out what the design sees on that edge. Then notice that the honest answer
is "it depends", and work out on what.

Then two follow-ups.

First, suppose the test passes. Explain how it could start failing after someone adds an
unrelated print statement somewhere else in the testbench.

Second, and this is the one worth the drive: the design team says, "our real upstream block
drives valid from a register, so the testbench should behave the same way". Describe, in words,
exactly what timing the testbench should reproduce — and notice that you have just derived the
clocking block from first principles.
