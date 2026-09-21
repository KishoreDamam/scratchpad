---
episode: 05
title: Pipelining
runtime: about 11 minutes
prerequisites: ep02, ep03
one_thing: Pipelining buys throughput with latency. It is nearly free when work queues up, and worth nothing when it does not.
---

> Production note: pay off the episode-two exercise in the first two minutes.
> The listener has been carrying it for three days.

## Where we are

Three episodes ago I left you with a question and it is time I paid it.

A calculation takes four nanoseconds. Your clock ticks every two. It does not
fit. You have two ways out: slow the clock to four nanoseconds, or cut the
calculation in half and put a register in the middle. And I asked: if a thousand
calculations come at you back to back, how long does the batch take each way?

Slow clock: one answer every four nanoseconds. A thousand answers, four thousand
nanoseconds.

Split in half: each half settles in two nanoseconds, so the clock stays at two.
And here is the thing — while the second half is working on calculation number
one, the first half is already working on calculation number two. Both halves
are busy. Every two nanoseconds, a finished answer falls out the end. A thousand
answers, two thousand nanoseconds plus a couple of cycles of start-up.

Same silicon, roughly. Same arithmetic. Twice the work done.

That is pipelining, and today is about what it really costs, because "twice as
fast for one register" is the kind of deal that should make you suspicious.

## The problem

Let me state the problem in the form it actually shows up in.

You have built something. It works. And it is too slow — the timing report says
your critical path is four nanoseconds and the clock you need is two.

Episode three gave you three moves: shallower logic, cut it and insert a
register, or slow the clock. You have already made the logic as shallow as you
can. Slowing the clock is losing. So: cut it.

But *where*? And how many times? And what breaks when you do?

## The turn

The turn is the assembly line, and I want to use it carefully, because most
people take the wrong lesson from it.

The wrong lesson is "assembly line means fast". The right lesson is far more
specific.

On an assembly line, each car takes just as long to build as it ever did.
Possibly longer — there is handling between the stations. What changed is that
you no longer build one car, finish it, and then start the next. You build
twenty cars at once, each at a different station, and a completed car rolls out
of the end at the rate of the *slowest single station*, not the rate of the
whole build.

That is the distinction the whole episode rests on, and it has two names worth
saying properly.

**Latency** is how long one item takes to get from the front to the back.
**Throughput** is how many items come out per second.

Pipelining does not improve latency. It usually makes latency slightly *worse*.
What it improves is throughput, and it improves it by a lot.

Now put that in hardware terms. Your four-nanosecond calculation becomes two
stages of two nanoseconds with a register between them. The register is the
station boundary — the place where a half-finished item is set down, held
perfectly still by the clock, and picked up by the next station on the next
cycle.

Cut it into four stages of one nanosecond each and you can run a one-nanosecond
clock: four answers in flight at once, one falling out every nanosecond. The
latency of any single calculation is still four nanoseconds — it just gets there
as four cycles instead of one long one. But you are now producing four times as
many answers per second as you did before.

This is where hardware speed genuinely comes from. Not from clever arithmetic.
From having many pieces of work in the air simultaneously, each at a different
stage of completion.

## Where to cut

Two rules, and they are almost all of the practical skill.

**Balance the stages.** The clock is set by the slowest stage. If you cut four
nanoseconds into a three and a one, your clock is three nanoseconds and you
wasted the register. The one-nanosecond stage sits idle for two-thirds of every
cycle, drawing power, contributing nothing. Cutting in the wrong place can buy
you almost none of the benefit while costing you the full price.

**Cut where the wires are narrow.** Every signal crossing the cut needs a
register bit. Cut across a place where sixty-four bits are in flight and you pay
sixty-four registers. Cut somewhere the design has naturally narrowed and you
might pay eight. Same speed-up, one-eighth the cost. Looking for the narrow
waist is a habit worth building.

## The cost

Now the honest part, because so far this has sounded free.

**Latency gets worse, and sometimes latency is the product.** If you are
streaming video, nobody cares that a pixel took twelve cycles instead of three;
they care that pixels arrive continuously. But if you are closing a control loop
around a motor, or deciding whether to brake, latency *is* the specification and
throughput is irrelevant. Pipelining a latency-critical path is not a
performance win, it is a regression that shows up on a spreadsheet as a win.

**You are paying in registers, area and power.** A deeply pipelined design can
carry a startling amount of silicon whose only job is holding partial results
still. All of it toggles every cycle. All of it burns power.

**The control problem is now real.** With ten things in flight, what happens
when something goes wrong at stage seven? The six items behind it are already in
the pipe. Do you throw them away and start again — that is a flush — or do you
freeze the whole line while stage seven sorts itself out — that is a stall? Both
need logic. Both need every stage to understand and obey. And that control logic
is where the bugs live, because it only activates in unusual circumstances,
which means it is exactly the logic your tests exercise least.

**And the one that stops you dead: you cannot pipeline a loop around itself.**

This is the real limit and it is worth understanding properly.

Pipelining works when item number two does not need item number one's answer.
Cars on a line are independent; car twenty does not care what happened to car
nineteen.

But think about the counter from episode two. The next value *is* the current
value plus one. To start calculating the next one, you need this one finished.
There is no "start early" available. If the adder takes four nanoseconds, the
counter runs at four nanoseconds, and cutting the adder in half achieves exactly
nothing, because the second half is still waiting on the first half for the same
single item.

Any path that feeds back into itself has this property. The general name is a
**loop-carried dependency**, and the rule is brutal and simple: **a feedback
loop runs at the speed of the whole loop, and pipelining cannot help it.**

This is why an accumulator, a filter with feedback, or any "next value depends
on current value" structure is so often the thing that caps a design's clock
speed. And when you meet one, the escape is never to pipeline harder. It is to
change the mathematics so the loop is shorter, or to break one loop into several
independent ones that you combine at the end — for instance, four separate
accumulators each summing every fourth item, added together once at the very
end. Four short loops instead of one long one. That is real work, and it is
design work, not tuning.

So the honest summary is this. Pipelining is close to free when work is
plentiful and independent. It is worth nothing when work arrives one item at a
time, and it is unavailable when each item depends on the last.

Which tells you something about the whole field, actually. Hardware is
spectacular at streams and poor at conversations. Every time you see a piece of
hardware massively outperform a processor — video encoding, cryptography,
networking, signal processing, machine learning inference — look closely and you
will find a long queue of independent work. And every time hardware
disappointingly fails to beat a processor, look closely and you will usually
find a feedback loop.

## The one thing

Pipelining buys throughput and pays in latency. It is close to free when work
queues up, worth nothing when it does not, and impossible around a feedback
loop.

## Commute exercise

You have a pipeline of five stages. Each stage takes one nanosecond. So a one
nanosecond clock, an answer every nanosecond once it is full, and five
nanoseconds of latency for any single item.

Now: work arrives in bursts. One item, then nothing for a hundred nanoseconds.
Then one item, then nothing for a hundred nanoseconds.

Two questions for the drive home.

First — what is your actual throughput, in answers per nanosecond, in that
situation? Compare it with the number you would put on a slide.

Second, and this is the real one: given that traffic pattern, would the
un-pipelined version — one slow stage, a five-nanosecond clock, no registers in
the middle — be *better*? Consider power. Consider area. Consider how long a
single item takes end to end in each case.

If you get to an answer that makes you slightly uncomfortable about a decision
you have seen someone make, you have understood the episode.
