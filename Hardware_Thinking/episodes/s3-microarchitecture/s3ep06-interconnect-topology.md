---
season: 3
episode: 6
title: Interconnect topology
runtime: about 14 minutes
prerequisites: s2ep09, s3ep05
one_thing: Write the traffic matrix first. Most entries are zero, and the topology is whatever connects the entries that are not.
---

> Production note: the request-response deadlock is the most important safety item in
> the season. Do not rush it.

## Where we are

Yesterday's numbers. Six stages each way is a twelve-cycle round trip, so twelve to
fourteen credits and a buffer to match. Batching credits four at a time adds up to three
cycles of waiting before a batch is sent, so the loop grows and you need a couple more
credits — call it sixteen. Halving the buffer halves your throughput and corrupts
nothing. Returning credits singly shortens the loop and costs reverse bandwidth. And two
traffic classes that must not block each other need two separate pools, so the buffering
doubles.

That last multiplication is the one to remember: **isolation between traffic classes
costs buffering per class.** It is why quality-of-service is expensive in hardware, and
why it is the first thing cut when area is tight.

Today: the structure all of that flow control runs over.

## The problem

You have eight masters — things that initiate transactions — and five slaves, things that
respond. A processor, a couple of DMA engines, a video capture block, a display block, a
cryptography accelerator. Against a memory controller, an on-chip memory, a register
block, a peripheral bridge.

Connect them.

And notice immediately that this is not a module design problem. This is the problem of
how your whole chip is organised, and it has a property that makes it uncomfortable: **it
is the one piece of the design that touches everything.** Get a block wrong and you fix a
block. Get the interconnect wrong and every block's assumptions about latency, bandwidth
and ordering are wrong at the same time.

The two failure modes are symmetrical and both common.

**Build too little**, and blocks contend for a shared path, everything slows down under
load, and the fix is structural and late.

**Build too much**, and you have spent an enormous amount of wiring and area on
connections nobody uses — and, worse, created a physical implementation problem, because a
full crossbar on a large chip is a wiring congestion nightmare that shows up as a timing
failure months later, in somebody else's job.

## The turn

**Write the traffic matrix.**

A grid. Masters down the side, slaves across the top. In each cell, three things: the
bandwidth that pair needs, the latency that pair can tolerate, and whether it needs
ordering.

That is it. That is the design input, and it is available from Season 1 episode eleven's
budgets and this season's episode two. It takes an hour.

And here is what you will find, every single time: **most of the cells are empty.**

The video capture block talks to the memory controller. That is all it does. It has no
reason to talk to the register block, or to the cryptography engine, or to the display
block. The display block reads memory and nothing else. The processor talks to
everything, but at low bandwidth to most of it.

So the eight-by-five grid with forty cells has perhaps twelve non-empty ones, and three of
those carry ninety percent of the bandwidth.

**The topology is whatever connects the non-empty cells.** You do not choose a topology
from a catalogue and then fit the traffic into it; you read it off the matrix. That is the
generative rule for this episode, and it is the same shape as episode one's cut criteria.

## The options and their cost curves

Now the catalogue, so you can recognise what your matrix is telling you.

**A shared bus.** One transaction at a time, an arbiter deciding who goes — Season 2
episode nine, and every word of that episode applies here.

The critical property: **total bandwidth is constant no matter how many masters you
attach.** Adding a ninth master to a shared bus adds zero bandwidth and subtracts from
everybody else's share. It scales in exactly the wrong direction.

But it is small, it is simple, and for low-bandwidth latency-tolerant traffic it is
correct. Which leads to the most useful structural rule in this episode:

**Separate the control plane from the data plane.**

Configuration writes, status reads, register accesses — these are tiny, infrequent, and
nobody cares if they take forty cycles. Put every one of them on one cheap shared bus and
never think about it again.

Data movement — pixels, packets, memory traffic — is the opposite: high bandwidth,
latency-sensitive, and it is what your chip exists to do. Give it a proper structure.

Mixing the two is a classic and expensive mistake. A design where a processor polling a
status register contends with a video stream will have intermittent video glitches caused
by software, and the diagnosis of that takes weeks.

**A full crossbar.** Every master connected to every slave, all pairs able to transact
simultaneously. Bandwidth scales properly. Each slave port needs its own arbiter over all
masters, and each master needs a way to route to any slave.

The cost grows with the *product* of masters and slaves, and it is mostly **wires**. That
matters more than the gate count, because wires are a physical-implementation problem:
they consume routing resources, they create congestion, and congestion turns into timing
failures in a phase of the project where your options are limited. Season 5 episode nine
is about this shadow, and the short version is that a full crossbar between many ports is
a decision with physical consequences you will not see for months.

**A sparse crossbar.** The real answer, most of the time. Build the crossbar, then delete
every connection whose cell in the matrix is empty. Half the wires or fewer, identical
performance, because the deleted paths were never used.

