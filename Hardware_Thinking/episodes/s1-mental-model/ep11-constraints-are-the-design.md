---
episode: 11
title: Constraints are the design
runtime: about 13 minutes
prerequisites: all previous
one_thing: In hardware you do not design a thing and then check whether it fits. You compute what fits, and the design is what is left.
---

> Production note: the season finale. Recap all eleven "one things" in the
> middle section, deliberately, as a single run. It is the memory anchor.

## Where we are

At the end. Eleven episodes ago I promised you two things: that you would lose
your sense of sequence, and that you would build it back yourself.

You lost it in episode one, when every line became a permanent object on a
table. You started getting it back in episode two, with a clock that decided
when answers are believed. You got it back properly in episode four, when the
controller turned out to be the one place where your flowchart instinct was not
just permitted but correct.

Today is the synthesis. One more idea — the biggest one — and then a look at
what you actually have.

## The problem

Let me describe how a project goes wrong, in a way you may recognise from other
fields.

Someone has a good idea. They design it. They draw the architecture, they pick
the modules, they define the interfaces, they are pleased with it. Then, near
the end, somebody asks whether it fits on the target device.

And it does not. It is three times too big, or it needs twice the memory
bandwidth the board can supply, or the critical path means it will run at a
third of the required clock speed.

Now what? Everything is coupled. The module boundaries were drawn on assumptions
that turn out to be false. The verification was written against those
boundaries. Fixing it is not tuning — it is redesigning, with the schedule
already spent, which is why the actual outcome is usually a design that ships
slow, or does not ship.

Here is the thing to notice. That was not a failure of execution. Everybody did
their job well. It was a failure of *ordering*. The fitting question was asked
last, and it was a question that determines everything, which means it had to be
asked first.

## The turn

In hardware, constraints are not a check you perform on a design. Constraints
are the *input* to the design. They come first, and the design is the thing that
falls out of them.

You have already seen this happen three times in this series, and I want to
point at them explicitly because they are the same move.

In episode six, we asked whether a video frame fits in on-chip memory. It did
not, by a factor of three. And that single arithmetic fact — done on the back of
an envelope in ten minutes — decided that the design was a streaming,
line-buffered architecture, and ruled out every algorithm that needs to see the
whole frame. Nobody chose that architecture. The memory budget chose it, and the
designer's job was to find out.

In episode three, the timing window decided how much logic may sit between two
registers. Not as a guideline — as a hard division. Take the clock period,
subtract the overheads, and what remains is the number of levels of logic you
are permitted. That number is small, it is not negotiable, and everything about
how you break up your computation follows from it.

In episode five, the dependency structure of the work decided whether pipelining
was available at all. Independent items, pipeline freely. A feedback loop, and
no amount of engineering effort buys you anything, because the limit is in the
mathematics of the problem rather than in the implementation.

Same move each time. A number, computed early, that removes most of the design
space — and what is left is the design.

So the habit to build, and this is the practical heart of the episode: **before
designing, write down the budgets.**

How many bits per second must move, at every interface. How many bytes must be
stored, and in which tier. How many clock cycles are available per item — which
is just the clock rate divided by the required item rate. How much area, how
much power.

Four or five numbers. An hour's work, maybe an afternoon if some of them are
hard to pin down. And when you have them, most of your architectural questions
will already be answered, because most candidate architectures will be
arithmetically impossible and you will be able to see it.

That is why experienced hardware engineers sometimes seem to skip the design
phase and go straight to an answer. They are not being clever. They did the
arithmetic, and the arithmetic left one option standing.

There is a second, quieter benefit. Constraints, computed early and written
down, are the most effective tool there is for having honest conversations with
people who want things. "We cannot do that" is an opinion and invites argument.
"That requires one point two gigabits per second across a link that carries one
gigabit" is not an opinion. The constraint does the arguing, which means you do
not have to.

## What you have now

Let me give you the season back as eleven sentences. This is the part to
remember, and if you only ever replay two minutes of this series, make it these.

**One.** A line of hardware description is a noun, not a verb. It describes a
thing that exists, not a step that happens.

**Two.** The clock does not make things happen. It decides when the answer is
believed.

**Three.** A signal can be too late and a signal can be too early, and only one
of those is fixed by slowing down.

