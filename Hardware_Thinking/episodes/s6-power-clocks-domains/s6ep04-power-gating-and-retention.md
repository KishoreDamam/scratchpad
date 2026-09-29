---
season: 6
episode: 4
title: Power gating and retention
runtime: about 12 minutes
prerequisites: s2ep03, s6ep01, s6ep03
one_thing: Power gating is the only cure for leakage, and it turns a block into something that forgets. Every power-down is a sequence — stop, save, isolate, switch off — and every power-up is that sequence in reverse, and the order is the design.
---

> Production note: the two sequences should be counted on fingers, down and up.
> Say them twice. The break-even idea is the practical close.

## Where we are

Yesterday's sensor block, idle ten seconds in every eleven, with every clock gated and every memory
disabled.

What is left is **leakage**. Every transistor in the block trickles current from supply to ground,
every second, busy or idle. The dynamic power while idle is zero, and the leakage is not — and with
the block idle ten times longer than it is busy, ten seconds of leakage can rival or exceed one second
of real work. Clock gating cannot touch it.

Only removing the supply removes leakage. And the two questions you were asked are exactly today's.

What does the block lose? **Everything it knows.** Every register, every piece of state, every
configuration value. When it comes back, it comes back as if from a cold start.

And what does the rest of the chip see on its output wires while it is off? **Nothing defined.** The
outputs of an unpowered block drift to whatever voltage they happen to settle at. The neighbour
receiving them sees neither a clean zero nor a clean one, and may interpret them as anything —
including a request, or an interrupt, or a clock edge. That is the most dangerous thing in this episode,
and it has a precise fix.

## The problem

Leakage is the enemy of any device that spends most of its life waiting. A phone in your pocket. A
watch. A sensor on a wall. Their energy budget is dominated not by what they compute, but by what they
leak while doing nothing — and on modern processes, that leakage is large.

The answer is to divide the chip into **power domains** — regions whose supply can be switched off
independently — and turn off whatever is not needed. A graphics block while nothing is on screen. A
radio between transmissions. An entire processor cluster between key presses.

That sounds simple: put a switch in the supply. It turns out to reshape the design, because a block that
can lose its power is a block whose state and outputs can vanish, and everything around it must be built
to survive that.

## The turn

The switch itself is simple. Between the chip's permanent supply and the block's local supply, there are
many large transistors used as **power switches**. When they are on, the block is powered. When they are
off, the block's local supply floats down towards ground and the block's leakage falls to nearly nothing.

Everything interesting is in what surrounds the switch. And it is best understood as **two sequences**.

## Powering down

Four steps, in order.

**One: stop.** Finish or abandon any work in flight, and stop the block's clocks — episode two's
coarse-grained gating. A block must be quiet before it is switched off; turning off power under a
running clock produces unpredictable activity at the moment of collapse.

**Two: save.** If the block needs to remember anything, save it now. That might mean software copying
configuration to a memory that stays on. Or it might mean **retention registers**, which I will come to.

**Three: isolate.** Clamp every output of the block to a known, safe value, **before** the power goes.
This is today's opening danger, fixed: an **isolation cell** on each output, powered from the permanent
supply, which, when enabled, ignores the block and drives a fixed value to the neighbour. The block's
outputs can now float as they like; the neighbour never sees them. Episode five goes into this properly.

**Four: switch off.** Open the power switches.

## Powering up

The same four steps, in reverse. And the order is just as important.

**One: switch on.** Close the power switches. And here there is a physical trap. An unpowered block is a
large, discharged capacitor. Switching it on all at once draws an enormous surge of current from the supply
— the **rush current** — large enough to cause the voltage to sag for every *other* block on the chip,
which can corrupt their state. So the switches are turned on **gradually**: a few weak switches first,
charging the block slowly, then the rest, often as a daisy chain where each group turns on the next, with an
acknowledge signal coming back when the last is on. Power-up takes time, measured in microseconds, and the
controller must wait for that acknowledge.

**Two: reset and restore.** The block's registers woke up holding random values. Reset it — Season 2 episode
three's reset, asserted asynchronously and released synchronously, which requires a running clock. Then
restore anything that was saved.

**Three: release isolation.** Only now, with the block powered, reset and restored, do the isolation cells
stop clamping and let the block's real outputs through. Release isolation too early and the neighbour sees
the block's random power-up values as real signals.