This is the single highest-return interconnect optimisation available and it requires
nothing but the matrix. It is also why the matrix has to be *written down* — a sparse
crossbar built from somebody's memory of who talks to whom will be missing a connection
that is needed once, during boot, and the bug will be a chip that does not start.

**Hierarchy.** Cluster the blocks that talk to each other behind a fast local
interconnect, and connect the clusters with something narrower. This works when the matrix
has structure — when it clumps — and real matrices usually do clump, because subsystems
are designed by teams and teams build things that talk to each other.

**A network on chip.** Packetise the transactions and route them through a mesh or a ring
of small routers. This is what you need beyond some number of nodes — say a few dozen —
because a crossbar's wiring cost has become impossible.

It scales beautifully in area and it costs you **latency per hop** and **buffering per
router**, and every one of those buffers needs the credit scheme from yesterday. So a
network on chip is a large amount of distributed storage, and the total is often
surprising. It also makes latency variable and topology-dependent, which every block
attached to it has to tolerate.

## Deadlock, which is the real danger

Now the safety item, and this is the one that produces the hardest bugs in system design.

A deadlock is a cycle of waiting. A holds a resource and waits for B; B holds a resource
and waits for A. Neither moves, forever, and nothing anywhere reports an error. The chip
simply goes quiet.

Here is the specific cycle that catches real projects, and it is worth being able to
recite:

**A response must never be blocked behind a request.**

Consider a master that issues read requests and receives responses. Suppose requests and
responses share one buffer, or one channel, or one arbiter's queue. Now the master's
request queue fills up because the slave is busy. The slave is busy because it is trying
to send a response. The response cannot get through, because the path is full of requests.
The requests cannot drain, because they are waiting for responses.

Locked. And notice that every individual block in that story is behaving correctly. The
deadlock is a property of the *topology*, not of any module, which is why no amount of
block-level verification finds it.

Three rules that prevent this class:

**Keep requests and responses on separate paths**, with separate buffering and separate
credits. This is why real bus protocols have separate channels for addresses and for read
data rather than one shared channel — it is not a convenience, it is a deadlock-avoidance
requirement.

**A slave must be able to accept a request without needing to send anything first.** If
accepting a request requires space in an output queue, you have coupled the two directions
and created the cycle.

**Draw the dependency graph and check it for cycles.** Nodes are resources — buffers,
channels, arbiter grants. Edges are "this one cannot free up until that one does". If
there is a cycle, you have a deadlock, and the only question is how rare the traffic
pattern that triggers it is. Rare is worse, because rare means it reaches customers.

And one more, which is where reordering meets deadlock: if a master can issue two
transactions that may complete out of order, and something downstream forces them back
into order, then the second one completing cannot be accepted until the first one does —
which is head-of-line blocking again, and if the first one is waiting on a resource the
second one holds, it is a deadlock. Ordering requirements and deadlock are deeply
connected, and this is a large part of why Season 7's episodes on bus protocol identifiers
are as careful as they are.

## The cost

Interconnect is the hardest thing in a chip to verify, because its state space is the
product of everything attached to it. Eight masters each in one of several states, times
the buffers, times the arbiters, times the orderings. You cannot enumerate it, and
directed tests will not find the deadlock.

This is the place where formal verification genuinely earns its licence fee — Season 4
episode eight — because a proof that no cycle exists is worth more than any number of
simulations that happened not to hit it.

And it is expensive in the physical domain in a way that is invisible at design time.
Wires, congestion, and long paths that turn into pipeline stages, which turn into latency,
which turns into more credits and more buffering everywhere. The interconnect is where
architectural decisions become physical ones, and the feedback loop is months long.

## The one thing

Write the traffic matrix: bandwidth, latency and ordering per pair. Most cells are empty,
so build a sparse structure. Separate the control plane from the data plane, keep requests
and responses on separate paths, and check the dependency graph for cycles.

## Commute exercise

Four masters: a processor, a video capture block writing sixty megabytes per second, a
display block reading a hundred megabytes per second, and a DMA engine doing bulk copies.
Three slaves: an off-chip memory controller, a small on-chip memory, and a register block.

On the way home, build the traffic matrix out loud. Bandwidth in each cell, and which
cells are genuinely empty.

Then design the topology from it. You should end up with something that is not a full
crossbar and not a single bus.

Then the two harder parts.

First: the DMA engine copies from memory to memory — so it is a master that reads and
writes the same slave. What does that do to your bandwidth arithmetic for the memory
controller? Be careful, the answer is not what the specification says the DMA rate is.

Second: the display block must never run dry, so it has a hard deadline, while the DMA
engine does not care at all. You solved this shape in Season 2 episode nine with
arbitration. Now ask the topology version of the question: is there a structural change —
not an arbitration change — that makes the display block's deadline easier to guarantee?

There is, and it involves spending something you have plenty of to protect something you
have very little of.
