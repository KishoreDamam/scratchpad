---
season: 6
episode: 11
title: Reset domain crossing
runtime: about 10 minutes
prerequisites: s6ep09, s6ep10
one_thing: An asynchronous reset is an event with no clock, so wherever a register reset by one signal feeds a register that is not, there is a crossing — even inside one clock domain. Protect it by holding the receiver quiet, ordering the resets, or synchronising, and check it with its own tool.
---

> Production note: this episode names a problem most listeners have never heard
> of. The tone should be "this explains things you have seen", not alarm.

## Where we are

Yesterday's two flip-flops in one clock domain.

When software asserts A's reset, A's output changes **immediately**, at whatever instant the reset
arrives — not on a clock edge. If that change reaches B just as B's clock edge arrives, B samples a
signal in mid-transition. B can go **metastable**, exactly as if the signal had come from an unrelated
clock. It resolves, usually quickly, to either the old or the new value — and in the meantime, anything
downstream of B may see an unknown voltage, or may see a value that disagrees with some other register
that sampled the same signal.

The two flip-flops share a clock. A clock domain crossing tool sees no crossing. And yet B has just
experienced a crossing — not between two clocks, but between a clock and an **asynchronous reset**.

That is a **reset domain crossing**, and it is today.

## The problem

Season 2 episode three said: assert reset asynchronously. That half exists so reset works even without
a clock — at power-on, before any clock is stable. It was the right rule.

But notice what "asynchronous" means. The moment reset is asserted, every register it reaches changes
value, instantly, **with no relationship to any clock**. For the registers being reset, that is fine:
they are going to their reset value and their neighbours are being reset too.

The problem is the neighbours that are **not** being reset.

When the whole chip resets together, there are none. Every register goes to its reset value at once;
nobody downstream is running to notice anything.

But episode nine gave you **reset levels**: warm reset that leaves some logic running, block resets that
restart one block while the rest of the chip carries on, debug resets that spare the debugger. Every one of
those creates a boundary between logic that is being reset and logic that is still running. And every signal
crossing that boundary is a place where an asynchronous change arrives, unannounced, at a running flip-flop.

## Why it matters

A metastable flip-flop is one problem. The consequences are several.

**Corrupted state.** The running block captures a garbage value from the block being reset — a half-changed
bus, a spurious request — and acts on it. A state machine jumps to the wrong state. A counter takes a wrong
value. A FIFO pointer moves.

**Spurious events.** A valid signal from the resetting block drops asynchronously; a request line glitches;
the running block sees a transaction that never happened, or loses one that was in flight.

**And failures that look like nothing else.** They only happen when a reset is asserted at a particular moment,
relative to a particular clock edge, while a particular transfer is under way. On the bench, they almost never
reproduce. In the field, they appear as "the system occasionally misbehaves after a peripheral restart" — the
kind of bug that is investigated for months and closed as unreproducible.

This is why reset domain crossings are sometimes called the problem almost nobody checks for. The failures are
real, they have been found on shipped chips, and until relatively recently most flows had no tool that looked for
them.

## The turn

The fix is the same kind of thinking as clock crossings: **identify every crossing, and put a safe structure on
each.** The structures are different, though, because the problem is different. Three approaches, often combined.

## Fix one: hold the receiver quiet

If the running block is not *listening* when the reset arrives, it does not matter what the reset does to the
signals.

So before asserting a block reset, the controller first tells every receiving block to **ignore** its inputs from
the block being reset — a qualifying enable on the receiving side, or an isolation-like gate that holds the crossing
signals at safe values. Only then is the reset asserted. The receiving flip-flops are not sampling the crossing, so
nothing unexpected is captured.

That is exactly episode four's isolation, in a new context. And it needs the same sequencing discipline: gate the
crossing, then assert reset; release reset, wait for the block to be ready, then ungate.

## Fix two: order the resets

If the receiver is also reset — at the same time or first — it cannot capture anything wrong, because it is itself going
to its reset value.

So the reset plan can arrange that whenever a register is reset, **every register it feeds is reset too**, or earlier. That
is often natural within a block. Across blocks, it means thinking about reset levels deliberately: a register in a warm-reset
domain should not feed a register in a cold-only domain without protection, because a warm reset will change the first without
touching the second.

## Fix three: make the reset synchronous at the crossing

Or synchronise the reset **assertion** itself for the registers that feed running logic, so their outputs only ever change on a
clock edge. That turns the crossing back into an ordinary timed path — at the cost of needing a running clock for assertion, which
undoes the reason for asynchronous assertion in the first place. So it is applied selectively: to the specific registers at the
boundary, not the whole block.

## Finding them

Which crossings exist? The same way as clock crossings: a tool.

**Reset domain crossing tools** read the netlist and the reset structure — which signal resets which register, and which reset
sources can be asserted independently — and find every path from a register in one reset domain to a register in another that
can be running while the first is reset. Then they look for a recognised protection: a qualifying enable, a guaranteed reset order,
a synchronised assertion.

And the same warnings apply as yesterday, word for word.

**The tool is only as good as the reset plan it is given.** If the tool does not know that a block reset can be asserted while the
rest of the chip runs, it will not look for crossings at that boundary. Episode nine's table — every reset source and every domain it
reaches — is the input.

**Waivers need reasons.** Many reported crossings are safe because of a sequence the tool cannot see — software always idles the block
before resetting it. That is a claim about behaviour. Make it an assertion, or make the hardware enforce it.

## The general lesson

Step back for a moment, because this episode completes a pattern.

Season 1 episode seven: **clock** crossings — two clocks with no relationship.

Episode five of this season: **power** crossings — a sender that can vanish.

Today: **reset** crossings — an event with no clock.

They are the same idea three times. **Wherever two parts of the design can be in unrelated states, every signal between them is a
crossing that needs a deliberate structure.** Unrelated clocks, unrelated power, unrelated resets. The chip is a map of domains, and
the bugs live on the borders.

Which is why this season's checkpoint is to draw the clock, reset and power domain map of a design and defend every crossing on it.

## The cost

A reset domain crossing tool, and a reset plan detailed enough to drive it. Sequencing logic in the reset controller to gate crossings
before block resets. Some registers with synchronised assertion. Waivers with reasons.

Against that, the category of bug that most often survives everything else in this series and appears, occasionally, after a peripheral
restart in a customer's hands.

## The one thing

An asynchronous reset is an event with no clock, so wherever a register reset by one signal feeds a register that is not, there is a crossing
— even inside one clock domain. Protect it by holding the receiver quiet, ordering the resets, or synchronising the boundary, and check it with
its own tool against a correct reset plan.

## Commute exercise

A block that has not been designed yet. It will contain a sixty-four-bit datapath running at five hundred megahertz, about four thousand flip-flops,
two memories of sixteen kilobytes each, and it will be busy about thirty percent of the time.

Your manager asks: roughly how much power will it take? They need a number this week, for the chip's power budget, before any RTL exists.

On the way home, work out how you would even begin.

Which of episode one's enemies would you estimate first? What would you need to know about the flip-flops, the clock tree, the memories? What does
thirty percent busy change, and what does it not change?

You do not need real numbers for any of it. You need the **structure** of the estimate — the list of terms, and for each, what it depends on.

Then the question worth the drive: your estimate will be wrong. **How wrong can it be before it is useless — and what would you say alongside the
number, so that the person using it knows how much to trust it?**
