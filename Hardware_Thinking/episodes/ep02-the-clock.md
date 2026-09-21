---
episode: 02
title: The clock
runtime: about 12 minutes
prerequisites: ep01
one_thing: The clock does not make things happen. It decides when the answer is believed.
---

> Production note: do not skip the "chaos is allowed" section. It is the part
> people have never been told and it changes how they read timing reports later.

## Where we are

Yesterday we took your sequence away. We established that hardware description
is a noun — that every line you write is a permanent object on a table, all of
them on at once, no order, no "later". And we ended on the gap that leaves: the
word you cannot build is "then".

If you did the exercise, you found it. Line three of that little program —
a equals ten — is unbuildable, not because assigning ten is hard, but because it
means *a was three, and now it is something else*, and a piece of wire has no
mechanism for being one thing and then another.

Today we build that mechanism. There is only one, it is astonishingly simple,
and everything else in digital design is arranged around it.

## The problem

Let me set the problem up properly, because the naive version of it hides what
is actually going on.

Imagine a counter. The simplest useful thing in the world: a machine that
outputs a number, and that number is one bigger than it was before.

On the table, you would build it like this. You take the output, you run it
through an adder that adds one, and you run the result back round to the output.
A loop of wire with an adder in it.

Now think about what that object actually does, physically, permanently, with no
sense of time.

The output is, let us say, five. The adder sees five and produces six. Six
arrives at the output. The output is now six. The adder sees six and produces
seven. Seven arrives at the output.

How fast? As fast as electricity and transistors allow. Which is: extremely.
There is no brake anywhere in that loop. There is nothing that says "one per
second" or "one per anything". You have not built a counter. You have built an
oscillator — a thing that screams up through the number range as fast as physics
permits, and the answer at any instant is whatever it happens to be when you
look.

And it is worse than fast, it is *uneven*. The adder's bits do not all settle at
the same moment. The low bit flips quickly, the high bit has to wait for the
carry to ripple all the way up. So for a brief window after every change, the
output is not a wrong number, it is not any number — it is a smear of bits in
mid-flight, some already updated, some not, some still wobbling. If you looked
at it during that window you would read garbage that never existed as a value.

This is the real problem, and notice it is not the problem you would have
guessed. The problem is not that the circuit is too fast. The problem is that
**there is no moment at which the answer is trustworthy**, because nothing
anywhere in the design has an opinion about when the answer should be finished.

## The turn

The turn is a component called a register. Also called a flip-flop, and you will
hear both.

A register does one thing. It has a data input, a data output, and a third input
called the clock. And its entire behaviour is this: *most of the time, it
ignores its input completely and holds its output perfectly still. At one
specific instant — the moment the clock input rises — it looks at its input,
takes a copy of whatever is there, and that copy becomes its output, held still
again until the next rise.*

That is it. Look, copy, hold. Look, copy, hold.

Now put one of those in the counter loop. Output goes to the adder, adder goes
to the register's input, the register's output is the counter value that goes
back round.

Everything changes.

Between clock edges, the register's output is frozen. Rock solid. Say it is
five. The adder sees a stable five and gets to work producing six. The six may
arrive messily — low bits first, carry rippling up, a smear for a nanosecond or
two — but nobody is looking, because the only thing downstream is the register,
and the register is not paying attention. It is holding five and it is deaf.

Then the clock rises. In that instant, the register looks. It sees six, cleanly
settled by now. It copies six. Its output becomes six and freezes there.

And the whole thing happens again.

You now have a counter. A real one, that counts at a rate you chose, whose value
is meaningful whenever you look at it.

## What actually just happened

I want to name the trick precisely, because it is subtler than "the register
slows things down".

Hardware is continuous. Signals are always moving, always settling, always
mid-flight somewhere. That never stopped being true — we did not fix it.

What we did is agree on **when to look**.

