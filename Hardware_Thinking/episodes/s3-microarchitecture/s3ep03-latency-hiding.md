---
season: 3
episode: 3
title: Buffering and latency hiding
runtime: about 13 minutes
prerequisites: s1ep05, s3ep02
one_thing: Latency you cannot remove, you can cover — by having enough work in flight to fill it. The price is storage equal to bandwidth times delay, and the loss of ordering.
---

> Production note: the distinction between hiding latency and reducing latency must
> be made explicitly. Listeners conflate them and then misapply the technique.

## Where we are

Yesterday's exercise. Nineteen twenty by ten eighty at sixty frames a second is a
little over a hundred and twenty-four million pixels per second, and at a hundred and
fifty megahertz that is about one point two cycles per pixel. Just above one, so
twenty percent of slack — which sounds comfortable.

Then the twist. Video does not arrive uniformly. With standard timings, the pixels of
a frame are delivered inside a stream with blanking gaps, and the instantaneous rate
during an active line is close to one pixel per clock with essentially no margin at
all.

So the twenty percent slack is real but it is *not available at the moment you need
it*. It exists during blanking, when no pixels are arriving, and the work arrives
during the active line, when there is none.

Which gives you exactly two designs. Build the compute fast enough for the active
rate, with no slack, and the blanking is idle time you waste. Or buffer a line, run
the compute at the comfortable average rate, and spend the blanking catching up.

The first is simpler and has to be faster. The second is slower and needs storage. And
that trade — **storage in exchange for not having to be as fast** — is today's whole
subject, generalised.

## The problem

You have a stage with latency you cannot remove.

Not slow — *distant*. Some examples, all real. A read from off-chip memory: fifty to
a hundred cycles before the data comes back, because that is what Season 1 episode six
said tier three costs. A request across a large chip through several pipeline stages of
interconnect: twenty cycles each way. A divider, which Season 2 episode six told you is
intrinsically iterative: thirty cycles. A transaction over a serial link to another
device: hundreds.

Now do the naive thing. Issue a request, wait for the answer, use it, issue the next
request.

Count the cost. If the latency is fifty cycles and you can consume one item per cycle,
then you are achieving one item every fifty-one cycles. You are running at two percent
of your capability, and the other ninety-eight percent is spent waiting.

And here is the thing to be clear about: **the latency is not your fault and it is not
going away.** The memory is off-chip because it has to be. The interconnect is long
because the chip is large. The divider is iterative because division is iterative. No
amount of RTL skill removes any of it.

## The turn

You cannot make the wait shorter. You can make the wait *productive*.

Issue the second request before the first one's answer arrives. And the third. And the
tenth. Keep issuing, so that at any instant there are many requests outstanding,
travelling out and coming back. The latency of each one is unchanged — every single
request still takes fifty cycles — but the answers now arrive one per cycle, in a
steady stream, because you started them one per cycle fifty cycles ago.

That is latency hiding, and I want to draw the distinction sharply because people
conflate these constantly:

**Reducing latency** makes one item faster. **Hiding latency** makes the *pipe* full
while each item stays exactly as slow as before.

If you have one item and you need the answer now, hiding does nothing for you.
Nothing. The item takes fifty cycles and that is the end of it. Hiding is worthless for
a single request and transformative for a stream of them — which, you will notice, is
precisely the condition Season 1 episode five gave for pipelining, because this is the
same idea applied to something you do not own.

## How much does it cost

Here is where yesterday's second number pays off.

To keep the pipe full you need enough requests in flight to cover the latency. Little's
Law: items in flight equals throughput times latency. One item per cycle for fifty
cycles of latency means **fifty items in flight**.

And every one of those fifty items needs state. Somewhere in your design there must
be room for fifty outstanding requests' worth of tracking information, and room for
fifty results, because they will come back faster than you might be able to consume
them.

That product — your desired bandwidth multiplied by the latency you are covering — is
the **bandwidth-delay product**, and it is the cost of latency hiding. It appears
everywhere: it is why a network connection over a long distance needs a large window,
it is why memory controllers have deep queues, and it is why a high-performance
processor devotes a startling fraction of its area to structures whose only job is
remembering what it is waiting for.

Three consequences worth carrying.

**The storage is proportional to the latency you are covering.** So halving a latency
halves a buffer. This is why architects care so much about interconnect latency even
when throughput is fine — the latency is not the problem, the *buffering the latency
forces everywhere else* is the problem.

