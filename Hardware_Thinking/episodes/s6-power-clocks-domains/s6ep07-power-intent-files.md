---
season: 6
episode: 7
title: Power intent files
runtime: about 11 minutes
prerequisites: s6ep04, s6ep05, s6ep06
one_thing: The power structure lives in its own file, beside the RTL, so it can change without editing logic and be checked by every tool in the flow. That file is a specification — and like any specification, it is only as right as the conversation that produced it.
---

> Production note: describe the file's contents as a list of questions it answers,
> not as syntax. The listener should come away knowing what is in one, not how to
> type it.

## Where we are

Yesterday's question: where is all this written, and why is it not in the RTL?

It is written in a **power intent file** — a separate document, alongside the RTL, that describes the
power structure: domains, supplies, switches, isolation, level shifting, retention, and the power states
of the chip.

And why not in the RTL? Three reasons.

**The same logic is used in different power configurations.** A block reused in two chips may be
always-on in one and switchable in the other. If its isolation cells were written into its Verilog, it
would need two versions.

**Power cells depend on the physical implementation.** Which library cell implements isolation, where the
switches go, whether a crossing needs a shifter at all — those depend on the process and the floorplan.
Writing them into RTL ties the logic to one implementation.

**And the power structure needs to be checked as a whole.** Scattered through thousands of RTL files, nobody
could see it, review it, or check it for consistency. In one file, it can be read, reviewed and verified — by
simulation, synthesis, layout and static checks, all reading the same source.

## The problem

By the end of episode six, a power-managed chip has accumulated a remarkable amount of structure that has
nothing to do with what the logic computes.

Which supplies exist, at what voltages. Which blocks run from which supply. Which supplies can be switched off,
and by which control signal. Which outputs need isolation, clamped to what, controlled by what, powered from
where. Which crossings need level shifting. Which registers are retained, with which save and restore signals.
And which combinations of all these are legal — the chip's **power states**.

All of it must be consistent between the RTL simulation, synthesis, layout and signoff. If simulation believes a
block has isolation and layout forgot to insert it, the chip fails. If synthesis inserts a level shifter that the
timing analysis does not know about, the timing is wrong.

## The turn

The industry answer is a standard format for **power intent**. The one you will meet most is called **UPF** — the
Unified Power Format, an IEEE standard. An older alternative, CPF, exists in some flows. Both do the same job.

The idea is that the RTL describes logic only, as it always did, and the power intent file describes the power
structure *on top of* it, referring to blocks and signals in the RTL by name. Every tool reads both.

**Simulation** reads the power intent and becomes power-aware — episode four — switching domains off and forcing
their signals to unknown.

**Synthesis** reads it and inserts the isolation cells, level shifters and retention registers it describes, choosing
suitable library cells.

**Layout** reads it and builds the supply networks, places the power switches, and puts each cell on the right
supply.

**Static checks** read it alongside the netlist and verify that every crossing is properly handled.

One source of truth for the power structure, read by the whole flow.

## What it says

Rather than syntax, think of the file as answering a list of questions. If you can answer these for your design, you
can read or write the file.

**What are the power domains, and what is in each?** Which blocks of the hierarchy belong to which domain. Anything not
assigned belongs to the top-level domain.

**What supplies exist, and which feeds each domain?** The supply nets, their voltages, and the connection from supply to
domain — including, for switchable domains, the switch between them.

**How is each switch controlled?** Which signal turns it on and off, which domain that signal comes from, and what
acknowledge comes back.

**Where is isolation needed, and how?** For each switchable domain: which outputs are isolated, the clamp value for each —
zero, one or latch — which signal enables it, and which supply powers the isolation cell.

**Where is level shifting needed?** For each crossing between different voltages, which direction needs a shifter, and on
which side it should sit.

**What is retained?** Which registers get retention, and which signals drive save and restore.

**And what are the legal power states?** A table — in the file, written as statements — listing each state of the chip, and,
for each, which supplies are on, off, or at which voltage. Sleep: only the always-on supply. Idle: always-on and memory.
Active: everything. And, implicitly, every combination *not* listed is illegal.

