---
season: 4
episode: 6
title: UVM, part one
runtime: about 11 minutes
prerequisites: s4ep01, s4ep05
one_thing: UVM exists so that a verification component built once can be reused unchanged — driving at block level, only watching at chip level. Every piece of its ceremony serves that reuse, and makes no sense without it.
---

> Production note: this episode is the one people dread. Keep the tone
> reassuring — the framework is large, the ideas are few. Name the four pieces on
> the fingers.

## Where we are

Yesterday's merged streams.

The obvious scoreboard merges the two predicted streams and compares in order, and it fails on a
correct design, because the model does not know **when** each packet arrived relative to the
other stream, or what the arbiter decided on each cycle. The merge order is a consequence of
timing and arbitration — exactly the things a functional model deliberately does not contain.

What does the specification guarantee? Order *within* each stream. So: two queues, one per input,
each strictly in order, and no opinion about how they interleave. Each output packet must be
matched to the right queue — which is easy if packets carry a source field, and if they do not, a
standard testbench trick is to put a sequence number and a source tag in the payload, so every
packet the test creates is uniquely identifiable when it comes out.

And fairness? The scoreboard now deliberately ignores it, so something else must check it.
That is a property about time — every packet waiting at B is forwarded within some bound — so it
is an assertion with a cover on its trigger, and in episode eight, a candidate for proof.
Different questions, different instruments.

Notice how much structure that took, though. Two monitors, a model, a scoreboard with two
queues, stimulus for two streams with random timing, an assertion, coverage. For one small block.

Today: what happens when you have to do that for fifty.

## The problem

Imagine a chip with fifty blocks. Twelve of them use the same streaming protocol. Eight use the
same register bus. Every one of them needs a testbench.

Without a common structure, what you get is fifty testbenches written by twenty people in twenty
styles. Twelve different monitors for the same streaming protocol, each with its own subtle
misunderstanding of it. Nobody can read anybody else's. And when the blocks are integrated into a
subsystem, none of those testbenches can be reused, so the subsystem team writes a fifty-first,
from scratch, re-discovering bugs in the protocol monitor that the block teams already fixed.

That is not a hypothetical. That was the industry, and it is why a framework exists.

## The turn

**UVM** — the Universal Verification Methodology — is a library of SystemVerilog base classes and a
set of conventions for how testbench components are shaped and connected.

And the thing to understand about it, before any detail, is this: **UVM is built for the tenth
block, not the first.** Everything about it that feels like ceremony on a small block is there so
that a component written once can be dropped, unchanged, into a different testbench — another
block's, a subsystem's, the chip's. If you judge it by how quickly it verifies one FIFO, it looks
absurd. Judge it by how quickly the fiftieth block gets a trustworthy testbench.

The framework is large. The ideas you need are four, and you have met all of them this season
already.

## The four pieces

**One: the transaction.** In UVM it is called a **sequence item**. It is episode five's
transaction, as a class: the fields of one packet, or one bus write, with their constraints from
episode two. Nothing about signals, nothing about timing. Pure meaning.

**Two: the driver.** It takes transactions and turns them into signal activity on an interface,
through episode one's clocking block. It is the only component that knows how the protocol wiggles
wires. It asks for the next transaction, drives it, and says when it is done.

**Three: the monitor.** Episode five's monitor. Passive, watching the same interface, turning
signal activity back into transactions and broadcasting them. It knows the protocol too — in the
opposite direction.

**Four: the agent.** A container that packages a driver, a monitor, and a **sequencer** — the small
component that feeds transactions to the driver — for **one interface**. One protocol, one agent.

And the agent has one switch that is the whole reason for this structure. It can be **active** or
**passive**.

An active agent has all three pieces: it generates stimulus, drives it, and monitors it.

A passive agent has only the monitor. It drives nothing. It just watches.

## Why that switch matters

At block level, your block's input has nothing driving it except the testbench. So the agent on
that input is active: it generates the traffic.

