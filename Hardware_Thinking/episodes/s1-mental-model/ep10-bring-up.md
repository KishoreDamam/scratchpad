---
episode: 10
title: Bring-up
runtime: about 12 minutes
prerequisites: ep07, ep09
one_thing: Never debug more than one unknown at a time. Build a ladder of things you have proved, and only ever stand one rung above it.
---

> Production note: keep the tone calm. The listener may be living through this
> exact situation. Practical, not dramatic.

## Where we are

Yesterday: how you know it works before you build it. Today: the morning it does
not work after you have built it.

This is the episode about the worst day of a hardware project, and about the
method that turns that day from a week into an afternoon.

## The problem

Here is the situation, and it is universal.

Your simulation passes. Every test, every assertion, the coverage model is
closed, the reference model agrees on a billion cycles. You are confident.

You program the real device. You power it up.

Nothing.

Not an error. Not a wrong answer. Nothing. A board with a light on it, drawing
current, doing something invisible and wrong.

And now count what you have lost. In simulation you could see every signal at
every instant, stop time, step backwards, print anything. On this board, you can
see whatever you thought to bring out to a pin, plus whatever the vendor's tools
can look at, and that is all. You have gone from omniscience to a light and a
guess.

Now count what could be wrong. Your logic, of course. But also: the constraints
file, the pin assignments, the clock — is it even running? The reset — did it
reach everywhere, and did it release cleanly? Power supply sequencing. The
external device you are talking to, which may need configuring before it will
respond to anything. The cable. The connector, which may have a cracked solder
joint. The other end of the cable — the PC, its driver, its firewall. The build
itself: did the tool implement what you meant, or did it optimise away half your
design because you left a signal unconnected and it decided the rest was
therefore unnecessary?

Any one of those. And they all present identically: nothing happens.

That is the real problem. Not difficulty — **ambiguity**. Fifteen candidate
causes, one symptom, and almost no visibility.

## The turn

The turn is a discipline and I want to name it precisely, because it is the
single most valuable habit in hardware work.

**Build a ladder of things you have proved, and never stand more than one rung
above it.**

At any instant during bring-up, there should be exactly one thing in your system
you are not sure about. One. If there are two, you are not debugging, you are
guessing, and guessing on a system with fifteen candidates and a feedback loop
of ten minutes per attempt is how a week disappears.

Let me make that concrete, because it has a specific shape.

**Rung zero: prove the hardware without any of your work on it.** Almost every
board comes with a demonstration design from the vendor — a blinking light, a
serial echo, a reference project for whatever interface you care about. Load it.
Watch it work.

People skip this. It feels like a detour; you did not come here to run somebody
else's blinking light. But think about what it buys you. If the vendor's demo
works, then the board is alive, the power is good, the clock oscillator is
oscillating, your programming cable and toolchain work, and for whatever
interface it exercises, the connector, the cable and the far end are all fine.

You have just eliminated eight of your fifteen candidates in twenty minutes, and
— more importantly — you have eliminated them *permanently*. For the rest of the
project, whenever you are staring at a dead link at eleven at night, you know it
is not the cable, because you proved it was not the cable on day one. That
knowledge is worth far more than the twenty minutes.

**Rung one: prove your own build flow with the most trivial design imaginable.**
Your own project, your own constraints, your own tools — and a design that does
nothing but toggle a light once a second.

Because if the light does not blink, you have learned something enormous: the
problem is not your clever logic at all. It is the clock, the reset, the pin
assignments, or the build. And you have learned it in a design so small that
there is almost nowhere for the fault to hide.

That blinking light is not a toy. It is a *clock detector*, and the clock is the
foundation everything else stands on. Chasing a protocol bug for two days and
discovering the clock was never running is a rite of passage, and it is entirely
avoidable.

**Rung two onwards: add one thing at a time, and confirm each before the next.**

The clock runs. Now prove the reset behaves — that it reaches your logic and
releases cleanly.

Then prove you can talk to the external device at all, in the simplest way it
allows, before asking it to do anything real.

Then prove the smallest possible piece of real traffic — one item, sent once,
slowly.

Then prove continuous traffic.

