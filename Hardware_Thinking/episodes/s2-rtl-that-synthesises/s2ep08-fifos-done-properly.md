---
season: 2
episode: 8
title: FIFOs done properly
runtime: about 12 minutes
prerequisites: s1ep06, s1ep08, s2ep05
one_thing: Full and empty look identical, and the cycle in which the producer learns it is full is the cycle it overflows. Both problems have standard answers; invent neither.
---

> Production note: the full-versus-empty ambiguity should be posed as a puzzle and
> left hanging for a few seconds before the answer.

## Where we are

Season 1 gave you valid and ready, and the queue that absorbs a stall. This season
has been about the gap between correct-in-simulation and correct-in-silicon.

Today they meet, on the single most-implemented block in digital design. Everybody
writes a FIFO. Almost everybody writes it slightly wrong the first time, in one of
two specific places, and both of them are worth twelve minutes of your commute
because you will build this block dozens of times.

## The problem

A FIFO is simple to describe. A memory, a write pointer, a read pointer. Write, and
the write pointer advances. Read, and the read pointer advances. Both wrap around at
the end. Data comes out in the order it went in.

Now, two questions that have to be answered before the thing is usable.

How do you know it is empty? And how do you know it is full?

Empty seems easy. It is empty when the read pointer has caught up with the write
pointer — nothing has been written that has not been read. The pointers are equal.

Full: start from empty, write until you have gone all the way round, and the write
pointer arrives back at the read pointer.

The pointers are equal.

So the pointers being equal means either completely empty or completely full, and
those are the two most different states the queue can be in. One means "do not read,
there is nothing here". The other means "do not write, you will destroy data". And
the hardware cannot tell them apart.

That is the first problem, and it is genuinely a puzzle rather than an oversight.

## The turn, part one: one extra bit

There are three standard answers and it is worth knowing why one of them wins.

**Sacrifice a location.** Declare the FIFO full when the write pointer is one behind
the read pointer. The pointers are then never equal while full, so equality
unambiguously means empty. It works, it is one line, and it costs you an entry —
which on a sixteen-deep FIFO is six percent of your storage, and on a four-deep FIFO
is twenty-five percent. For a small FIFO built out of registers, that is a real cost.

**Keep a separate count.** A register holding how many items are present. Increment
on write, decrement on read, leave alone when both happen. Empty is count equals
zero, full is count equals depth. This is clear and easy to reason about, and it has
a hidden cost: the count is a shared resource that both the write side and the read
side update, so on the day you want to split the two sides across clock domains, it
does not work at all.

**Add one bit to each pointer.** This is the good one. Make both pointers one bit
wider than they need to be for addressing. The extra top bit is not used to address
the memory — it simply toggles each time a pointer wraps around. Think of it as
recording which lap you are on.

Now: **empty is when the pointers are equal including the lap bit** — same position,
same lap, so nothing is outstanding. **Full is when the lap bits differ and
everything else matches** — same position, one lap apart, so the writer has gone
exactly all the way round.

One bit, complete disambiguation, no lost entry, and — the reason it is the standard
answer — the write side only ever touches the write pointer and the read side only
ever touches the read pointer. Nothing is shared. Which means the same structure
generalises directly to the two-clock case, and that is why every asynchronous FIFO
you will ever read uses it.

While we are here: **do not write your own asynchronous FIFO.** Season 1, episode
seven. Those lap-bit pointers must be Gray-coded to cross domains, the comparisons
have to be done carefully on the correct side, and the resulting design is subtly
harder than it looks. Use your organisation's proven one, or a well-known
implementation, and spend your cleverness elsewhere.

## The turn, part two: the off-by-one that actually costs money

Now the second problem, and this is the one that separates a FIFO that works from a
FIFO that works under load.

You have a correct full signal. The producer is supposed to look at it and stop.

Ask when it looks.

The full signal comes out of your FIFO. Almost certainly it is registered — computed
from the pointers and captured, because if you leave it combinational you have a long
path from the pointer arithmetic, out through the interface, into the producer's
control logic, which is a critical path pointing the wrong way. Season 1, episode
eight warned you about exactly this: ready travels backwards.

So full is registered. Which means the producer sees it **one cycle after it became
true**.

And in that cycle, the producer — knowing nothing — writes again.

Overflow. One item. Silently. The write pointer laps the read pointer, your empty
condition now reads as satisfied, and your FIFO has just discarded its entire
contents from the reader's point of view. One extra write, total corruption, no
error message.