Now integrate the block into a subsystem. Its input is driven by a real upstream block. The
testbench must not drive it any more — the real hardware does. But you still want to watch it:
the monitor, the protocol assertions, the coverage, the scoreboard feed.

So you flip the agent to passive. The same agent. The same monitor, already debugged at block
level. The same coverage model. The same connection to the scoreboard. You have lost only the
driver and the stimulus, which you no longer need.

That is what "reuse" means in verification, and it is the payoff of this entire architecture:
**the monitors, checkers and coverage you built at block level keep working at every level
above**, and the protocol knowledge is written once, in one agent per protocol, used by everyone.

## Above the agents

Two more layers, briefly.

**The environment** contains the agents for all of a block's interfaces, plus the scoreboard and
the reference model, wired together. It is the complete testbench structure for that block, minus
any decision about what to test.

**The test** sits on top. It builds the environment, configures it — which agents are active, what
the parameters are — and chooses what stimulus to run. Different tests, same environment. The
environment is built once; tests are cheap.

## How the pieces talk

Two mechanisms, and both exist for decoupling.

**Analysis ports.** When a monitor finishes a transaction, it does not call the scoreboard. It
*publishes* the transaction on an analysis port, and anything that has subscribed receives a copy —
the scoreboard, a coverage collector, a logger, whatever. The monitor has no idea who is listening.
That is exactly what lets it be reused unchanged: at subsystem level, different subscribers connect
to the same port.

**The factory.** When the environment creates a component or a transaction, it does not create a
specific type directly. It asks the factory for one. And a test can tell the factory, beforehand,
"whenever anybody asks for a basic packet, give them an error-injecting packet instead". The
environment's code is untouched; the behaviour changes. This is how one environment supports a
hundred tests without editing it a hundred times. It sounds like indirection for its own sake until
the day you need it, and then it is the only reasonable way.

## The cost

**It is heavy.** A minimal UVM testbench for a trivial block is several hundred lines across a
dozen files. That is real, and for a small block in your own lab, it is honestly the wrong tool —
plain SystemVerilog or cocotb will get you verified faster. Learn UVM because you will meet it and
read it professionally, not because every block needs it.

**It is easy to abuse.** The base classes support deep inheritance, and some teams build towers of
it — a base environment, extended, extended again, overriding methods five levels up — until nobody
can tell what a test actually does without reading eight files. Keep inheritance shallow.
Configuration beats extension.

**And you will debug the framework.** A misconnected port, a component the factory did not create
because a name was misspelled, a test that ends immediately for a reason that turns out to be
three layers down. The first month of UVM is spent partly debugging the design and partly debugging
UVM, and the second kind is not a sign that you are bad at it. Episode seven covers the parts that
cause most of that pain.

And one honest note. The real value was never the class library. It was the **shape** — transaction,
driver, monitor, agent, environment, test, with monitors publishing and scoreboards subscribing. That
shape is correct in any language. Build it in cocotb and you have most of what UVM gives you,
without most of what UVM costs.

## The one thing

UVM exists so a verification component built once can be reused unchanged — active at block level,
passive at chip level — and every piece of its ceremony serves that reuse. The four pieces are the
transaction, the driver, the monitor, and the agent that packages them.

## Commute exercise

You have verified a block with a full UVM environment: an active agent on its input, an active agent
playing the downstream on its output, a reference model, a scoreboard, coverage.

Now the block is integrated. Its input is driven by a real upstream block, and its output feeds a
real downstream block.

On the way home, go through your environment piece by piece and decide: what survives unchanged,
what is switched off, and what is thrown away?

Then find the trap. Suppose, when you wrote the block-level environment, you took a shortcut: the
reference model was fed **directly by the input driver**, with each transaction the driver sent,
rather than by the input monitor.

What happens to that shortcut at subsystem level, where there is no driver? And what does that tell
you about which component should *always* be the source of truth about what happened on a wire?
