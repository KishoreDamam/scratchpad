---
episode: 01
title: Everything happens at once
runtime: about 12 minutes
prerequisites: none
one_thing: Hardware description is a noun, not a verb. You are describing a thing that exists, not steps that happen.
---

> Production note: this is the load-bearing episode for the whole season. Slow
> down on the loop section. Let the "it does not loop, it unrolls" line land.

## Where we are

Last time I promised you two things: that you would lose your sense of sequence,
and that we would build it back. This is the losing episode. It is also,
honestly, the one that people find most disorienting, so if something in the
next quarter of an hour makes you go "wait, that cannot be right" — good. Stay
with it. That reaction is the model changing shape.

## The problem

Here is a small program. Four lines. I will say them out loud and you will have
no trouble at all following them, because you have been reading this shape for
years.

Line one: a equals three.
Line two: b equals a plus one.
Line three: a equals ten.
Line four: c equals a plus b.

What is c?

You did that without effort. a becomes three. b becomes four. Then a becomes
ten. Then c is ten plus four, fourteen. Done. And notice what you relied on to
get there: you relied on *when*. Line three happens after line two. The value of
a depends on where in the list you are standing. The variable a does not have a
value — it has a history, and which point in the history you are at is decided
by which line you are on.

That is the sequential model. Every value is a value-at-a-time. It is so natural
to you that describing it feels pedantic.

Now here is the problem.

Take those same four lines, and instead of a program, imagine I have asked you
to build them. Out of physical objects. On a table. Wires and little boxes that
do arithmetic.

You put down a box that produces three. You run a wire from it to an adder that
adds one, and the adder's output you label b. Fine so far.

Now line three. a equals ten. So you put down another box that produces ten, and
you run a wire from it to — where?

You cannot run it to the same place. The wire from the three-box is already
there. A wire is not a moment in time, it is a piece of metal, and a piece of
metal cannot carry three now and ten later just because you wrote the ten
further down the page. The page has no further down. The table has no further
down. There is only the table, with everything on it, all at once, permanently.

This is the wall. Every single person who moves from software to hardware hits
this wall, and most of them hit it while staring at a compiler error that makes
no sense to them.

## The turn

Here is the turn, and it is a single sentence.

In hardware, a line of description is not a step that happens. It is a piece of
matter that exists.

Say that again to yourself in the car. It is not a step that happens. It is a
piece of matter that exists.

When you write, in a hardware description language, that some signal equals some
other signal plus one, you have not issued an instruction. You have not asked
for something to occur. You have *manufactured an adder*. It is there. It came
into existence when the chip was built and it will be there, drawing power,
adding one to whatever is on its input, until the chip is destroyed. It does not
wait its turn. It does not get called. It is simply an adder, and adders add.

And if you write a second line, you have manufactured a second thing, sitting
next to the first, also always on, also always doing its job.

So the four lines are not four moments. They are four objects on the table, and
the order you wrote them in means nothing at all. You could write them in
reverse and get an identical chip. That is not a quirk of the language. That is
the deepest fact about the subject.

## Living in it

Let me push on this, because the consequences are where it actually gets
interesting.

**Consequence one: the if statement is a physical object.**

In software, an "if" is a fork in the road. You go one way or the other. The
other branch does not execute; that is the entire point of it, and it is how you
avoid doing unnecessary work.

In hardware, both branches exist. Permanently. Simultaneously. If you describe
"if the flag is set use x, otherwise use y", then what gets built is a component
with three inputs — x, y, and the flag — and one output. Both x and y are
arriving at that component constantly. Both are computed. The flag does not
choose which one *runs*, because they are not running, they are just there. The
flag chooses which one gets *forwarded*.

It is a switch, not a fork. In the trade it is called a multiplexer, and you will
hear it shortened to "mux". When you write an if, you have built a mux.