Time in a digital design is not continuous and it is not made of instructions.
It is made of *clock edges*, and between two edges there is no time at all — not
in the model. Between edges, the wires can do whatever they like. They can
glitch. They can show values that are not answers. They can flicker three times
on the way to settling. It does not matter, it is not observed, and this is the
thing nobody tells beginners: **between edges, chaos is not just tolerated, it
is expected**.

The design is only required to be correct at one infinitesimal moment per cycle.
That is the entire contract. Not "always correct" — correct *at the edge*.

And because every register in the design shares the same clock, they all look at
the same instant. Every part of the chip agrees on what time it is. Millions of
components, no central authority, no messages passed — just one wire that
everybody watches, and on the rise of it, the entire machine steps forward
together into the next moment.

That is what a clock is. Not a metronome making things happen. A shared
agreement about when the answers are believed.

## Getting your sequence back

Now the good part. Remember the four lines you could not build?

You can build them now. Because "then" has a physical meaning at last: then
means *the next clock edge*.

a is three — that is a register, holding three.
b is a plus one — that is combinational, an adder, the object from yesterday.
a is ten — that is the same register, taking a new value at the next edge.
c is a plus b — more adders.

You have your sequence back. But look at what it is made of now. It is not free
any more. Each "then" costs you one clock cycle, and a clock cycle is a real
quantity of nanoseconds that you have to budget for, the way you budget money.

Yesterday you had infinite "then" and no way to build it. Today you can build
it, and it has a price tag on it.

That is the trade, and it is the trade that defines the job. Every hardware
engineer is, most of the time, doing one of two things: deciding what happens
within a single cycle, and deciding what needs a cycle of its own.

## The cost

Three costs, and they are all real.

**One: latency.** Every register you insert adds a cycle. A calculation that
passes through five registers takes five cycles to produce an answer, no matter
how simple the arithmetic is. You bought order and you paid in delay.

**Two: power.** The clock has to reach every register on the chip, and there may
be millions of them, and it has to arrive at all of them at very nearly the same
instant. That network — the clock tree — is one of the largest and hungriest
structures on a modern chip. On many designs, the clock distribution alone eats
a substantial share of total power, and it does it whether or not the chip is
doing anything useful. Everything is toggling, all the time, just to keep
everybody agreeing about what time it is.

**Three, and this is the big one: the whole design runs at the speed of its
worst path.**

Think about why. The clock ticks at some rate. Between two ticks, *every* piece
of combinational logic in the entire design must have finished settling — because
at the next edge, every register looks, and any register whose input has not
settled copies a smear.

So you cannot have a fast clock and one slow lump of logic. There is no "this
part takes a bit longer". The single slowest chain of logic anywhere on the chip
sets the clock period for everything. One bad path, in one module, written by
someone else, three years ago, throttles your entire design.

Finding that path, and shortening it, is a huge part of the real work. It has a
name — timing closure — and it is where hardware projects go to die.

Which raises the obvious question, and it is tomorrow's episode: what does
"settled in time" actually mean? How late is too late? And — this is the part
that surprises everyone — how can a signal possibly arrive too *early*?

## The one thing

The clock does not make things happen. It decides when the answer is believed.
Between edges, the design is allowed to be a mess; at the edge, it must be
right.

## Commute exercise

Here is your question for the drive home. It is a real design question and you
have everything you need to answer it.

You have a calculation that takes four nanoseconds to settle. Your clock ticks
every two nanoseconds, so it does not fit — the register looks before the answer
is ready.

You have two ways out. Either slow the clock down until the calculation fits, or
chop the calculation into two halves of two nanoseconds each and put a register
in the middle.

Both work. Both produce correct answers.

So: what is different about them? Specifically — if a thousand calculations come
at you back to back, how long does the whole batch take under each option?

Work it through in your head on the way home. The answer to that question is
worth more to your career than most of what I am going to say in the rest of
this series, and it is the entire subject of episode five.