Only then, the actual application.

Each rung stands on proven ground. Each rung introduces exactly one unknown. And
when a rung fails — which it will — the cause is confined to the one thing you
just added, which means you are not searching fifteen candidates, you are
examining one.

That is the whole method. It sounds slow. It is dramatically faster than the
alternative, every single time, and the reason is that the alternative is not
actually a method, it is a sequence of hopeful edits.

## Making it observable

The second half of bring-up is visibility, and the rule is:

**Make it observable before you make it work.**

Instrumentation added before you need it costs a morning. Instrumentation added
during a crisis costs the crisis.

A few instruments worth knowing, roughly in order of cost.

**A light.** One bit of output. Absurdly limited and astonishingly useful.
Blink on clock, and you know the clock lives. Latch it on an error condition and
it never goes out, and now you know the error happened at least once even though
it happened too fast to see. A light that means "this assertion fired since
power-on" answers a question you genuinely cannot answer any other way.

**Counters read out somehow.** How many items arrived. How many were rejected.
How many errors of each kind. These are worth more than almost anything else in
the toolkit, because they turn "it does not work" into a *shape*. Zero items
arrived is a completely different problem from a million items arrived and all
were rejected, which is different again from nine hundred thousand accepted and
a hundred thousand rejected. You have gone from one symptom to a diagnosis in
one reading.

**An on-chip logic analyser.** Modern tools will build a small recorder into
your design that captures a set of signals into on-chip memory when a condition
you specify occurs, and hands the waveform back to you. This is the heavy
instrument and it is how the genuinely mysterious failures get solved — actual
waveforms, from the actual device, at the actual moment of failure.

It has two costs worth knowing. It consumes on-chip memory, which is the scarce
resource from episode six, so you can only watch so many signals for so long.
And — this one catches people — **adding it changes the design.** The extra
logic and the extra routing shift timing slightly. A bug that was marginal can
disappear when you instrument it and return when you remove the instrument. When
that happens, it is not a ghost. It is a timing problem, and you have just been
told so.

## Reading the symptoms

Two patterns worth carrying, because they route you to the right episode.

**Consistent failure — fails identically every time.** That is usually logic, or
configuration, or a constraint. It is in the design, it is deterministic, and it
is reproducible in simulation if you can work out the stimulus. Good news,
relatively.

**Intermittent failure — works, then does not, or works on this board and not
that one, or works cold and fails warm.** That is a timing problem, a clock
domain crossing, a reset that does not reach everywhere cleanly, or something
physical and analogue. Episode three and episode seven.

And the crucial bit: **an intermittent failure will not be found by staring at
the logic**, because the logic is usually correct. It will be found by looking
at timing reports, at domain crossings, at reset distribution, and at the
physical world. People lose weeks to intermittent bugs by debugging them as if
they were logic bugs. If it is intermittent, change what kind of problem you
think you have before you change any code.

One more, and it is the least technical and most valuable: **change one thing at
a time, and write down what you changed and what happened.** Under pressure,
everybody starts changing three things at once because each attempt costs ten
minutes of build time and patience is finite. Then something works and nobody
knows why, which is very nearly as bad as nothing working, because you cannot
defend a fix you cannot explain.

A running log — time, change, result — is the least glamorous tool in this
episode and the one that most reliably separates the people who find the bug
from the people who are still trying things at midnight.

## The one thing

Never stand more than one rung above proven ground. Prove the board with
somebody else's design, prove the clock with a blinking light, then add exactly
one unknown at a time, and make it observable before you make it work.

## Commute exercise

Your design should send data to a PC. It sends nothing. The board is alive, a
light is blinking, so the clock runs and your build flow works.

On the way home, build the ladder out loud. Between "the clock runs" and "my
application data arrives on the PC", list the rungs — each one a thing you could
prove independently, in order, each adding exactly one unknown.

Try to get to five or six. Then, for each rung, ask the practical question:
*how would I actually observe that it passed?* A light, a counter, something on
the PC, an instrument.

If you find a rung you cannot observe at all, you have found the place where
this project is going to lose three days. And you have found it while driving,
which is the cheapest possible place to find it.