That last one is more important than it looks. The static checks use the power state table to decide which crossings can
ever have a sender off and a receiver on — and therefore which really need isolation. A missing or wrong state table produces
either missing isolation or pointless isolation everywhere.

## It is a specification

Now the idea to carry.

Season 5 episode three said the timing constraints file is not tool settings; it is a specification. The power intent file is
the same, and more so. It describes a structure that has no representation anywhere else, whose mistakes are invisible to
ordinary simulation, and whose failures appear in the field as intermittent corruption during sleep and wake.

So it deserves specification treatment. Written from the architecture — the power domain map, which Season 3 episode twelve
listed as one of the nine sections of the architecture document. Reviewed, by the designers of every block it touches.
Version-controlled with the RTL, and changed in step with it.

And **it is only as right as the conversation that produced it**. Episode four's closing question and episode five's opening
bug were the same: the person writing the power intent chose a clamp value, and the person writing the RTL chose a polarity,
and they did not talk. The file was syntactically perfect and every tool read it faithfully. It was wrong about the design's
meaning, and no tool could know.

The defence is organisational as much as technical. Every signal that crosses out of a switchable domain should have its clamp
value **agreed with its designer** — ideally recorded next to the signal's definition in the interface description, so that
the power intent is generated from, or checked against, what the designer actually meant.

## Keeping it in step

The most common way power intent goes wrong is not an original mistake. It is **drift**.

The RTL changes. A signal is added to a block's interface, crossing into another domain. A block is moved in the hierarchy. A
register is renamed. The power intent file refers to things by name and by hierarchy — and it is not updated.

Now it refers to a block that no longer exists at that path, or misses a new output that needs isolation. Depending on the tool,
that may be a warning in a long log, or nothing at all.

Three habits prevent most of it.

**Run the static power checks in continuous integration**, on every RTL change, not once before tape-out. A new crossing with no
isolation should fail the build the day it is added.

**Treat warnings about unmatched names as errors.** A power intent rule that matches nothing is Season 5 episode three's
unconstrained path in a new costume: silence that looks like success.

**And run power-aware simulation in the regression**, including tests that actually power domains down and up in realistic
sequences. A power-aware simulator is only useful if something turns the power off.

## Hierarchy and reuse

One more aspect, briefly. On large chips the power intent is itself hierarchical. A block that will be reused comes with its own
power intent describing its internal domains and requirements — which of its outputs need isolation if it is switched off, which
of its internal supplies exist. The chip-level file then connects those block-level intents to the chip's real supplies and
decides which domains are actually switchable in this chip.

That is the same reuse argument as Season 4 episode six's UVM agents: describe the block's power behaviour once, correctly, and let
each chip that uses it configure it.

## The cost

A second language to learn. A second artefact to keep in step with the RTL. A class of static checks and a mode of simulation that
must be run, and whose results must be read. And a set of conversations — about domains, clamp values, power states — that must
happen before the file is written, not after the chip fails.

## The one thing

The power structure lives in its own file, beside the RTL, so it can change without editing logic and be checked by every tool in the
flow. That file is a specification — keep it in step with the RTL, run its checks on every change, and agree every clamp value with the
person who knows what the signal means.

## Commute exercise

A system-on-chip. On the way home, try to list its clocks. Not the exact number — the kinds.

Start with the processors. Then the memory interface. The peripherals: a serial port, a display, a camera, a network interface, a USB
port. The always-on controller. Test clocks. Debug clocks.

For each, ask: where does it come from — a crystal, a phase-locked loop, a pin, a divider? What frequency? Can it change at runtime,
because of DVFS? Can it be stopped?

You will probably reach twenty or more.

Then the question worth the drive: every pair of these clocks that exchanges data is a crossing — Season 1 episode seven. **How many
crossings might there be, and who is responsible for making sure every single one is handled correctly?** What document would you need
to even know where they all are?
