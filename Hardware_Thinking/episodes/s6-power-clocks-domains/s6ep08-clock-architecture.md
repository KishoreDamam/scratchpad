---
season: 6
episode: 8
title: Clock architecture for a real chip
runtime: about 11 minutes
prerequisites: s1ep07, s5ep06, s6ep06
one_thing: A chip's clocks are a plan, not an accident. Every clock has a source, a range, a controller and a list of crossings, written down in one place — and the cheapest crossing is the one the plan made unnecessary.
---

> Production note: the four layers — source, generation, distribution, control —
> should be countable. The "fewer domains" argument should sound like a trade, not
> a rule.

## Where we are

Yesterday's clocks.

Processors, often several, each possibly with its own DVFS. The memory interface. A system bus. Each
peripheral — serial, display, camera, network, USB — often with a clock dictated by its external
standard. The always-on controller, running from a slow oscillator. Test clocks. Debug clocks. Twenty
is easy. Forty is common.

How many crossings? In principle, one for every pair that exchanges data — and while most pairs never
talk, a real chip still has hundreds of crossing points, each a group of signals that must be
synchronised correctly. Missing one produces Season 1 episode seven's failure: rare, intermittent,
impossible to reproduce on demand.

And who is responsible, with what document? That is today. The document is the **clock plan** — the
domain map that Season 3 episode twelve listed as one of the nine sections of the architecture
document. Without it, nobody knows where the crossings are, and nobody can check them.

## The problem

In a small design, clocks happen. There is one, maybe two. Somebody adds a peripheral that needs its own,
and a synchroniser gets written at the boundary.

In a large chip, that approach produces a mess that nobody can verify. Clocks multiply because every block
designer asks for the frequency that suits them. Crossings appear wherever two blocks happen to talk.
Dividers are written ad hoc in RTL. Clock multiplexers are built from ordinary logic. Nobody has a list of
which clocks exist, let alone which cross where.

And the resulting failures are the worst kind on the list: intermittent data corruption from an unsynchronised
crossing, glitches from a badly built clock multiplexer, a block that stops working when its clock changes
frequency.

## The turn

The turn is to treat clocks as an **architecture**, planned in advance, with four layers.

## Layer one: sources

Where do clocks come from?

A **crystal oscillator** — an external reference, stable and accurate, usually a few tens of megahertz.

**Phase-locked loops** — on-chip circuits that multiply the reference up to the high frequencies the logic needs.
A chip usually has several, each serving a group of domains.

**External pins** — some interfaces bring their own clock with the data: a camera, a display link, a
source-synchronous memory interface.

And a **slow always-on oscillator** for the parts of the chip that must run during sleep.

Each source is independent of the others, unless one is derived from another. And that single fact decides most of
what follows.

## Layer two: generation

From each source, the specific clocks each domain needs are **generated**: divided down by integer ratios, selected
between sources, sometimes gated.

And this layer has one iron rule: **clock generation is done with dedicated structures, never with ordinary logic.**
Dividers are built as proper clock dividers, declared to the timing tools as generated clocks — Season 5 episode
three. Selection between two clocks uses a **glitch-free clock multiplexer** — episode six — which switches only when
both clocks are in a safe phase. Gating uses episode two's integrated gating cells. Somebody writing an ordinary counter
and using its top bit as a clock, or an ordinary multiplexer to pick between two clocks, has created a glitch source and
an untimed clock path, and it will show up in silicon.

Usually, all generation lives in one place: a **clock controller** block, owned by one team, with registers that
software can program to change dividers, select sources and gate branches.

## Layer three: distribution

Each generated clock is then distributed to its domain by its own tree — Season 5 episode six. Every domain is a separate
tree with its own latency, and that latency matters for the next layer.

## Layer four: relationships

Now the layer that decides the crossings.

For every pair of clocks, the plan must say how they relate. There are really only two answers.

**Synchronous.** Both clocks come from the same source, with an integer ratio and a known phase relationship — for example,
one clock and the same clock divided by two, both derived from one phase-locked loop and balanced by the clock tree tools.
Then the timing tools know exactly where every edge of one falls relative to every edge of the other, and paths between them
can be **timed** like any other path. No synchroniser needed. The crossing is handled by Season 5, not Season 1 episode
seven.

**Asynchronous.** Different sources, or a ratio that changes at runtime — episode six's DVFS, which makes even two clocks from
the same source effectively unrelated. Then no timing relationship can be trusted, the paths are declared asynchronous to the
timing tool, and every crossing needs a proper synchroniser, handshake or asynchronous FIFO.