**Four.** Split the design in two: a datapath that is pure space, and a
controller that is pure sequence.

**Five.** Pipelining buys throughput and pays in latency, and it cannot help a
feedback loop.

**Six.** An array is either a pile of registers you can see all at once, or a
memory you can visit once per cycle — and that choice makes the architecture.

**Seven.** You cannot eliminate metastability. You can only give it time and
make it rare enough that something else ends the product first.

**Eight.** Two wires — I have something, I can take something — turn rigid
blocks into a system you can rearrange.

**Nine.** Verification is not "my tests passed". It is a claim about what you
checked, backed by a plan written before you started.

**Ten.** Never stand more than one rung above proven ground.

**Eleven.** You do not design a thing and check whether it fits. You compute
what fits, and the design is what remains.

Eleven sentences. That is the model. Everything else — every language, every
tool, every vendor, every part number — is lookup, and lookup is cheap.

## And about how you think

One last thing, and it is personal rather than technical.

You told me you think sequentially. You break problems into ordered steps and
walk them. And at the start of this series I asked you to put that down for a
while, because episode one really does punish it.

But look at what the last few episodes turned out to be made of.

The ladder of doubt in bring-up — one rung at a time, never two unknowns, each
step standing on proven ground — that is sequential thinking used as an
engineering instrument. The people who are bad at it are the ones who cannot
resist changing three things at once.

The coverage model in verification — enumerate the situations, systematically,
before writing the tests, and be uncomfortable about the ones unaccounted for —
that is sequential thinking too. And it is the thing that most distinguishes
people who verify well from people who merely test.

The controller in episode four is *literally* a flowchart turned into silicon.

So the honest summary is not that sequential thinking is a handicap here. It is
that it has a *correct scope*, and the whole difficulty is learning where the
boundary is. Inside the datapath, in that one cycle where everything happens at
once, sequence is the wrong tool and it will mislead you. Everywhere else — in
control, in verification, in bring-up, in the order you compute your budgets —
it is exactly the right tool, and it is the one most often missing from a team.

That was the real arc. Not losing the sequence and getting it back. Learning
which room it belongs in.

## The cost

Every episode ended with a cost, so this one should too.

The cost of thinking this way is that it is slower at the start and it looks
like less progress. Computing budgets produces no working code. Building a
ladder of proven rungs produces no features. Writing a coverage plan before the
design produces nothing you can demonstrate to anyone.

You will, regularly, be standing next to somebody who skipped all of it and
appears to be well ahead of you.

They are not ahead. They are carrying a debt that has not come due. It comes due
during bring-up, or at timing closure, or in the field, and it comes due with
interest, and by then it is not a week of work but a redesign.

Knowing that — and holding your nerve during the part where you look slow — is
most of what seniority actually consists of in this field.

## Where to go from here

Three things, in order, and only the first one matters right now.

Get a small development board and make a light blink. Not a simulation, a real
device, your own toolchain, on your desk. It is rung one from episode ten and it
converts about a third of this series from something you have heard into
something you have done.

Then build one thing that has a datapath and a controller. Anything. A serial
transmitter, a small protocol decoder, a counter with a display. The size does
not matter; the *shape* does — two parts, one spatial and one sequential, with a
clear line between them.

Then write a self-checking testbench for it, with a reference model you wrote
before the logic, and let it run a million random cases while you make coffee.
The first time a machine finds a bug you would never have thought of, the
verification episode stops being advice and becomes a habit.

That is the series. Two and a half hours, eleven sentences, and about a week of
evenings to make it real.

## The one thing

You do not design a thing and then check whether it fits. You compute what fits,
and the design is what is left.

## Commute exercise

One last one, and it is the whole season at once.

Pick a real problem — from work, or invent one. Something with data moving
through it at a rate.

On the way home, do only this: compute the budgets. How many bits per second at
each interface. How many bytes must be held, and in which tier. How many clock
cycles you get per item, given a clock rate you pick and an item rate the
problem demands.

Do not design anything. Resist it. Just get the numbers.

Then notice how many of the architectural questions you were about to spend a
week on have quietly answered themselves while you were in traffic.

That is the skill. Thanks for the listening.
