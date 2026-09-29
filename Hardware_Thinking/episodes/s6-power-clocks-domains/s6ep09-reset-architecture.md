---
season: 6
episode: 9
title: Reset architecture for a real chip
runtime: about 11 minutes
prerequisites: s2ep03, s5ep03, s6ep08
one_thing: Reset is a sequence, not a signal. Who resets whom, in what order, with which clocks running, and what survives — decided in a plan, implemented by a controller, and never left to each block to guess.
---

> Production note: the power-on sequence should be counted as steps, like episode
> four's. The "what survives a reset" section is the one listeners will not have
> considered.

## Where we are

Yesterday's block, reset while its clock was stopped.

Assertion worked — asynchronous assertion needs no clock, and every flip-flop went to its reset value.
But release goes through a reset synchroniser, two flip-flops clocked by the block's own clock. With
the clock stopped, the synchroniser cannot move. Software released reset, and the synchroniser's
output stayed asserted — the block is still in reset, which is at least safe.

Then the clock starts. The synchroniser now clocks through the release, two cycles later, cleanly. So in
this exact sequence the block probably comes out correctly — by luck. Change the details slightly —
the clock starting within a cycle of the release, or a design with no synchroniser because somebody
thought the reset was "slow enough" — and different flip-flops leave reset on different edges, and the
block starts in a combination of states no legal sequence produces.

And who decides the order? That is today. And the phase-locked loop is the right thing to have thought
about: its clock is not usable until it has **locked**, and no domain it feeds can safely leave reset
before then.

## The problem

Season 2 episode three gave you the rule for one block: assert asynchronously, release synchronously,
with a synchroniser per clock domain. Correct, and not remotely enough for a chip.

On a real chip, reset is not one signal. There are several **reasons** for reset — power first applied,
a watchdog timer expiring, software requesting it, a debugger requesting it, a single block being
restarted after an error. There are dozens of **domains**, each with its own clock, some powered off,
some with clocks that are stopped. And the domains **depend on each other**: a block cannot start until
its clock is stable, the bus it talks to is out of reset, and its configuration has been loaded.

Leave that to each block to handle and you get a chip that usually starts, and occasionally does not,
depending on the order in which things happened to settle.

## The turn

Reset is a **sequence**, and it needs a **controller** and a **plan**, just as episode four's power
sequencing did.

The plan answers four questions.

## Who resets whom

First, the reset **sources** and what each one resets.

**Power-on reset** — from a circuit that watches the supply and holds the chip in reset until the voltage is
stable. Everything is reset. This is the **cold** reset.

**Watchdog reset** — a timer that software must keep refreshing, and which resets the chip if software hangs.
Usually resets nearly everything.

**Software reset** — a register software can write. Might reset the whole chip — a **warm** reset — or just one
block.

**Debug reset** — requested through the debug interface, often resetting the processors but not the debug logic
itself.

**Block reset** — one block restarted after an error, while the rest of the chip keeps running.

For each source, the plan says **which domains it reaches**. That is a matrix, and every cell in it is a decision.

## In what order

Second, the **sequence**. A typical power-on, as steps.

**One: supply stable.** The power-on reset circuit holds everything in reset until the voltage is good.

**Two: reference clock running.** The crystal oscillator starts and stabilises.

**Three: phase-locked loops lock.** Each is given its reference and allowed to settle; each signals when it has locked.
Until then, its output is not a usable clock.

**Four: clocks enabled.** The clock controller switches each domain from a safe default — often the reference clock itself —
to its intended generated clock, through yesterday's glitch-free multiplexers.

**Five: domains released, in dependency order.** The always-on controller first. Then the memory and the system bus. Then the
processor that will run the boot code. Then peripherals, often only when software enables them. Each release goes through that
domain's own synchroniser, clocked by that domain's now-running clock.

**Six: configuration.** Fuses read, trimming values loaded, boot code fetched.

The order is not arbitrary, and each step has a reason. A domain released before its clock is stable misbehaves. A processor
released before the memory it boots from is out of reset fetches garbage. A peripheral released before its bus is ready sees
transactions from nowhere.

