---
season: 4
episode: 5
title: Scoreboards and transactions
runtime: about 11 minutes
prerequisites: s1ep09, s3ep11, s4ep04
one_thing: Compare transactions, not waveforms — meanings, not signals. And at the end of the test, check that everything you predicted actually arrived, because a scoreboard that saw nothing will pass.
---

> Production note: the "empty scoreboard passes" failure should land as a small
> shock. It recurs in episodes seven and nine; plant it firmly.

## Where we are

Yesterday's question: every packet matched in the scoreboard. Is the stability assertion still
adding anything?

Yes — and the reason sets up today.

The scoreboard compares **what** arrived. It sees a completed transfer and checks its contents.
It has no opinion about **how** the transfer happened. Suppose the design, during a stall, briefly
changes its data and then changes it back before ready rises. The consumer in your testbench only
samples on the handshake, so it sees the right value. The scoreboard is happy.

But the protocol was violated. And a different consumer — a register slice that captures data
early, or a clock crossing that samples while valid is high — would have captured the wrong value.
Your testbench's consumer happened to be forgiving. The next block in the chip might not be.

So the two instruments check different things. The assertion checks the **contract** that every
possible neighbour relies on. The scoreboard checks the **meaning** delivered to this particular
neighbour. You want both, and neither replaces the other.

Today is the scoreboard, and the idea of meaning.

## The problem

Here is how verification starts for most people, and it is natural.

You write a test, run it, and open a waveform viewer. You look at the output signals and check,
by eye, that they did the right thing. Then, to automate it, you write code that checks specific
signals at specific cycles. On cycle one hundred and seven, the output data should be this value.

Every word of that is fragile.

It is fragile to **timing**. Add one pipeline stage — a perfectly legitimate change to close
timing, the kind Season 5 will ask you to make — and every expected cycle number is off by one.
Every check fails. Nothing is actually wrong.

It is fragile to **backpressure**. With random stalls from episode two, the cycle on which any
given output appears is different on every run. There is no cycle one hundred and seven to check.

And it is fragile to **meaning**. A packet of fifteen hundred bytes on an eight-byte bus is nearly
two hundred cycles of signal activity. Checking it signal by signal means two hundred separate
comparisons, and when one fails, the message tells you a bit was wrong on a cycle, which tells you
nothing about which packet, or why.

## The turn

**Stop comparing signals. Compare meanings.**

The meaning of two hundred cycles of bus activity is one packet — with a length, a type, a
destination, a payload. That is a **transaction**, and the whole architecture of a modern
testbench is built around turning signals into transactions as early as possible, and comparing
transactions only.

Three components do it.

**The monitor.** One per interface. It is passive: it only watches, it never drives. It watches the
signals, understands the protocol, and every time a complete transaction happens — a full packet
has transferred, a write has been accepted — it builds a transaction object and broadcasts it.
Timing, stalls, the number of cycles it took — all absorbed. What comes out is pure meaning.

**The reference model.** Season 3 episode eleven's functional model. Bit-accurate, no timing. It
takes each input transaction and computes the output transactions the design should produce. You
already built it, from the specification, before the RTL existed. This is its second life.

**The scoreboard.** It receives predicted transactions from the model and actual ones from the
output monitor, and it compares them. Transaction against transaction. And when one fails, it says:
packet four thousand eight hundred and seventeen, destination port three, payload byte seventeen
differs — expected this, got that.

That failure message is actionable. It names a packet. You can find that packet at the input
monitor, see when it entered, and follow it. Compare that with "bit five of the data bus was wrong
on cycle two hundred and three thousand".

And the pipeline stage? Add it. The scoreboard does not care. It never knew what cycle anything
happened on. The testbench now tolerates exactly the changes that Season 3 episode twelve said
should be left open to the designer — internal structure, pipeline depth — and pins down exactly
what the architecture document pinned down: the meaning at the interface.

## Ordering

Now the part that takes real thought: **in what order should things match?**

**In order.** If the specification says outputs come out in the order inputs went in, the
scoreboard keeps a queue. Predicted transactions go in the back; each actual one is compared
against the front. Simple, strict, and it catches reordering bugs automatically.