Sit with that for a second, because it inverts something you know deeply. In
software, an unused branch is free. Nothing happens, nothing costs. In hardware,
an unused branch costs exactly as much as a used one. It occupies the same
silicon, burns similar power, and — this matters later — takes the same time to
compute whether or not anyone wants its answer.

So the reflex you have built over a career, where you avoid work by branching
around it, buys you nothing here. You have to unlearn it. Not because branching
is bad, but because the thing you thought you were buying is not for sale.

**Consequence two: a loop does not loop.**

This one is stranger and it is where people's faces change.

You can write a loop in a hardware description language. It looks like a loop.
It has a counter and a body and it counts from zero to seven. And what it
produces is eight copies of the body, side by side, all existing at the same
time, permanently.

It does not iterate. It *unrolls*. The loop is not a construct that happens over
time — it is a shorthand, a copy-paste instruction to the tool, telling it how
many of a thing to lay down on the table. You wrote the word "loop" and you
received a row of eight identical machines.

Which means the loop count is not a runtime cost. It is a *size*. Loop to eight
and you get a small circuit. Loop to a thousand and you get a circuit a hundred
and twenty-five times bigger, and it might not fit on your chip at all, and the
tool will tell you so after forty minutes of trying.

And you cannot loop a variable number of times. Not like this. Because "how many
copies of this machine exist" is a question that has to be answered while the
chip is being *built*, and a chip that has been built cannot grow a ninth copy
of something on a Tuesday because the data turned out to be bigger than
expected.

Everything that has to be decided at build time is decided at build time,
permanently, for all inputs, forever. That is a very different contract than you
are used to.

**Consequence three: the real currency is area.**

In software, your instinct for cost is time. How many operations. How many
passes over the data. You optimise by doing less.

Here, the first currency is space. How much silicon does this occupy. And the
way you make something faster is usually to make it *bigger* — to lay down four
adders instead of one, so four additions can be in flight at the same instant
rather than one at a time.

That trade — more space for more speed — is available to you constantly, and it
is one of the genuine superpowers of the field. In software, if a calculation
takes eight steps, you are largely stuck with eight steps. Here, you can decide
to spend eight times the area and have it take one step. Or you can decide the
opposite: build one small machine and feed it the work eight times over, slowly,
to save space.

That decision — wide and fast and expensive, or narrow and slow and cheap — is
called the area-time trade-off, and a huge fraction of hardware design is just
sitting in that one dial and choosing where to put it.

## The cost

Here is what this way of thinking takes away from you, and I want to be honest
about it because it is a real loss.

You lose "later".

In a program, "later" is free. You can always do a thing afterwards. You can
always add a second pass. You can always say: first compute this, then use it.
The word "then" costs you nothing, you have infinite amounts of it, and you
spend it without noticing.

On the table, there is no then. There are only objects and the wires between
them. Everything is now. And a design that is all now is a design that cannot do
anything complicated, because complicated things are made of stages, and stages
are made of "then".

So we have a model that is beautifully parallel and completely unable to express
the one thing every real design needs: a sense of before and after.

That is not a small gap. That is the central problem of the entire field. And
there is exactly one tool that solves it, one idea that reintroduces time into a
world made of permanent objects, and it is so important that it gets its own
episode tomorrow.

## The one thing

A line of hardware description is a noun, not a verb. It describes a thing that
exists, not a step that happens. Everything you have heard today is a
consequence of that single sentence.

## Commute exercise

On the way home, take the four lines from the beginning — a is three, b is a
plus one, a is ten, c is a plus b — and try to build them on the table.

Not the program. The table. Objects and wires, everything permanent, everything
on at once, no "later" available to you.

You will find you cannot do it as written. The interesting part is not failing.
The interesting part is working out precisely *which word* in those four lines
is the one you cannot build.

Find that word. Hold on to it. Tomorrow I will hand you the machine that makes
that word possible, and you will appreciate it a great deal more for having
spent a drive home missing it.
