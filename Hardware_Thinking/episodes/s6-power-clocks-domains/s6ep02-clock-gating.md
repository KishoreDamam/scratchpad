---
season: 6
episode: 2
title: Clock gating
runtime: about 11 minutes
prerequisites: s2ep04, s5ep06, s6ep01
one_thing: Clock gating is the highest-return power technique there is, and you never write the gate. You write the enable, cleanly, and the tool inserts a library cell built to make the gated clock glitch-free.
---

> Production note: the latch explanation is the one technical passage that needs
> to be slow. Walk through clock high, clock low, enable changing, in that order.

## Where we are

Yesterday's idle block.

A thousand flip-flops, doing nothing ninety percent of the time, burning nearly as much as when busy.
Why? Because every flip-flop's clock pin toggles every cycle, whether or not its data changes. Inside
each flip-flop, the clock drives internal nodes that charge and discharge every edge. And the clock
tree feeding those thousand pins — buffers, wires — toggles every cycle too. The data is idle. The
clock is not.

So the idle power is two things. The **clock network's switching**, which is the large part here — and
stopping the clock removes it. And **leakage**, which stopping the clock does nothing about — only
removing the power supply fixes that, in episode four.

And the danger of stopping the clock with an ordinary AND gate: if the enable changes while the clock
is high, the AND gate's output changes mid-pulse. The gated clock gets a short, truncated pulse — a
**glitch** — that some flip-flops may see as an edge and others may not. Half the register bank captures
and half does not. That corruption is silent, rare, and dependent on exactly when the enable arrived.

Today is how the industry stops the clock safely, and why you should never do it yourself.

## The problem

Look at any real design and you will find that most registers, most of the time, capture the value
they already hold. A configuration register that changes once a boot. A pipeline stage with no valid
data in it. A buffer whose contents are only updated when something arrives. A state machine sitting
in idle.

In RTL, that behaviour is written as an **enable**: on the clock edge, if enable, take the new value;
otherwise, keep the old one. And Season 2 taught you that synthesis builds that as a multiplexer in
front of the flip-flop — a feedback path that selects the flip-flop's own output when the enable is low.

That is functionally perfect and wasteful in exactly the way yesterday described. The flip-flop is
clocked every cycle, its clock pin burns power every cycle, and the multiplexer spends its time
faithfully feeding the old value back. Clock tree, clock pins, multiplexer — all toggling to achieve
nothing.

## The turn

If a whole bank of registers shares the same enable, then instead of feeding each flip-flop its own
value back through a multiplexer, **stop the clock to the whole bank** when the enable is low.

No clock edges, no capture, the old value held for free. The multiplexers disappear. The clock pins of
the whole bank go quiet. And, crucially, so does the part of the clock tree that feeds only that bank —
because the gate sits at the root of that branch.

That is **clock gating**, and on typical designs it is the single largest power saving available at the
RTL level, often reducing dynamic power by a large fraction for very little area.

## The cell

Now yesterday's danger, and how it is solved.

The safe gate is not an AND gate. It is a dedicated library cell called an **integrated clock gating
cell**, and inside it there is a **latch** in front of the AND gate. Here is why that latch makes it
safe, walked through slowly.

The latch is transparent while the clock is **low**. During the low half of the cycle, the enable passes
straight through the latch, and the latch's output settles to whatever the enable is.

When the clock goes **high**, the latch closes. It holds whatever value the enable had at that moment,
and ignores any further changes to the enable until the clock goes low again.

The AND gate combines the clock with the **latch's output**, not the raw enable.

So during the high half of the clock — the only time the AND gate's output could be a pulse — the value
feeding it is frozen. The enable can change as much as it likes; the latch is closed and the pulse is
either fully there or fully absent. No truncated pulses. No glitches.

And the enable only needs to be stable around the moment the clock rises — which is exactly a setup
requirement, and Season 5's timing tools check it like any other path. The gated clock is glitch-free by
construction, and timed by the same machinery as everything else.

## Why you never write it

Three reasons, and they are all about the rest of the flow.

**The tool infers it better than you can.** You write the enable in the ordinary way — if enable, capture
— and synthesis recognises the pattern: many flip-flops sharing the same enable. It replaces their
feedback multiplexers with a single clock gating cell driving their clocks. That is automatic, standard,
and turned on in every serious flow.