**Out of order.** If the design is allowed to complete things in a different order — responses
tagged with an identifier, requests to different memory banks finishing at different speeds —
then the queue is wrong. It will report a mismatch on correct behaviour. Instead the scoreboard
keeps a map, keyed by identifier, and each actual transaction is looked up by its key and removed.

**Partially ordered.** The common real case. Order is guaranteed per stream, or per identifier, but
not globally. Then the scoreboard keeps one queue per stream — strict order within each, no
opinion across them.

And here is the principle: **the scoreboard should check exactly the ordering the specification
guarantees, and no more.** Check less and you miss real reordering bugs. Check more and you fail on
legal behaviour, and somebody "fixes" the design to satisfy a testbench that was wrong — which is a
bug introduced by verification. That is Season 3 episode eight's ordering contract, made
executable.

## The empty scoreboard

Now the failure that catches everybody, once.

Think about when a scoreboard reports an error. When an actual transaction arrives and does not
match the predicted one. That is the only moment it can complain.

So what happens if **no actual transaction ever arrives**?

The design deadlocks on cycle ten. Nothing comes out. The scoreboard receives nothing, so it
compares nothing, so it never finds a mismatch, so it never reports an error. The test ends, the
scoreboard has a queue full of predicted transactions that never showed up, and — unless you
wrote one more check — **the test passes**.

This is real, it is common, and it is devastating, because the most broken possible design passes
with the cleanest possible log.

The fix is an **end-of-test check**, and it is mandatory. When the test finishes, every predicted
queue must be empty. Anything still waiting is a transaction the design swallowed, and that is a
failure, loud, with a list of what was lost. And the mirror check: an actual transaction arriving
with no prediction waiting is a duplicate or an invention, also a failure.

Predicted and not seen: lost. Seen and not predicted: invented. Both are bugs, and a scoreboard
that checks only matches catches neither.

Add one more line while you are there: the test should report how many transactions it compared. A
test that says "passed, zero transactions checked" is not a pass. It is a warning dressed as one.

## Where to watch

Mostly at the design's external interfaces, because that is where the specification makes claims.

But on a large block, it is worth adding monitors at a few **internal** boundaries too — the
interfaces between the modules you cut in Season 3 episode one. Not for checking correctness,
necessarily, but for **localisation**. When the output is wrong, internal monitors tell you whether
the error was already present halfway through, which halves the search in one step. Episode ten
makes a method out of that.

## The cost

**The model must handle legitimate nondeterminism.** Real designs have behaviour the specification
deliberately leaves open. Which of two simultaneous requests wins arbitration. Which packets are
dropped when a buffer overflows under a drop policy. The exact order of completions across banks.
A reference model that picks one answer will disagree with a correct design that picked another.
So the model has to either mirror the choice — which risks copying the design's logic, Season 1's
mirror problem — or the scoreboard has to accept any legal answer. The second is harder to write
and almost always right.

**Equivalence has to be defined.** Are two packets equal if their payloads match but a reserved
field differs? If a timestamp differs by one? Every scoreboard embodies decisions like these, and
each one is a small specification that deserves a comment explaining why.

**And the model can be wrong.** When the scoreboard reports a mismatch, one of three things is wrong
— the design, the model, or your reading of the specification. The scoreboard cannot tell you
which. Episode ten is about how you find out.

## The one thing

Compare transactions, not waveforms — meanings, not signals. Check exactly the ordering the
specification guarantees. And at the end of every test, check that everything predicted actually
arrived, because a scoreboard that saw nothing will pass.

## Commute exercise

A block with two input streams, A and B, and one output. Inside, an arbiter merges them: each cycle
it picks one input to forward. Packets are not modified — they just pass through, merged into one
stream.

On the way home, design the scoreboard.

The obvious attempt: the model merges the two predicted streams into one expected sequence and
compares in order. Work out why that fails on a perfectly correct design. What does the model not
know that the design does?

Then design the version that works. What does the specification actually guarantee about order?
How many queues do you need, and how does each output packet know which queue to check against?

And the question worth the drive: your scoreboard now ignores the merge order entirely. So what is
checking that the arbiter is fair — that stream B is not starved while A is busy? Where does that
check belong, and which instrument from this season would you use?