The distinction is worth fighting for. A synchronous crossing is checked exhaustively by static timing analysis and needs no
special logic. An asynchronous crossing needs a synchroniser, adds latency, and needs its own signoff — episode ten.

## Fewer domains

Which leads to the architecture's most consequential choice: **how many domains, and which blocks share them.**

More domains give more flexibility. Each block runs at its ideal frequency, can be scaled and gated independently, and saves the
most power.

Fewer domains give fewer crossings. Every block that shares a domain with its neighbours talks to them with ordinary timed paths,
no synchronisers, no latency, no signoff risk.

The trade is real, and the plan should make it deliberately, with a rule of thumb from Season 3 episode one: **blocks that exchange a
lot of data belong in the same domain.** Put the crossings where traffic is light — a configuration interface, a status signal, a
low-rate peripheral — and keep the heavy data paths within a domain. A crossing on a high-bandwidth path needs a deep asynchronous FIFO
and adds latency to every transfer; a crossing on a register bus costs a few cycles on rare accesses.

And where crossings are needed, **choose ratios deliberately**. A bus clock that is an integer fraction of the processor clock, from the
same phase-locked loop, keeps those crossings synchronous. A slightly different frequency, chosen for convenience, makes them
asynchronous forever.

## The clock plan document

What does the plan actually contain? A table, in words.

For each clock: its **name**. Its **source**. Its **frequency** — and its **range**, if DVFS changes it. Whether it can be **stopped**, and
by whom. Which **blocks** it drives. And for each other clock it exchanges data with: whether the relationship is **synchronous or
asynchronous**, and, if asynchronous, **which structure implements each crossing** — a two-flop synchroniser for a single quasi-static bit,
a handshake for a pulse or a small control word, an asynchronous FIFO for a data stream.

That table is the input to the timing constraints — every clock declared, every generated clock related, every asynchronous group declared.
It is the input to the clock domain crossing signoff, episode ten, which checks every crossing in the netlist against it. And it is the input
to verification: every asynchronous crossing is a place where a test should vary the clock ratio and phase.

## The less obvious clocks

A few that plans forget.

**Test clocks.** During manufacturing test — Season 8 — the chip runs from different clocks, often slower, often supplied from a pin. The clock
controller must be able to switch every domain to its test clock cleanly.

**Debug clocks.** A debug interface — Season 8 episode five — often runs from its own external clock, and must still work when parts of the chip
are asleep or stuck.

**Clocks that stop.** A domain whose clock is gated at the controller is, for that time, a domain where nothing moves — including its
synchronisers. Any crossing *into* a stopped domain accumulates or loses data. Any handshake *out* of it freezes halfway. The plan must say what
happens to each crossing when either side's clock stops.

**And clock monitors.** On high-reliability chips, circuits that watch each clock and raise an alarm if it stops or wanders outside its expected
frequency. A phase-locked loop that loses lock and runs wild is a real failure mode, and safety-critical chips must detect it.

## The cost

A clock controller block, owned and verified by someone. A document that every block designer must respect. Constraints on block designers' freedom
— they may not get the exact frequency they wanted. And some power left on the table where a shared domain runs faster than one of its blocks needs.

Against that: a known, finite list of crossings, each deliberately placed and implemented, each checkable. The alternative is a chip whose crossings
nobody can enumerate, which means a chip nobody can sign off.

## The one thing

A chip's clocks are a plan, not an accident: sources, generation, distribution and relationships, written down in one table, with every asynchronous
crossing listed with its structure. Keep heavy traffic within a domain, choose ratios that keep crossings synchronous — the cheapest crossing is the one
the plan made unnecessary.

## Commute exercise

A block's domain has its clock gated off at the clock controller, to save power. While it is gated, software asserts that block's reset — perhaps as part
of recovering from an error. Then software releases the reset, and afterwards turns the clock back on.

On the way home, work out what state the block is in.

Season 2 episode three: assert asynchronously, release synchronously. Assertion needs no clock. But release goes through a reset synchroniser — two flip-flops
clocked by the block's own clock. What does that synchroniser do while the clock is stopped?

Then think about what the block sees when the clock finally starts. Is it in reset? Out of reset? Is every flip-flop in agreement?

And the question worth the drive: this bug was caused by **ordering** — reset released before clock started. On a chip with dozens of domains, **who decides the
order in which domains come out of reset, and what else must be running first?** Think about the phase-locked loop that generates the clock in the first place.
