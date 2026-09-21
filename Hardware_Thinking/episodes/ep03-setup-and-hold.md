---
episode: 03
title: Setup and hold
runtime: about 12 minutes
prerequisites: ep02
one_thing: Being correct is easy. Being correct inside a window that is a fraction of a nanosecond wide is the job.
---

> Production note: the "photograph" analogy carries the whole episode. Introduce
> it early and keep returning to it rather than switching metaphors.

## Where we are

Yesterday we got time back. We built a register — look, copy, hold — and we
agreed that the design only has to be right at one instant per cycle, the clock
edge. Between edges, chaos is allowed.

I left you with a question about a four-nanosecond calculation and a
two-nanosecond clock, and I will pay that off in episode five.

But first, today, we have to make "the edge" honest. Because I described it as
an instant, and it is not an instant, and everything difficult about this
profession lives in the difference.

## The problem

Let me ask a question that sounds stupid and is not.

When the clock rises and the register "looks at its input" — how long does
looking take?

You might want to answer zero. It is an edge, it is a moment, the value is
captured at that point. But the register is not a mathematical idea, it is a
handful of transistors, and what it physically does at the edge is *let go of
one value and grab hold of another*. That is a mechanical act. It has a
duration. Tiny — tens of picoseconds — but not zero, and not negotiable.

So think about what the register actually needs from you during that grab.

It needs the input to be **already still when the grab starts**. If the value is
still settling as the gate opens, the register grabs a half-formed number.

And it needs the input to **stay still until the grab finishes**. If the value
changes halfway through, the register is holding one thing at the front door and
another at the back, and what comes out is neither.

There is your window. A little before the edge, and a little after it, during
which the input must be absolutely motionless. Not correct — *motionless*.

The best way I know to hold this in your head is a photograph. The clock edge is
the shutter. The exposure is not instantaneous; it takes a moment. If the
subject is still moving when the shutter opens, you get a blur. If the subject
moves before the shutter closes, you get a blur. And a blurred photograph is not
a slightly wrong photograph — it is not a photograph of anything.

The two halves of that window have names, and these two names are on every
timing report you will ever read.

## The turn, part one: setup

The time *before* the edge during which the input must already be stable is
called **setup time**.

Setup is the one that matches your intuition. It says: finish early enough.
Whatever combinational logic is feeding this register — the adders, the muxes,
all those permanent objects from episode one — has to have completely settled a
little before the clock edge arrives. Not at it. Before it.

So the real budget for a cycle is not the full clock period. It is the clock
period minus the setup time, minus the small delay the upstream register takes
to get its own output moving after the edge.

What is left over, after you subtract all of that from the clock period, is
called **slack**. If slack is positive, you made it. If slack is negative, you
did not, and the number tells you by how much.

And here is why this matters more than it sounds: slack is reported for the
*worst* path in your design, and improving any other path does absolutely
nothing. You can spend a week making ninety-nine paths faster and the report
will not move by a picosecond, because the one path you did not touch is still
the one deciding your clock speed. That path is called the **critical path**,
and learning to find it rather than guess at it is a genuine professional skill.

Fixing it, when you find it, is almost always one of three things. Make the
logic shallower — fewer levels of gates between one register and the next. Cut
it in half and put a register in the middle, which is pipelining, episode five.
Or slow the clock down and accept less performance. Those are the moves. There
is no fourth move.

## The turn, part two: hold

Now the other half of the window, and this is the one that breaks people's
models, so I am going to take it slowly.

The time *after* the edge during which the input must remain stable is called
**hold time**.

Read that again and let the implication land. Hold time says a signal can arrive
**too early**.

Every instinct you own says early is fine. Early is safe. If the answer shows up
ahead of schedule, what possible harm is there?

Here is the harm.

Picture two registers in a row with a little logic between them. Call them A and
B. The clock edge arrives at both of them at the same instant, because that is
what a clock is.

