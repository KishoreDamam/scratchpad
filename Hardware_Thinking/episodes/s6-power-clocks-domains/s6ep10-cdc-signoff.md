---
season: 6
episode: 10
title: CDC signoff
runtime: about 12 minutes
prerequisites: s1ep07, s2ep08, s5ep05, s6ep08
one_thing: Clock domain crossing signoff has two halves — structural, which checks every crossing has a recognised synchroniser, and functional, which checks the protocol around it is obeyed. A clean structural report on a wrong clock plan proves nothing, and the waivers are where the bugs hide.
---

> Production note: yesterday's exercise answer is the hook — the design that passes
> the naive check. Keep returning to "every bit was synchronised and it is still
> broken".

## Where we are

Yesterday's four-bit mode value, going from three to four — zero zero one one to zero one zero zero.

Three bits change at once, each through its own synchroniser, and each synchroniser independently
takes one cycle or two to pass the change, depending on exactly where the edge fell relative to the
receiving clock. So for a cycle or two, domain B can see **any mix** of old and new values on those
three bits. It might see zero one one one — seven. It might see zero zero zero zero — zero. Neither was
ever sent. If mode seven or mode zero does something drastic, it does it, for a cycle, for no reason,
at random.

Every synchroniser was correct. A check that asks "does every crossing bit have a synchroniser" passes
this design.

What catches it is a check that asks a different question: **do independently synchronised signals come
back together in the receiving domain?** That is called **reconvergence**, and it is the most important
single idea in today's episode.

And the correct ways to move a multi-bit value: a **Gray code**, if the value only ever steps by one — a
counter, a pointer; a **handshake**, where the data is held stable in the source domain and only a single
control bit is synchronised, telling the receiver when it is safe to sample the data directly; or an
**asynchronous FIFO**, Season 2 episode eight, for a stream.

## The problem

Season 1 episode seven gave you the idea: a signal crossing between unrelated clocks can be sampled
mid-transition, sending the receiving flip-flop metastable, and a synchroniser — two flip-flops in a row —
gives it time to resolve. Season 2 episode eight gave you the asynchronous FIFO for streams.

Episode eight of this season showed that a real chip has hundreds of crossing points. And every one must be
right, because a single unsynchronised crossing produces failures that are rare, intermittent, temperature-
dependent, and essentially impossible to debug from symptoms.

Simulation does not help. In a normal simulation, there is no metastability. A synchroniser always passes a
change in exactly the same number of cycles. Yesterday's reconvergence bug never appears, because all four
synchronisers always agree. The test passes forever.

So crossings need their own signoff — as rigorous as timing, and just as dependent on the plan being right.

## The turn

**Clock domain crossing signoff** — CDC — is done with dedicated tools, and it has two halves that check very
different things.

## Half one: structural

The structural check reads the netlist and the clock definitions, finds **every** path where a signal launched
by one clock is captured by an unrelated one, and checks each against a list of recognised safe structures.

It flags these, and they are the classic catalogue.

**No synchroniser.** A signal from domain A goes straight into logic in domain B. The obvious bug, and still
common, because signals get added late.

**Logic before the synchroniser.** The signal passes through combinational logic in domain A before reaching B's
synchroniser. Combinational logic can **glitch** — briefly output a wrong value while its inputs settle. In a single
domain that does not matter, because the glitch is over before the next edge. Across a crossing, B's synchroniser
samples at an arbitrary moment, and may capture the glitch as if it were real. The rule: **a crossing signal must
leave its source domain directly from a flip-flop.**

**Divergence.** One signal from A goes to **two** separate synchronisers in B. They can resolve on different cycles,
so for a cycle B's two copies disagree. If both copies feed logic that assumes they are equal, that logic sees a state
that should be impossible.

**Reconvergence.** Today's opening. Several signals, synchronised separately, combined in B. Each is safe alone; the
combination is not.

**Multi-bit crossing without a scheme.** A bus crossing without Gray coding, a handshake, or a FIFO.

The tool recognises the standard structures — the two-flop synchroniser, the handshake, the asynchronous FIFO, the Gray-
coded pointer — and reports every crossing that is not one of them. A big design produces a long report, and the work is
going through it.

## Half two: functional

Structure is not enough, because every safe structure depends on a **protocol** being obeyed, and the structure cannot
check the protocol.

**Pulses from fast to slow.** A single-cycle pulse in a fast domain may be shorter than one period of the slow domain.
The slow synchroniser samples before it and after it, and never sees it. The pulse is lost. Structurally, the synchroniser
is fine. Functionally, the event vanished. Fixes: stretch the pulse, or convert it into a **toggle** — flip a level on every
event, synchronise the level, and detect changes on the other side.