Now make it worse. Put a register on the producer's side too, because its control
logic is also pipelined. Two cycles of delay. Route the signal across a large chip
and add a pipeline register for timing. Three cycles. Every register you add for
perfectly good timing reasons adds another item that gets written after the FIFO
said stop.

This is why real FIFOs do not just have full and empty. They have **almost-full and
almost-empty**, with a programmable threshold. Almost-full asserts N entries before
the end, where N is at least the number of cycles it takes for the signal to reach
the producer and for the producer to actually stop.

And the rule for choosing N is worth memorising, because it is the whole lesson:
**count the registers in the round trip and add margin.** How many cycles from the
condition becoming true to the last possible write arriving. That number of spare
entries, minimum. Then a bit more, because somebody will add a pipeline stage later
and not think about this.

The same argument applies exactly in mirror image to almost-empty and the reader. A
reader that learns one cycle late that the FIFO is empty reads a location containing
stale data, and stale data that happens to look plausible is the worst kind.

So: **the producer's stop signal is almost-full, not full. Full is an assertion.** A
thing that should never happen, which you check with a Season 1 episode nine
assertion that fires loudly in simulation if it ever does. If your producer is
looking at full to decide whether to write, your design is one pipeline register away
from silent data loss.

## The read latency question

One more thing that trips people when connecting a FIFO into a valid-and-ready
system.

If the FIFO's storage is a real memory block, then reading has a cycle of latency —
Season 1, episode six. Present the address this cycle, data appears next cycle.

So there are two flavours, and knowing which you have is not optional.

The **standard** flavour: you assert read, and the data is valid on the following
cycle. Simple internally, and it means your data output is not the head of the queue
until a cycle after you asked.

The **first-word fall-through** flavour: the data output *always* shows the head of
the queue, valid immediately, and your read signal means "I have taken that one, move
on". This is what a valid-and-ready interface actually wants — valid means the data is
there now, and ready means take it. It costs a small output register stage and some
slightly fiddly control to keep that stage loaded.

Almost every time you connect a FIFO to a streaming interface, you want
fall-through, and almost every time somebody wires up the standard flavour by mistake
the result is a system that is off by one cycle in a way that appears to work in the
easy cases. Know which one you have. Say so in the module name.

## Sizing it

Briefly, because it is the exercise from Season 1 episode eight and it deserves the
callback.

Depth is not a round number you pick. It comes from the traffic. If the consumer
stalls for a known worst case of forty cycles while the producer keeps delivering one
item per cycle, you need forty entries plus your almost-full margin, and then you
never stall the producer.

And if the consumer's average rate is *lower* than the producer's average rate, no
depth is sufficient. Any finite queue fills eventually, and your only remaining
choices are to stall the producer or to drop data. That is the answer to the last
question in Season 1, episode eight, and it is why every network on earth has a place
where packets get dropped. A queue absorbs *bursts*. It cannot fix a *rate*. Confusing
those two is how buffers get sized by guesswork and systems get latency nobody
budgeted for.

## The cost

A properly built FIFO has more in it than people expect: lap-bit pointers,
almost-full and almost-empty with justified thresholds, a documented read flavour, a
sizing argument that traces back to a traffic analysis, and assertions on the
conditions that must never occur.

That is perhaps three times the code of the naive version, and every line of it
exists because of a specific failure. This is the block to write carefully once,
parameterise properly — tomorrow's topic is arbiters, and the day after is
parameterisation — and then never write again.

## The one thing

Equal pointers mean both full and empty, so add a lap bit. And the producer must stop
on almost-full, sized by counting the registers in the round trip, because the cycle
it learns about full is the cycle it overflows.

## Commute exercise

A FIFO, sixteen deep. The full signal is registered inside the FIFO. It crosses to
the producer through one pipeline register added for timing. The producer's own
control logic registers its decision before the write actually happens.

On the way home: how many writes can arrive after the FIFO's internal state first
became full? Count carefully — walk the cycles one at a time.

Therefore, what must the almost-full threshold be, at minimum?

Then the part that turns it into engineering judgement. With that threshold set, how
many of your sixteen entries are actually usable for absorbing bursts? Work out the
percentage.

And then: at what depth does this scheme stop making sense entirely — where the
margin eats so much of the FIFO that you should be solving the problem a different
way? Getting to that number tells you something real about why small FIFOs and large
FIFOs are designed differently.
