---
season: 4
episode: 11
title: The verification plan
runtime: about 11 minutes
prerequisites: s3ep12, s4ep03, s4ep08
one_thing: The verification plan turns the specification into a list of claims, each with a method and a measurement — and fixes the stopping rule before anyone is tired enough to want to stop.
---

> Production note: this is the season's Season-3-episode-twelve. Keep the "each row
> has four columns" structure audible: feature, method, measurement, priority.

## Where we are

Yesterday's silent specification.

A packet whose length is an exact multiple of the bus width. The design handles the last word one way,
the model another, and the specification says nothing. Neither engineer was careless. Both read the
document honestly and filled a gap with a reasonable guess — different reasonable guesses.

Where should it have been caught? Not by a regression, three months in. By a document whose job was to
walk through the specification, feature by feature, and ask for each one: *what exactly must be true
here, and how will we check it?* Asking that question about packet lengths forces someone to list the
length cases that behave differently — episode three's bins — and "exact multiple of the bus width" is
on that list. The moment it is listed, somebody asks what the correct behaviour is, and the gap in the
specification is found at a desk, in an afternoon, for free.

That document is the **verification plan**. And its most underrated function is exactly that: not
organising tests, but **finding the holes in the specification before anyone builds on them**.

## The problem

Season 1 episode nine said verification is a claim, not a test — a claim about what was checked, backed
by a plan written before you started, honest about what was not checked.

Eleven episodes later you have every instrument you need to make the claim. What you do not yet have is
the thing that turns instruments into a claim.

Without a plan, here is what verification looks like. Tests are written for the features the verification
engineer thought of, in the order they thought of them. Coverage is added when someone remembers to. The
question "are we done?" is answered by a feeling — the bug rate has dropped, the schedule says so, the
manager is asking. And six months later, when a bug escapes to silicon, nobody can say whether that
feature was ever meant to be verified, or by what, or whether anyone decided to skip it.

## The turn

A verification plan is, at heart, a **table**. I will describe it in words, because you are driving.

Every row is one **feature** — one thing the specification requires. Not "the packet interface" but
"packets of minimum length are accepted", "packets with the error flag are dropped and counted",
"backpressure is honoured within one cycle", "every request is granted within eight cycles".

And every row has three more columns.

**The method.** How this feature will be verified. Constrained-random simulation with the scoreboard.
A directed test. An assertion. A formal proof. Inherited — because this logic is a reused, already
verified block. Verified at a higher level — because this block cannot see the behaviour on its own.
Or, explicitly: **not verified**, with a reason.

**The measurement.** What evidence will show the method was applied. A coverage bin, or a cross, from
episode three. An assertion and its cover, from episode four. A formal proof with its reachable covers,
from episode eight. A named directed test that passes. Every row points at something the regression can
count.

**The priority.** How much it matters if this feature is wrong. Which is episode twelve's whole subject,
and it decides where the effort goes.

That is it. Feature, method, measurement, priority. The power is not in any row. It is in having **every
row**, and in the links.

## Traceability

The links run in both directions, and both matter.

**From the specification down.** Every requirement in the specification should map to at least one row
of the plan. A requirement with no row is a requirement nobody has promised to verify. You find those by
walking the specification line by line — which is dull, and which is exactly the activity that finds
yesterday's silent gap.

**From the measurements up.** Every coverage bin and assertion should map back to a row. A coverage bin
that serves no feature is measuring something nobody asked about. And now, crucially, a coverage number
**means** something. "Ninety-seven percent coverage" is a statistic. "All high-priority features are
closed; three medium-priority features have holes, listed here" is a claim.

This is where functional coverage stops being a number and becomes an argument.

## Choosing the method

The judgement in the plan is the method column, and this season has given you the rules for it.

**Control-heavy, data-light, full of corners** — arbiters, pointer logic, state machines, protocol rules —
formal, from episode eight. A proof beats a billion random cycles there, and the plan should say so.