**If you cannot afford the storage, you cannot have the bandwidth.** Not "you will be
a bit slower" — the arithmetic is hard. If your bandwidth-delay product is a hundred
items and you have room for ten, you will achieve ten percent of the rate. This is a
genuinely useful thing to be able to say in a design review, with numbers, before
anyone has built anything.

**And the buffer is not optional slack, it is load-bearing.** A buffer sized for
average behaviour will not do. This is a structural requirement of running at that rate
at all.

## The techniques

Four, in increasing order of how much they ask of you.

**Multiple outstanding requests.** The basic move. Instead of one request at a time,
allow several — this is why real interfaces have a notion of how many transactions can
be in flight, and why that number is a headline parameter. Your design tracks each one,
and the number of them is your bandwidth-delay product.

**Prefetch.** If you can predict what you will need next — and in a streaming design
you almost always can, because you are walking through data in order — then request it
before you need it. A prefetcher is simply a small machine that runs ahead of the
consumer, issuing requests for addresses the consumer has not asked for yet, into a
buffer the consumer reads from.

This is enormously effective for sequential access and worthless for random access.
Which means prefetch is a bet on predictability exactly as a cache is a bet on reuse —
and that is episode seven.

**Decoupling buffers.** Put a FIFO between the requester and the consumer, so the
requester can run ahead and the consumer can fall behind, and neither one's hiccups
propagate to the other. This is Season 1 episode eight's queue, used deliberately as a
performance structure rather than as a rate matcher. The rule of thumb: put a
decoupling buffer wherever two things have independent stall behaviour, and size it
from the worst-case burst.

**Double buffering.** Which is tomorrow, because it is the case where the unit of work
is a block rather than an item, and it needs its own treatment.

## What it takes away from you

Now the cost that is not storage, and it is the one that produces bugs.

**Order.**

With one request outstanding, the answer that comes back is obviously the answer to
your question. With fifty outstanding, answers may come back **out of order** — because
one hit a different memory bank, one was reordered by an arbiter along the way, one was
serviced faster because it hit a cache and another missed.

So every answer must carry identification. You tag each request, the tag comes back
with the response, and you use it to work out which of your fifty outstanding items
this belongs to. That is what the identifier fields in real bus protocols are for, and
Season 7 will spend a whole episode on how badly that can go.

And if your design needs results *in order* — which streaming designs usually do,
because the pixels have to come out in the order they went in — then you need a
**reorder buffer**: storage that accepts answers in whatever order they arrive and
releases them in the right one.

Which has a nasty property worth knowing. A reorder buffer can block. If answer number
three arrives and you are still waiting for number one, you cannot release three, so it
sits there occupying space. A single very slow response stalls everything behind it,
even though those answers are ready. That is called head-of-line blocking, it is one of
the classic performance pathologies in system design, and it is a direct consequence of
demanding order from a system you deliberately made unordered.

So: think hard about whether you really need ordering. Sometimes the answer is that the
consumer can accept items out of order if they are tagged, and deleting the ordering
requirement deletes both the reorder buffer and the pathology. That is an architectural
decision, available now, and unavailable once four blocks assume ordering.

## The cost

Latency hiding costs storage proportional to the latency, it costs tracking state per
outstanding item, it costs a reorder mechanism if you need order, and it costs a
substantial amount of control complexity that is only exercised under load.

That last one deserves the Season 1 episode five warning repeated: the logic that
handles many-things-in-flight is the logic your tests exercise least, because it only
activates when the pipe is full and the responses are late and out of order. So it is
the logic most likely to be wrong in silicon. Verify it with saturation and with
deliberately reordered, deliberately delayed responses — never with a cooperative
model that answers in one cycle in order.

## The one thing

You cannot shorten the wait, so fill it. Items in flight equals bandwidth times
latency, and that product is the storage you must provide to earn that rate. The price
beyond storage is ordering, and ordering brings head-of-line blocking.

## Commute exercise

You are reading from an off-chip memory. The latency is eighty cycles. You want one
thirty-two-bit word per cycle, sustained.

On the way home: how many requests must be outstanding? How many bytes of return
buffering, minimum?

Then: your design can only track sixteen outstanding requests, because that is what the
interface supports. What rate do you actually achieve? Express it as a fraction of what
you wanted.

Then the design question. You need the full rate and you cannot have more outstanding
requests. But you *can* make each request bigger — ask for eight words at a time
instead of one.

Work out what that does to the arithmetic. Then work out what it costs you: think about
what happens if you only needed one of those eight words, and what that does to your
effective bandwidth when the access pattern is not sequential.

You have just derived, from first principles, why memory systems transfer data in
blocks rather than words — and why the size of that block is one of the most
consequential numbers in any system design.