At that edge, B is supposed to capture the value that A produced during the
*previous* cycle. That old value is sitting on B's input right now, waiting.

But the same edge also kicks A into producing a *new* value. And that new value
starts travelling immediately, down through the logic, towards B.

So there is a race. On one side, B trying to finish grabbing the old value. On
the other side, A's new value rushing down the path towards B's input.

If the logic between them is very fast — or if there is barely any logic, just a
short wire — the new value can arrive at B's door *while B is still in the act
of capturing the old one*. The subject moved during the exposure. The photograph
is a blur. B captures neither the old value nor the new one reliably, and your
design is broken.

That is a hold violation. And notice something genuinely alarming about it:
**slowing the clock down does not fix it.**

Every other timing problem in your life is fixed by slowing down. Not this one.
Hold is a race between two things that both start at the same edge; the clock
period does not appear in the equation anywhere. A hold violation at one
gigahertz is still a hold violation at one megahertz, and still one at one
kilohertz.

Which makes hold violations a different species of bad. A setup violation is a
performance problem — your chip works, just not as fast as you hoped. A hold
violation is a *dead chip*. It will not work at any speed. And it is a silicon
bug, not a software bug: if it reaches fabrication, no amount of changing the
clock, the voltage, or the firmware brings it back.

The fix, by the way, is wonderfully crude. If the path is too fast, you make it
slower. You insert delay — literally, deliberately, components whose only
purpose is to waste time. Somewhere in nearly every chip you have ever used,
there is logic that exists purely to be slow. There is something very honest
about that.

## The part that makes it hard

Now let me tell you why this is a career rather than an afternoon.

Everything I just described — the setup time, the hold time, how long the logic
takes to settle, how fast the new value races down the path — none of those are
fixed numbers.

They change with temperature. A warm chip is a slower chip.

They change with supply voltage. A little less voltage, a little more delay.

And they change with manufacturing. Two chips off the same wafer are not
identical. One came out slightly fast, one slightly slow, and nobody can tell
you in advance which one is in the box on your desk.

Those three axes have a name you will hear constantly — **PVT**, for process,
voltage, temperature — and the requirement is not that your design works. The
requirement is that it works at *every combination of them*, simultaneously
guaranteed, including the combinations that are individually unlikely.

And they pull against each other in the nastiest possible way. Setup is worst
when everything is slow: hot chip, low voltage, slow silicon. Hold is worst when
everything is fast: cold chip, high voltage, fast silicon. So you cannot tune
for one condition. You have to be simultaneously fast enough for the slow corner
and slow enough for the fast corner, and the gap between those two demands is
the actual space your design has to fit into.

That gap is what the whole timing-closure phase of a project is fighting over.

## The cost

What this takes away from you is the idea that correctness is about logic.

You can have flawless logic. Every equation right, every case handled, every
test passing in simulation. And the chip does not work, because somewhere a
signal arrived forty picoseconds late on a warm day.

In software, "it computes the right answer" is the finish line. Here, it is the
entry requirement. The actual finish line is "it computes the right answer,
everywhere on the chip, inside a window a fraction of a nanosecond wide, across
every temperature and voltage and manufacturing variation the part will ever
see."

That is the shift. Logic is table stakes. Time is the profession.

## The one thing

A signal can be too late, and a signal can be too early, and only one of those
is fixed by slowing down. Being correct is easy. Being correct inside the window
is the job.

## Commute exercise

Two registers, back to back, with nothing between them — output of the first
wired straight into the input of the second. No logic at all. The shortest
possible path.

That arrangement is used deliberately, all over real designs, for reasons we
will get to in episode seven. And by everything I said today it should be the
most hold-violating structure imaginable: the new value has nothing to slow it
down, so it should arrive at the second register almost instantly, right in the
middle of the capture window.

And yet it works. It is one of the safest things you can build.

Why?

The answer is a number that is deliberately engineered into the register itself,
and finding it will tell you something about who is protecting you and how much
they can be trusted. Think about it on the way home.