**Datapaths and end-to-end behaviour** — transforms, packet processing, anything with a reference model —
constrained-random with a scoreboard, from episodes two and five, closed against coverage.

**Rare scenarios that random stimulus will not reach** — episode three's FIFO that never fills — directed
tests, or reweighted constraints, named explicitly.

**Protocol rules at every interface** — bound assertions, written once, from episode four.

And the two dangerous entries, which need the most scrutiny.

**Inherited.** Only honest if the reused block is used in the configuration in which it was verified.
Season 2 episode ten: every parameter multiplies the space. A FIFO verified at depth sixteen, reused at
depth five hundred and twelve with a different width, is not inherited. It is a new configuration.

**Verified at a higher level.** Sometimes correct — some behaviour genuinely only exists when blocks are
connected. And sometimes it is the most dangerous phrase in verification, because the block team assumes
the subsystem team will check it, and the subsystem team assumes the block team did. Every row marked
"higher level" must name the higher-level plan and the row in it that covers this. If it cannot, the
feature is verified nowhere.

## Out of scope

Season 3 episode twelve said the architecture document's non-goals were its most valuable paragraph.
The plan's mirror of that is its **out of scope** list: features, configurations and scenarios that are
deliberately not being verified, each with a reason.

"The optional low-power mode is not verified at block level, because it is not enabled in this product."
"Parameter combinations other than the three used in this chip are not verified." Each line is a decision,
made on purpose, visible to reviewers. An unlisted gap is an accident; a listed one is engineering.

## The stopping rule

And the section that gives this episode its title. **The plan says, in advance, when you are allowed to
stop.**

Coverage targets, per priority. All high-priority rows closed. Medium rows closed or explicitly waived.
Zero open bugs above some severity. The stable regression passing for some number of consecutive nights.
All formal proofs complete, or bounded to a depth that has been argued for.

Why in advance? Because the stopping rule written at the start is written by someone thinking about risk.
The stopping rule written at the end is written by someone who is tired, behind schedule, and being asked
every day whether they are done. That second person will always find a reason that the remaining holes
do not matter. The plan protects the project from that person — who is you, three months from now.

## Who writes it, and who reviews it

The verification engineer usually writes it. But it must be **reviewed by the designer and the architect**,
and each finds something different.

The architect finds features that are missing — requirements the verification engineer did not realise
were requirements.

The designer finds the scenarios they are privately worried about. Every designer knows two or three
corners of their block where they are not quite sure. Ask them directly: "where would you look for a bug
in your own design?" Their answer belongs in the plan, as high-priority rows, because they know things
about the implementation nobody else does.

And the plan is a **living document**. It is written before the testbench, changed when the specification
changes, and updated whenever a bug reveals a feature nobody had listed — step five from yesterday, feeding
back into the table.

## The cost

It costs time **before any testbench exists**, and that time looks like no progress. No tests, no coverage,
nothing running. Managers dislike it and engineers are impatient with it.

It costs the same kind of dullness as reading a specification line by line, because that is what it is.

And it pays back in three ways. It finds specification gaps at a desk instead of in a regression. It turns
coverage into an argument instead of a number. And it makes the final conversation — "are we done?" — a
check against a list rather than a negotiation.

## The one thing

The verification plan turns the specification into a list of claims — each with a method, a measurement
and a priority — traced in both directions, with an out-of-scope list and a stopping rule fixed before
anyone is tired enough to want to stop.

## Commute exercise

Your Season 3 lab block. On the way home, build its plan out loud — not all of it, just the first eight
rows. Pick eight features from its specification.

For each one, say the method and why. Which would you prove formally? Which need random stimulus and a
scoreboard? Which need a directed test because random will never get there? Is anything inherited — the
FIFO or the arbiter from Season 2 — and is it really being used in the configuration you verified?

Then the question worth the drive. Find the one feature you are most tempted to mark "verified at a higher
level". Now name the higher-level plan and the row in it that will verify it.

You probably cannot. Your lab block has no higher level. So what does that row actually say — honestly —
and what are you going to do about it?
