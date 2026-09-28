---
season: 5
episode: 12
title: The handoff to back-end
runtime: about 12 minutes
prerequisites: all of season 5
one_thing: A handoff is not a set of files. It is the files plus the reasons — every constraint justified, every worry named — so the person on the other side can make good decisions without you in the room.
---

> Production note: season finale. Recap the twelve one-things as a single run. End on
> the lab project.

## Where we are

Yesterday's list. Everything the back-end team needs from you.

**The netlist**, and the RTL it came from, at a named version. **The constraints**: clocks, generated
clocks, input and output delays, uncertainty, exceptions — the same file you synthesised against. **The
clock and reset domain map**, with every crossing and the synchroniser that implements it. **A list of
cells that must not be touched or optimised away**: synchronisers that must stay together, deliberately
duplicated registers, debug logic. **Timing reports and a summary**: where the design stands, and at what
assumptions. **Floorplan hints**: which ports face which neighbours, where the memories should sit, which
modules talk heavily. **Clean lint, clean clock-crossing checks, and an equivalence check** between RTL and
netlist. And soon — Season 6 — the power intent file.

And the first thing a back-end engineer complains about, almost always: **constraints they cannot trust.**
A clean timing summary produced against ideal clocks with a small uncertainty. Exceptions with no comments.
Input and output delays that nobody can explain. The back-end engineer must decide whether to believe your
file, and if they cannot tell why each line is true, they will either spend days reverse-engineering it or
— worse — trust it.

Which tells you what a good handoff really contains. Not files. **Reasons.**

## The problem

In most organisations, front-end and back-end are different teams, sometimes in different companies,
sometimes in different time zones. The front-end team writes RTL, verifies it, synthesises it, and closes
timing against estimates. The back-end team places it, builds the clock tree, routes it, extracts the real
wires, and closes timing against reality.

The handoff between them is one of the most failure-prone moments in a project, and it fails in a
characteristic way. Front-end thinks it is done. It throws a netlist over the wall. Back-end discovers
problems — congestion, unexplained constraints, paths that close in synthesis and fail after routing, a clock
structure they did not expect — and throws questions back. Front-end has moved on to the next block and
answers slowly, or not at all. Weeks pass.

## The turn

The turn is to see that the handoff is not a delivery. It is the start of a **loop**, and the quality of the
first delivery decides how many times the loop goes around.

So think of it in three parts: what they need, what they will complain about, and what you owe them afterwards.

## What they need

The list from this morning, and one more thing that is on nobody's checklist.

**A written note of what you are worried about.**

Every front-end engineer who has closed timing on a block knows where the bodies are. The interface that closed
with ten picoseconds to spare. The multiplexer that is going to be congested. The path that only closed because
of a multicycle exception whose premise is subtle. The memory whose placement will decide whether anything
works.

Write those down. One page. It takes an hour, and it tells the back-end engineer where to look first, which is
worth days of their time. It is Season 4 episode twelve's one-page statement, in a new costume: here is what I
know is fine, here is what I am not sure about, and here is why.

## What they will complain about

Knowing the complaints in advance lets you prevent them. The common ones are few.

**Constraints that do not match reality.** Covered. Justify every exception. Calibrate the uncertainty against
the process. Make sure the unconstrained-endpoint check is at zero.

**Congestion.** Episode nine's wide multiplexers, crossbars and central structures. If you know one is there,
say so, and say what could be changed if it does not route.

**Unregistered interfaces.** Episode ten. A combinational path through a port with no written budget is a problem
the back-end engineer cannot solve alone, because they do not know what the other side needs.

**High fanout nets they were not told about.** A reset or an enable driving the whole block. They will buffer it,
but they need to know which signals are timing-critical and which are not.

**And late changes.** This is the big one, and it is not technical. After the handoff, RTL keeps changing — a bug
fix from verification, a feature somebody decided to add. Every change means a new netlist, and a new netlist
means the physical work restarts partly or entirely. Nothing damages the relationship between the two teams faster
than a stream of "small" RTL drops after placement has begun.

## What you owe them

The handoff creates obligations, and they run in one direction.

**Freeze discipline.** After the handoff, RTL changes should be rare, deliberate and batched — not a continuous
trickle. Agree when the freeze begins and what qualifies as an exception.

