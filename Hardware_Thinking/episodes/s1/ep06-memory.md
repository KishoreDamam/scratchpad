---
episode: 06
title: Memory
runtime: about 12 minutes
prerequisites: ep01, ep05
one_thing: An array is not a free idea. It is either a pile of registers you can see all at once, or a memory you can peek into once per cycle, and that choice makes the architecture.
---

> Production note: the "how many can you look at simultaneously" question is the
> spine. Everything else hangs off it.

## Where we are

We have a model now. Permanent objects in space. A clock that says when answers
are believed. A window so narrow it polices everything. A controller that walks
a sequence while a datapath sits there wide and dumb and always on. And
pipelining, which buys throughput with latency, and which dies at a feedback
loop.

Today: memory. And I want to warn you that this episode contains the moment
where architecture stops being your choice.

## The problem

In software, you write "array" and stop thinking about it. You have an array of
a million things. You index it. Item seven hundred thousand comes back. The
cost, if you think about cost at all, is a vague sense that big arrays are
slower than small ones.

Here is the hardware question, and it is the only question that matters about
storage. It is not "how much can I store". It is:

**How many of those items can I look at simultaneously?**

Remember why. Everything on the table is permanent and always on. If you build a
register, its output is a wire, and that wire is *always showing its value* to
everything connected to it. Ten registers is ten wires, all visible at once, all
the time. That is what a register file is, and it is why a processor can read
two operands and write a result in the same cycle without anyone thinking it
remarkable.

So: build your million-item array out of registers, and all million values are
visible simultaneously, every cycle, forever.

Which sounds wonderful until you count. A register is not one transistor; it is
something like twenty. A million items of thirty-two bits each, at twenty
transistors a bit, is a chip that does nothing but be an array, and you have not
built any logic yet. And every one of those registers is connected to the clock,
so all of them toggle, so it is an expensive space heater.

You cannot have it. Not at that size. So you need something denser, and denser
means giving something up, and what you give up is precisely the thing that made
registers wonderful.

## The turn

The turn is that storage comes in tiers, they are separated by orders of
magnitude, and you must know roughly where the boundaries are, because the
boundaries decide your design.

**Tier one: registers.** Flip-flops, the component from episode two. Capacity on
a chip: thousands, maybe hundreds of thousands of bits, spread around wherever
you put them. Access: all of them, simultaneously, every cycle, with no latency
at all — the value is just there on a wire. Cost per bit: dreadful. Use them for
state, for pipeline stages, for the handful of values your logic needs to see at
once.

**Tier two: on-chip memory blocks.** Purpose-built arrays of dense storage,
sitting on the same die. On an FPGA these are called block RAMs; on a custom
chip, SRAM macros. Capacity: hundreds of kilobytes, perhaps a few megabytes on a
large part. Cost per bit: maybe a twentieth of a register. Latency: about one
clock cycle — you present an address, and the data arrives the cycle *after*.

And here is the catch, the whole reason they are dense: **you get one or two
accesses per cycle. Total.** Not one per item. One per *memory*. You present one
address, you get one item back. The other hundred thousand items in that block
are not visible, not on any wire, not available. They are in the dark until you
ask for them by name, one at a time.

**Tier three: off-chip memory.** DRAM. A separate component on the board, the
kind of thing you buy by the gigabyte. Capacity: effectively as much as you
want. Cost per bit: trivial by comparison. And the price you pay is enormous and
worth stating precisely.

Latency in the tens of nanoseconds — dozens of clock cycles, not one. Bandwidth
that is large in absolute terms but finite and shared by everyone on the chip
who wants it. It is *sequential by nature*: reading a run of consecutive
addresses is fast, and hopping about randomly can be an order of magnitude
worse, because internally the thing works in rows and every hop means closing
one row and opening another. And it periodically stops serving you entirely to
refresh itself, because it stores bits as charge in tiny capacitors that leak.

Three tiers. Fast, small, everything visible. Medium, medium, one item at a
time. Huge, slow, sequential, and grudging.

## Where it stops being your choice

Now the moment I warned you about. Let me do it with a concrete example,
because in the abstract it sounds like a preference and in the concrete it is a
wall.

Suppose you want to process video. A single frame at a fairly modest resolution
— six hundred and forty by four hundred and eighty, three bytes per pixel — is
about nine hundred and twenty kilobytes. Call it a megabyte. Go up to seven
hundred and twenty lines high and it is nearly three megabytes.