**Hand-written clock logic breaks the clock tree.** Season 5 episode six said never put your own gates on
a clock. A hand-instantiated gate is logic the clock tree tools must reason around. A proper clock gating
cell is something they understand, and they will place it and balance around it deliberately.

**And hand-written clock logic breaks test.** Season 8 will explain scan: the test mode where every
flip-flop in the chip becomes part of a shift register. That requires every flip-flop to be clocked during
test, regardless of the functional enable. Proper clock gating cells have a dedicated **test enable** pin
that forces them open during scan. Your hand-written gate does not, and the flip-flops behind it become
untestable.

So the rule is simple. **You write the enable; the tool writes the gate.** Your job is to write enables that
the tool can recognise and that make gating worthwhile.

## Writing gate-friendly RTL

Four habits.

**Write enables explicitly.** A register that only changes when something happens should say so, with a
clean enable condition, rather than recomputing its own value every cycle through some expression that
happens to evaluate to the old value. The tool can only gate what it can see is an enable.

**Share enables across wide banks.** A gating cell costs area and some power of its own. Gating a single
flip-flop costs more than it saves. Tools have a minimum bank width below which they will not bother —
often a handful of bits. So a thirty-two bit register with one enable gates beautifully. Thirty-two
single-bit registers, each with its own subtly different enable, do not gate at all.

**Make the valid bit the enable.** In a pipeline, the natural enable for a stage's data registers is
"valid data is arriving". Season 1 episode eight's valid signal, doing a second job. When the pipeline is
empty, every data register in it stops clocking.

**And gate hierarchically.** Beyond the tool's automatic register-level gating, architects add
**coarse-grained** gating: one gating cell at the root of a whole block's clock, closed when the block is
idle. That stops the entire branch of the clock tree, which fine-grained gating cannot. It requires a
controller that knows when the block is idle, and it usually lives in a clock controller rather than in
the block itself.

## What it does not do

To be clear about the limits.

**Clock gating does nothing for leakage.** A gated block leaks exactly as much as an ungated one.

**It does nothing for logic that toggles because its inputs toggle.** If a register is gated but the
combinational logic downstream of some *other* register keeps churning, that logic still burns switching
power. That is tomorrow's subject.

**And it adds a timing path.** The enable must arrive at the gating cell before the clock rises, with setup
time — and because the gating cell sits early in the clock tree, the enable's budget can be tighter than a
normal path's. Gating enables occasionally become critical paths. The fix is usually to compute the enable
a cycle earlier and register it.

## Verifying it

Clock gating changes the netlist's structure but should not change behaviour — the gated flip-flops were
going to hold their values anyway. Equivalence checking, Season 4 episode eight, proves that.

The functional risk is in coarse-grained gating that *you* design: a block's clock stopped while it still
had work in flight, or not restarted in time for the next request. Those are ordinary logic bugs in a clock
controller, found with Season 4's instruments — an assertion that the block's clock is never gated while its
busy signal is high, and a cover that the gating actually happens.

## The cost

A gating cell's area, per bank. An enable timing path, which occasionally needs work. Some design
discipline in how enables are written. And, for coarse gating, a controller and its verification.

Against that, a large reduction in dynamic power, for free in the common case. It is the best trade in this
season, which is why it comes first.

## The one thing

Clock gating is the highest-return power technique there is, and you never write the gate. You write clean
enables shared across wide banks, and the tool inserts a library cell whose latch makes the gated clock
glitch-free, testable and timed.

## Commute exercise

A block contains a large multiplier. Its output is only used when a valid signal is high, which happens about
one cycle in ten. The multiplier's result register is clock-gated by that valid — so on the other nine
cycles, the result register does not clock.

But the multiplier's **inputs** come from a shared bus that carries other traffic every cycle. So on every
cycle, valid or not, new junk values arrive at the multiplier's inputs.

On the way home, work out what the multiplier is doing on those nine idle cycles, and what it costs.

Then fix it. What could you change about the inputs — not the output — so that the multiplier's internal
logic stops toggling when its result is not needed?

And the question worth the drive: clock gating stopped the *register*. What would stop the *computation*? And
how far up the design can that idea be pushed — beyond one multiplier, to a whole block, to a whole
algorithm?