That whole sequence is run by a **reset controller**, in the always-on domain, often combined with episode four's power controller,
because power-up and reset are two halves of one sequence.

## With which clocks

Third: **the clock must run for release**. Yesterday's lesson, generalised.

Every domain's reset is released through a synchroniser on that domain's clock. So every domain's clock must be running and stable
before its release — and the sequence must enforce that, not hope for it.

And a subtler case: resetting a block whose clock can be stopped. If a block is gated to save power, and an error recovery needs to
reset it, the controller must either start the clock before releasing, or hold the reset until the clock next runs. A reset controller
that releases blindly, on a domain whose clock is off, has created exactly yesterday's bug.

Also: **reset timing is real timing**. Season 5 episode three: the release fans out through a buffer tree to thousands of flip-flops,
and it must arrive at all of them within the same clock cycle — recovery and removal checks. That only works if the release is
constrained against the right clock, which requires the reset plan to say which clock releases which domain.

## What survives

Fourth, and the one people forget: **what is deliberately not reset**.

A warm reset from the watchdog should not erase the record of *why* the chip was reset — otherwise software, after restarting, cannot tell
whether it crashed. So a **reset cause register** lives in a domain that only cold reset reaches.

A debug reset should not reset the debugger. Otherwise you can never debug a reset problem, because the act of resetting disconnects the tool
watching it.

Some configuration — clock settings, power settings, security state — may need to survive a warm reset, so the chip does not have to repeat a
slow boot, or so that security settings cannot be undone by a software-triggered reset.

And some logic has **no reset at all**, deliberately — large datapath registers whose values are always written before being read, where
adding a reset would cost area and routing for nothing. That is fine, and it must be deliberate: Season 2 said a register without reset whose
value *is* read before being written is a simulation-versus-silicon mismatch waiting to happen, because simulation starts it as unknown and
silicon starts it as whatever it powered up as.

So the plan has **reset levels**: logic reached by cold reset only, by cold and warm, by block reset, and not at all. Each register belongs to
exactly one level, on purpose.

## The document

As with clocks, a table.

For each domain: its **clock**. Its **reset sources**. Its **position in the release sequence**, and what it depends on. Its **reset
synchroniser**. And what within it survives which kind of reset.

That table feeds the timing constraints, the reset controller's design, the verification of the sequence, and — tomorrow and the day after — the
crossing checks, because resets cross domains too.

## Verifying it

The reset controller is control logic with a sequence, dependencies and many cases. Season 4 episode eight: formal devastates exactly this. Assert
that no domain is released before its clock's lock signal. Assert that the reset cause register is never cleared by warm reset. Cover every reset
source, in every power state.

And simulate the **whole sequence**, from power-on, at the chip level — not just each block from an already-reset state. A great many chip-level bugs
are found only by simulating the first microsecond of the chip's life, which block-level testbenches never exercise because they start with reset
already done.

## The cost

A reset controller. A plan and a table that every block must respect. Chip-level simulation of the boot sequence, which is slow. A handful of reset
levels, each with registers assigned to it deliberately.

And a discipline that feels bureaucratic until the first time a chip fails to boot one time in a thousand, and the cause turns out to be two domains
leaving reset in the wrong order.

## The one thing

Reset is a sequence, not a signal. Who resets whom, in what order, with which clocks running, and what survives — decided in a plan, run by a controller,
and never left to each block to guess.

## Commute exercise

A four-bit control value — a mode setting — must cross from domain A to domain B, which runs on an unrelated clock. The designer puts a standard two-flop
synchroniser on each of the four bits, separately. The value changes rarely, a few times a second.

On the way home, work out what can go wrong.

Suppose the value changes from binary three — zero zero one one — to binary four — zero one zero zero. Three bits change at once. Each synchroniser resolves
independently. Each can take either one or two cycles to pass its new value, depending on exactly where the change fell relative to B's clock.

What values might domain B see, for a cycle or two, in between the old value and the new one?

And the question worth the drive: every single one of those four synchronisers is correct. A tool that checks "does every crossing bit have a synchroniser"
would pass this design. **So what kind of check would catch it?** And what are the correct ways to move a multi-bit value across a clock boundary?