Now look at your chip. Say it is a small FPGA with about three hundred and
thirty kilobytes of on-chip memory, all of it, everywhere, for everything.

A frame does not fit. Not the small one, not by a factor of three. Not with
cleverness, not with compression tricks you would have to build anyway, not by
being careful. It does not fit.

So you cannot hold a frame. And that means you cannot do anything that requires
looking at a whole frame — anything that compares a pixel here with a pixel far
away, anything that needs the previous frame to compare against, anything that
rotates the image.

What can you do? You can hold a *line*. Six hundred and forty pixels at three
bytes is under two kilobytes. You can hold dozens of lines comfortably.

And so your architecture is decided. Not chosen — decided. You are building a
streaming design that sees a few lines at a time and must produce its output
from that narrow window, forever. Every algorithm you consider from now on has
to be expressible in a handful of adjacent lines. That rules out whole
categories of processing and makes others straightforward.

Unless — and this is the fork — you go to tier three and put a DRAM on the
board. Then you can hold frames. And you have also just acquired a memory
controller, a bandwidth budget you have to calculate and defend, latency of
dozens of cycles that has to be hidden behind buffering, arbitration between
everyone who wants access, and a substantial increase in the cost and
complexity of the board itself.

That is a genuine fork in the project, it is decided by arithmetic you can do in
ten minutes on the back of an envelope, and the number of projects that get well
into implementation before someone does that arithmetic is depressingly high.

So here is the professional habit, and it is the point of the episode. **Before
you design anything, work out how many bytes have to be stored, how many bytes
per second have to move, and where they can possibly live.** That calculation
takes ten minutes. It will tell you which tier you are in. And the tier picks
the architecture — you just find out about it.

## The cost

A few things this takes away, beyond the obvious.

**Read latency breaks your mental image of an array.** On-chip memory gives you
data the cycle after you ask. So the moment you use memory rather than
registers, you have a pipeline whether you wanted one or not: address out this
cycle, data back next cycle, use it the cycle after. If your control logic
assumed it could ask and use in the same breath, it is wrong by one cycle, and
"wrong by one cycle" is the single most common bug in this entire field. You
will meet it dozens of times. It never stops being slightly embarrassing.

**Ports are a currency, and you will run out.** Two things wanting to read the
same memory in the same cycle is a conflict, and the memory does not care that
you are in a hurry. Your options are: duplicate the memory so each reader has a
copy, which doubles the storage and means writes must go to both; split the data
across several memories so accesses naturally land in different ones, which is
called banking and only works if the access pattern cooperates; or arbitrate,
which means somebody waits, which means backpressure, which is tomorrow's
episode. There is no fourth option. Those three moves are the whole toolkit.

**And the deepest one: locality stops being an optimisation and becomes a
specification.** In software, accessing memory in a nice sequential order is a
performance tip. Here, if your data arrives as a stream and you can only hold a
few lines of it, then an algorithm that needs to look far away is not slow —
it is *unbuildable on this part*. The distinction between "slow" and
"impossible" is much sharper here than you are used to, and the thing that
decides which side of it you land on is almost always memory.

## The one thing

An array is not a free idea. It is either a pile of registers you can see all at
once and cannot afford many of, or a memory you can peek into once per cycle and
must therefore visit in a careful order. Work out the bytes and the bytes per
second first, and the architecture will tell you what it is.

## Commute exercise

You are going to blur an image. Each output pixel is the average of a
three-by-three square around the corresponding input pixel — so, for every
output, you need three pixels from the line above, three from the current line,
and three from the line below.

The image arrives as a stream: one pixel per clock, left to right, top to
bottom, and once a pixel has gone past you it is gone unless you kept it.

Two questions.

First, how many complete lines do you need to be storing at any moment to make
this work? Think carefully — the naive answer is three and the right answer is
not three, and understanding the difference is exactly the skill.

Second, if the image is a thousand pixels wide and three bytes per pixel, how
much storage is that, and which tier does it land in?

Then the one worth chewing on: what changes if the blur is not three-by-three
but fifteen-by-fifteen? Notice that the *algorithm* barely changed — one number
got bigger — and ask yourself whether the *design* barely changed. That gap
between how much the algorithm changed and how much the hardware changed is the
thing this episode is really about.