**Handshakes.** The data must be held stable in the source domain from the moment the request is raised until the
acknowledge comes back. If the source changes the data early, the receiver may sample it mid-change. The structure is a
correct handshake; the source's behaviour breaks it.

**Gray code.** The Gray-coded pointer is only safe if it genuinely changes one bit at a time, and — Season 5 episode five —
if the bits' path delays are kept within about a period of each other, with a maximum-delay constraint, not a false path.

**Quasi-static signals.** A configuration register crossing with no synchroniser, on the claim that it only changes when the
receiving domain is idle. Season 5 episode five's lesson, again: that is a claim about behaviour, and it needs the hardware to
guarantee it and an assertion to check it.

CDC tools handle this half by generating **assertions** for each protocol — the data is stable while the request is high; the
pulse is at least so many receiving-clock cycles long; the Gray-coded value changes by at most one bit — and those assertions are
checked in simulation, or proved formally. Season 4 episode four's instrument, applied to crossings.

## Making simulation see metastability

One more technique, because normal simulation is blind to the most important bugs.

**Metastability injection.** A simulation mode where each synchroniser, instead of always taking exactly two cycles, randomly takes
one or two — or three — as a real one might. Now reconvergence bugs appear in simulation: the four synchronisers disagree, the receiving
logic sees an impossible value, and a scoreboard or an assertion fires. It turns an invisible class of bug into an ordinary failing test.

## What a clean report does not prove

Now the warnings, and they share a shape you have heard all season.

**A CDC tool only knows the clocks it is told about.** If two clocks are declared related when they are not, the tool believes every path
between them is timed and synchronous, and reports no crossings at all. If a generated clock is missing, its registers belong to the wrong
domain. A clean CDC report on a wrong clock plan is episode eight's mistake, dressed as signoff. Silence that looks like success, one more time.

**Waivers are where the bugs hide.** A big design produces thousands of findings. Many are genuinely safe for reasons the tool cannot see — a
signal that really is static, a structure the tool does not recognise. So they are waived. And every waiver is a claim, made by someone under
pressure, that a crossing is safe. **Every waiver needs a written reason and a reviewer.** A report with ten thousand waivers written by one
person in one afternoon is not signed off. It is signed.

**And structural and functional are both required.** A structural pass with unchecked protocol assertions has checked the wiring, not the
behaviour.

## Synchronisers themselves

A last practical point. Synchroniser flip-flops are special.

They should be **dedicated synchroniser cells** from the library where available, designed to resolve metastability quickly. They must be **placed
close together**, so the tiny wire between them adds no delay to eat into the resolution time. And synthesis must be told **not to touch them** — not
to retime them, duplicate them, merge them, or put logic between them. A synchroniser that the tool helpfully optimised is no longer a synchroniser.

The standard way to guarantee all of that: never write the two flip-flops by hand in each block. Instantiate one **synchroniser module**, written once,
used everywhere. The CDC tool recognises it, the synthesis constraints protect it, and a single review covers every crossing in the chip.

## The cost

A CDC tool and the effort of reading its report. A clock plan accurate enough to feed it. Protocol assertions and the simulations or proofs that check
them. Metastability-injection runs. Reviewed waivers. A synchroniser library that everybody uses.

Against that: the elimination of the single category of bug most likely to escape every other kind of verification and appear, intermittently, in the
field.

## The one thing

Clock domain crossing signoff has two halves: structural, which checks every crossing has a recognised synchroniser with nothing unsafe around it — no logic
before it, no divergence, no reconvergence — and functional, which checks the protocol is obeyed. A clean report on a wrong clock plan proves nothing, and every
waiver needs a reason and a reviewer.

## Commute exercise

Two flip-flops, **in the same clock domain**, driven by the same clock. Flip-flop A drives flip-flop B through some logic.

A has an asynchronous reset from a block-level software reset. B is **not** reset by that signal — it belongs to a different part of the design, which keeps
running while A's block is restarted.

The CDC tool reports nothing. Same clock — no crossing.

Now software asserts A's reset, in the middle of normal operation, at a moment that has nothing to do with the clock.

On the way home, work out what B sees.

A's output changes the instant reset is asserted — asynchronously. Is that change aligned with the clock? What happens if it arrives at B just as B's clock edge
comes? What has B just experienced — even though the two flip-flops share a clock?

And the question worth the drive: **what is the name for this crossing that no clock domain tool sees**, and what would fix it?