**Engineering change orders.** Late in a project, a small bug fix may be applied directly to the placed and routed
netlist, rather than re-running synthesis — an **engineering change order**, usually shortened to ECO. The front-end
engineer's job is to specify the change precisely, at the gate level if needed, and to prove it correct: equivalence
checking between the fixed RTL and the fixed netlist, Season 4 episode eight's quiet formal success, doing its most
important work.

**Answering questions quickly.** When the back-end engineer asks why an exception is true, or whether a path can have
another cycle, the answer is usually a day's delay if it comes tomorrow and a week's if it comes next week. Your
next block can wait an hour.

**Owning post-layout failures that are architectural.** When real wires reveal that an interface needs another pipeline
stage, that is not a back-end problem. It is episode eight's decision, and it is yours. Say so early.

## The loop

After layout, timing comes back with real wire delays and a real clock tree. Some paths that were clean are now
failing. Some that were failing are now clean. Hold violations appear by the thousand and are fixed in bulk — episode
six said to expect that.

And the front-end engineer's job in that loop is to read the post-layout timing reports — episode eleven — and sort the
failures into two piles. **Physical problems** the back-end team can fix with placement, sizing, buffering or routing.
And **structural problems** that need an RTL change — too many logic levels, a missing register on a long interface, a
congested structure. The earlier the second pile is identified, the fewer times the loop goes around.

## Season 5 in twelve sentences

**One.** Synthesis elaborates, optimises and maps; structure is yours, and the removal report tells you what died.

**Two.** A cell's delay is a function of its input transition and its load, and hold fails at any clock speed.

**Three.** Clocks, input delays, output delays, exceptions — and an unconstrained path is a path nobody timed.

**Four.** Static timing analysis is exhaustive because it ignores what the logic computes.

**Five.** An exception is a claim about behaviour: make the hardware guarantee it and an assertion check it.

**Six.** The clock is never one edge; skew and jitter are taken from somebody's logic.

**Seven.** Diagnose the disease — depth, fanout, late arrival, distance — before choosing the fix.

**Eight.** When restructuring fails, add latency, add parallelism, or relax the requirement — and admit it early.

**Nine.** Wires are slower than gates, and your RTL decides where the wires go.

**Ten.** Register at boundaries by default, and write down a budget for every path that cannot be.

**Eleven.** A timing report is the slack sum written out; the disease is visible in fewer than five lines.

**Twelve.** A handoff is the files plus the reasons.

## The lab project

Before Season 6, synthesise the block you built and verified in Seasons 3 and 4.

**Write the constraints yourself**, from the architecture document. Clocks, input and output delays from your interface
budgets, uncertainty with a written reason for its value. No exceptions unless you can justify each one — with an
assertion.

**Run the unconstrained-endpoint check and get it to zero.**

**Push the clock until it fails.** Find the frequency where it just closes, then go beyond it.

**Read the critical path aloud**, as in episode eleven, and name its disease.

**Fix it three different ways**: one restructuring from episode seven, one architectural change from episode eight, and
one change of constraint or tool setting that you believe is legitimate. For each, **record what it cost** — in area, in
power if your tool reports it, in latency, and in how much less readable the RTL became.

**Then write the handoff note**, as if a back-end engineer you have never met were receiving it tomorrow. One page:
what is fine, what worries you, and why.

The table of three fixes and their costs is the real artefact. It is the checkpoint for this season: when you can look
at a failing path and produce a ranked list of fixes with their costs, without guessing, you have what this season set
out to teach.

## Where Season 6 goes

You can now build a block, prove it correct, and make it fast enough.

What you have not yet asked is how much **power** it burns, and whether it survives the domains around it — the clocks,
resets and power supplies that switch on and off independently. Season 6 is power, clocks and domains: where the energy
goes, how to stop spending it, and where the intermittent field failures that nobody can reproduce actually come from.

## The one thing

A handoff is not a set of files. It is the files plus the reasons — every constraint justified, every worry named — so
the person on the other side can make good decisions without you in the room.

## Commute exercise

The last one of the season.

Take your lab block, or a block from work, and on the way home compose the one-page handoff note out loud.

Three parts. **What is solid**: which interfaces, paths and constraints you would stake your name on. **What worries you**:
the thin margins, the subtle exceptions, the structures that might not route. **And what you would change if you had
another month.**

Then read the third part back. Every item on it is a decision you made under time pressure, and some of them will come
back as post-layout failures.

The question worth the drive: **which item on that list would be cheapest to fix now, before the handoff, rather than
after it?** Episode eight said architectural changes get more expensive every day. This is the last day they are cheap.

Thanks for the season.