**Four: start.** Enable the clocks and let it work.

Those two sequences are run by a **power controller** — a state machine that lives in a domain that is never
turned off, usually called the **always-on** domain. It is often small, slow and simple, and it is one of the
most carefully verified pieces of logic on the chip, because a bug in it can leave a block powered off
forever, or powered on with isolation clamped, or waking into a state it cannot leave.

## Retention

Now the second step of powering down: saving state.

A **retention register** is a flip-flop with a small extra storage element — often called a balloon or shadow
latch — powered from the permanent supply. Before power-down, a **save** signal copies the flip-flop's value
into the shadow latch. The main flip-flop loses power and forgets; the shadow latch, still powered, remembers.
After power-up, a **restore** signal copies the value back.

It is elegant, and it costs. A retention flip-flop is noticeably larger than a normal one, and its shadow latch
leaks a little, all the time, because it never turns off. So retention is used **selectively**: the state that
is expensive to recreate — a configuration that took software a long time to compute, a processor's
architectural state — is retained. State that is cheap to recreate — a pipeline's contents, a buffer — is simply
lost and reset.

The alternative to retention flip-flops is **software save and restore**: before power-down, software reads the
block's registers and stores them in memory that stays on; after power-up, it writes them back. Cheaper in area,
slower to wake, and dependent on software doing it correctly every time.

The choice between them is a trade of area and leakage against wake-up time, and it belongs in the architecture
document.

## When is it worth it

Power gating is not free, even ignoring area. Switching a block on costs **energy** — the charge needed to bring
its local supply back up, the energy of the restore, the reset. And it costs **time** — the gradual switch-on,
the reset, the restore.

So there is a **break-even** idle time. If the block will be idle for less than that, switching it off and on
again costs more energy than simply leaking through the idle period, and it adds wake-up latency for nothing.
If it will be idle for longer, power gating wins, and wins by more the longer the idle.

Which means the decision to power down is really a **prediction** about how long the idle will last. Hardware
controllers often use a simple timer — idle for this long, then power down. Software can do better when it knows
what is coming. Getting that prediction badly wrong in either direction wastes energy — or, worse, adds wake-up
latency to a request somebody was waiting for.

## Verifying it

Normal simulation assumes every block is always powered. It cannot see any of today's failures.

So power gating needs **power-aware simulation**: the simulator reads the power intent — episode seven — and when a
domain is switched off, it forces every signal in that domain to unknown. Any logic in a powered domain that reads
an unknown value from an unpowered one, without isolation, now shows unknowns spreading through the simulation —
a visible failure, instead of a silent one.

And the power controller's sequences are exactly the kind of control logic that Season 4 episode eight said formal
verification devastates. Assert that isolation is always enabled before the switches open. Assert that isolation is
never released before the acknowledge arrives and reset has completed. Cover every power state transition. Prove
them all.

## The cost

A power switch network, in area. Isolation cells on every output. Retention flip-flops, larger and always leaking a
little. An always-on domain with its controller. Wake-up latency. A new category of bugs that normal simulation
cannot see. And software that must cooperate.

Against that, the only cure there is for leakage — and in a device that spends most of its life waiting, that is
the difference between a battery that lasts a day and one that lasts a week.

## The one thing

Power gating is the only cure for leakage, and it turns a block into something that forgets. Power down: stop,
save, isolate, switch off. Power up: switch on slowly, reset and restore, release isolation, start. The order is
the design, and it is only worth doing when the idle is longer than the break-even.

## Commute exercise

A block that can be powered off drives three signals to an always-on neighbour.

A **valid** signal, active high: when it is one, the neighbour captures data.

An **interrupt** signal, active **low**: when it is zero, the neighbour's processor is interrupted.

And a thirty-two bit **data** bus.

On the way home, choose the isolation clamp value for each — the value the isolation cell drives while the block is off.

For valid, which value keeps the neighbour from capturing junk? For the interrupt, which value keeps the processor from
being interrupted? For data, does it matter at all — and if it does not, what might you choose anyway, and why?

Then the question worth the drive. The person who writes the power intent file chooses these clamp values. The person
who writes the RTL chooses whether each signal is active high or active low. **They may be different people, in
different teams, writing different files. What happens if they never talk?**
