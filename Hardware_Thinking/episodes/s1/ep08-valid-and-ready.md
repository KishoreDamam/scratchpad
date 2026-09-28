---
episode: 08
title: Valid and ready
runtime: about 11 minutes
prerequisites: ep05, ep06
one_thing: Two wires — I have something, I can take something — turn rigid blocks into a system you can rearrange.
---

> Production note: the deadlock rule near the end is the single most practically
> useful sentence in the season. Say it twice.

## Where we are

We have a design made of permanent objects, stepped forward by a clock, split
into datapath and controller, pipelined for throughput, and bounded by what
memory will let us hold.

All of which describes one block. Today: what happens when you connect two, and
why the way you connect them determines whether this is a career of building
things or a career of rewriting them.

## The problem

Block A produces data. Block B consumes it. Wire them together.

Now ask the uncomfortable question. How fast does A produce, and how fast does B
consume?

In a simple world they match. A produces one item per cycle, B consumes one item
per cycle, you connect the wires and go home.

But real blocks are not like that. B might be a divider that takes eleven cycles
per item. It might be a memory interface that is usually instant and
occasionally stalls for forty cycles because the DRAM went off to refresh
itself. It might be a packet formatter that needs three cycles between packets
to insert a header. A, meanwhile, might be a sensor that produces data in
bursts, or a decompressor whose output rate depends entirely on the data.

So the rates do not match, they do not match in ways that change from cycle to
cycle, and here is the thing that makes it properly hard: **the data does not
stop arriving while you think about it.** A produced something this cycle. If B
cannot take it, and nobody told A to wait, that item is simply gone. It was on a
wire, the wire now has the next item on it, and the previous value has no more
existence than yesterday's weather.

Silent data loss. No error, no exception, no crash. Just an output that is
subtly wrong in a way that gets blamed on the algorithm for three weeks.

Now, you could solve this once, by hand, between these two specific blocks. Work
out A's worst-case rate and B's worst-case rate, prove one never exceeds the
other, and build in exactly the right number of cycles of slack.

And you would have built something that cannot be changed. Swap B for a
different implementation and your proof is void. Insert a new stage between them
and it is void. Reuse A in another project and the numbers are different.
Everything is welded to everything else through a shared timing assumption that
exists only in somebody's head and in a comment that is out of date.

That is the real problem. Not the data loss — the *brittleness*.

## The turn

Two wires.

The first goes forwards, from producer to consumer, and it means: **I have
something for you right now.** Call it valid.

The second goes backwards, from consumer to producer, and it means: **I can
accept something right now.** Call it ready.

And one rule. **A transfer happens on a clock edge when both wires are high at
the same time.** If valid is high and ready is low, the producer holds its data
and waits. If ready is high and valid is low, the consumer waits. If both are
high, the item moves, and on the next cycle they are both free to say something
different.

That is the whole protocol. Two wires and a rule. You will meet it under various
names in various standards, but underneath the branding it is always these two
wires and this rule.

Now look at what it just bought you.

**Rate matching is automatic.** Fast producer, slow consumer? The consumer drops
ready and the producer stalls, exactly as long as necessary, with no arithmetic
by anyone. Slow producer, fast consumer? The consumer sits with ready high and
waits. No one calculated anything. The mechanism handles every ratio, including
ones that change every cycle.

**Stalls propagate on their own.** In a chain of five blocks, if the last one
stalls, it drops ready, which stalls the fourth, which drops ready, which stalls
the third. The stall travels back up the chain by itself. You did not build a
stall controller. You wired up two signals per interface and got a global
property for free. That word — backpressure — is the name for a stall
travelling backwards through a system, and it is one of the genuinely elegant
ideas in this field.

**And the big one: blocks become swappable.** Any block that speaks this
protocol can be connected to any other block that speaks it. You can insert a
buffer between two blocks without touching either — the buffer speaks valid and
ready on both sides, so as far as anyone can tell nothing changed except that
there is now some slack in the system. You can replace a three-cycle
implementation with a nine-cycle one and nothing upstream cares.

That is what an interface contract does. Not efficiency — *modularity*. The
ability to change one thing without understanding everything.

## Two ways to be simple

Worth knowing: not every block needs the full protocol, and pretending otherwise
adds logic for no reason.

A block that can *always* accept data can simply hold ready high forever. Then
it is just an input. Many pipeline stages are like this and the protocol costs
them nothing.

A block whose output is *always* meaningful can hold valid high forever. Then it
is just an output.

The two wires only earn their keep where something can actually stall. The
discipline is to speak the protocol at module boundaries even when the current
implementation never stalls — because the day someone replaces that block with
one that does, the wire is already there and nothing else has to change.

## The cost

Three costs, and the third one is a rule you should memorise.

**Ready is a signal travelling backwards, and that has timing consequences.**
Every other path in your design flows forwards. Ready flows the other way, which
means it can create a long combinational chain running upstream — the last
block's ready feeding the fourth block's ready feeding the third's — and that
chain is a critical path like any other, pointing the wrong way. In a long
pipeline, the ready path is very often the thing that limits clock speed, and it
surprises people every time because they were looking downstream.

The fix is to register it — to break the backwards chain with a small buffer
that can hold one or two items while the stall signal catches up. It is called a
skid buffer, it costs a couple of registers and some slightly annoying control
logic, and if you ever find yourself in a timing report staring at a path that
runs backwards through four modules, that is the thing you need.

**It costs area and it costs a little latency.** Every interface is extra wires
and extra logic. On a design where two blocks genuinely, provably always run in
lockstep, the protocol is pure overhead. That is a real trade, and occasionally
the right answer is to skip it — as long as skipping it is a decision you made
and wrote down, not one you drifted into.

**And now the rule.**

**Never make valid depend on ready.**

Say it back: valid must not depend on ready.

Here is why. Suppose the producer decides "I will assert valid once I see the
consumer is ready". And the consumer, quite reasonably, decides "I will assert
ready once I see the producer has something valid". Neither moves. Each is
waiting for the other, forever. That is deadlock, and it does not announce
itself — the system simply goes quiet, and quiet is very hard to debug.

So the contract is asymmetric on purpose. The producer must assert valid based
only on whether it has data — never on what the consumer is doing. The consumer
is allowed to look at valid when deciding ready, if it wants to. One direction
may depend on the other. Not both.

And one more clause, easily forgotten: **once you assert valid, you must hold it
— with the same data — until a transfer happens.** You may not offer an item,
get no answer, and quietly withdraw it. The producer's data has to sit there,
unchanged, until it is taken. Withdrawing an offer is how items get lost in a
design that looks, on every waveform you inspect, entirely correct.

## The one thing

Two wires — I have something, I can take something — plus the rule that valid
must never depend on ready, turn a set of rigid blocks welded together by shared
assumptions into a system you can rearrange.

## Commute exercise

A chain of three blocks, each speaking valid and ready, each able to hold one
item.

The last block stalls for ten cycles. Work out, on the way home, what the first
block sees and *when* — specifically, how many cycles pass before the stall
reaches it, and how many items are sitting in the chain by then.

Then the interesting version. Put a queue of depth sixteen between the second
and third blocks. Same ten-cycle stall. Now does the first block stall at all?

And finally, the question that turns this into design rather than analysis: if
the last block stalls for ten cycles *once every hundred cycles*, how deep does
that queue need to be so the first block never stalls at all — and what would
make that number grow without limit?

The answer to that last part is the reason every network you have ever used has
a place where packets get dropped.
