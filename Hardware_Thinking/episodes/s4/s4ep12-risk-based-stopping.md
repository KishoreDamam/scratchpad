---
season: 4
episode: 12
title: Risk-based stopping
runtime: about 13 minutes
prerequisites: all of season 4
one_thing: You never finish verifying; you decide to stop. Spend effort where likelihood times consequence is highest, and say in writing where the residual risk is — that statement is the deliverable.
---

> Production note: season finale. Recap the twelve one-things as a single run. End on
> the lab project and the one-page claim.

## Where we are

Yesterday's last row. The feature you wanted to mark "verified at a higher level", for a lab block that
has no higher level.

Honestly, that row says: **not verified.** That is all "higher level" means when no higher level exists.

And you have exactly two honest options. Verify it at block level — build enough of the missing
neighbour into your testbench, as a model or a responder, that the behaviour can be exercised and
checked. Or move it to the out-of-scope list, with a sentence explaining why it is acceptable to leave
it unverified.

What you may not do is leave "higher level" in the plan, because that phrase, unbacked, makes a gap look
like coverage. And in real projects that exact phrase, written in good faith by a block team and never
picked up by anyone else, is behind a remarkable number of silicon bugs.

Which brings us to the question the whole season has been walking towards. When are you allowed to stop?

## The problem

Here is the uncomfortable truth, and Season 1 episode nine already said it: **everything is unverified
somewhere.** The state space is larger than the universe. No amount of random stimulus, coverage or
formal closes it. There is always a combination nobody tried, a configuration nobody built, a sequence
nobody proved.

So verification never finishes. It stops. And someone has to decide when.

In practice, that decision is usually made by the schedule. Tape-out is on a date, the date arrives, and
whatever is verified by then is what is verified. The coverage holes that remain are the ones nobody got
to, and they are distributed not by risk but by accident — by whichever features happened to be
verified last, or were hardest to reach, or belonged to the engineer who went on holiday.

That is stopping by exhaustion. It is how most projects stop. And the bugs that escape are, by
construction, in whatever part of the design nobody decided to prioritise.

## The turn

The alternative is to decide **on purpose** where the effort goes, so that when the schedule forces a
stop, the gaps are in the places you chose.

And the rule for choosing is old, simple and correct: **risk is likelihood times consequence.** Spend
effort in proportion to it.

## Likelihood

What makes a bug likely in a particular feature? Experience gives a short list, and it is remarkably
consistent across projects.

**New logic** is riskier than reused logic — genuinely reused, in the configuration it was verified in.

**Complex control** is riskier than a datapath. State machines that interact, arbitration, flow control,
anything with many corner cases. Season 2 and Season 3 both pointed at these as the places bugs live.

**Logic that changed late** is riskier than logic that has been stable for months. Late changes are made
under pressure, reviewed less, and verified against a regression that was tuned for the old behaviour.

**Features the specification describes vaguely** are riskier than ones it pins down, for exactly the
reason episode ten showed you.

**And places where bugs have already been found.** This one is counterintuitive, and it is one of the
most reliable facts in the field: **bugs cluster.** A block where you found ten bugs is not a block with
ten fewer bugs. It is a block that probably has more, because whatever caused the first ten — a
misunderstanding, a rushed designer, an awkward specification — is still there. Bug density predicts bug
density.

## Consequence

What does it cost if a bug in this feature escapes to silicon?

Some bugs are **catastrophic**: data corruption that nobody notices, a hang with no recovery, anything
that bricks the chip, anything safety-related. Some are **expensive but survivable**: a performance
shortfall, a feature that must be disabled. And some can be **worked around**: software can avoid the
case, or a configuration register can switch the broken path off.

That last category is worth thinking about at design time, not just verification time. A feature with a
disable bit, or a fallback mode, has a lower consequence of failure — and that is a legitimate reason to
spend less verification effort on it. Designers who add escape hatches to risky features are buying down
risk in a way verification cannot.

## Putting them together

Now each row of episode eleven's plan gets a risk, and the risk decides the method and the depth.

**High likelihood, high consequence** — new, complex, central logic whose failure is catastrophic. This
gets everything. Formal on its control, constrained random with a scoreboard on its datapath, assertions
throughout, coverage closed to a hundred percent with every exclusion reviewed, and a design review by
someone who did not write it.

**Low likelihood, low consequence** — reused, simple, with a workaround. A smoke test and inherited
confidence may genuinely be enough.

**Everything else**, in between, in proportion.

And now, when the schedule forces a stop, the remaining holes are in the rows you ranked lowest. That is
the entire difference between stopping by exhaustion and stopping by decision. The amount of verification
might even be the same. Where it went is not.

## The signals

How do you know you are approaching the point where stopping is defensible? Several signals, and you
need all of them, because each on its own can lie.

**Coverage closed against the plan** — the high-priority rows at their targets, the rest closed or waived
in writing.

**The bug rate flattened under varied stimulus** — episode nine's warning. Flat because the design is
clean, not flat because the tests stopped looking anywhere new.

**All high-risk formal proofs complete**, or bounded to a depth someone has argued is sufficient.

**No open questions in the specification.** Every silent spot found by the plan has been answered in
writing.

**And every late change re-verified.** This is the one that bites. The one-line fix a week before
tape-out. It is almost always correct, and it is almost never re-verified as thoroughly as the original,
and it is where a disproportionate number of escapes come from. A late change resets the risk of
whatever it touched. Rerun the full regression, check coverage on that area has not regressed, and have
someone review the change who is not in a hurry.

## The statement

And then the deliverable. Not the tests. Not the coverage report. **A statement.**

One page. Three parts.

**What has been verified**, and by what method, to what measure — traceable to the plan.

**What has not been verified** — the out-of-scope list, the waived coverage, the bounded proofs, the
configurations not built.

**And why that is acceptable** — the risk argument for each gap. Low likelihood, low consequence, a
workaround exists, it is verified elsewhere and here is the row that does it.

That page is what Season 1 episode nine called the mark of a professional. It is the answer to "can we
tape out?" that someone can actually make a decision on. It is honest about the gaps, which is the only
thing that makes it believable about the rest. And it is what you hand another engineer along with your
block, so that they know what they are trusting and what they are not.

## Season 4 in twelve sentences

**One.** The testbench is software in simulated time: drive after the edge, sample before it.

**Two.** You are programming a solver; the default distribution spends your cycles in the boring middle.

**Three.** Code coverage cannot see a feature that was never built; functional coverage can.

**Four.** Pair every assertion with a cover on its trigger, or it may never have been asked.

**Five.** Compare meanings, not signals — and a scoreboard that saw nothing will pass.

**Six.** UVM exists so a component built once is reused unchanged, active below, passive above.

**Seven.** A test that ends at time zero and a test that never ends are both objection bugs.

**Eight.** A formal proof is exactly as honest as its assumptions; a reachable cover checks them.

**Nine.** A regression is a signal only if red always means something.

**Ten.** The failure is where the bug was noticed, not where it happened.

**Eleven.** The plan fixes the stopping rule before anyone is tired enough to want to stop.

**Twelve.** You never finish; you decide where to stop, and say so in writing.

## The lab project

Before Season 5, take the block you built at the end of Season 3 and verify it properly.

**Write the plan first.** Every feature from your architecture document, with a method, a measurement
and a priority. An out-of-scope list. A stopping rule, including a coverage number you commit to **before**
you run anything.

**Build the environment in the shape from episode six** — even in cocotb. A monitor per interface. Your
Season 3 functional model as the reference. A scoreboard with the right ordering rules and an end-of-test
check. Random stimulus with random backpressure, weighted towards the boundaries.

**Bind protocol assertions to every interface**, each with its cover.

**Prove one thing formally.** The FIFO or the arbiter from Season 2 is ideal — prove full and empty, or
prove fairness, with the covers that show the proof is not over-constrained. The free formal tools are
entirely adequate for this.

**Close coverage to the number you declared.** Not a number you pick at the end. The one you wrote down.

**Then write the one-page statement.** What was verified, what was not, and why that is acceptable.

That page is the checkpoint for this season. If you can hand someone your block and that page, and they
can decide how much to trust it without asking you anything, you have done what this season set out to
teach.

## Where Season 5 goes

You can now decide what to build, build it, and prove it works.

What you cannot yet do is say whether it will run at the speed you need. Season 1 episode three told you
timing exists. Season 5 is what front-end engineers actually do about it — synthesis, constraints, static
timing analysis, and the craft of closing timing — which, in any real project, is a very large part of the
job.

## The one thing

You never finish verifying; you decide to stop. Spend effort where likelihood times consequence is
highest, and say in writing where the residual risk is — because that statement, not the tests, is the
deliverable.

## Commute exercise

The last one of the season.

Take a block you know — your lab block, or something from work. On the way home, compose the one-page
statement out loud. Three parts: what was verified, what was not, why that is acceptable.

Be honest about the second part. It should not be short. If it is short, you have not thought hard
enough about what was left out.

Then read the third part back to yourself as if you were the person who has to decide whether to tape out,
spending a large sum of money on the answer. For each gap, ask: **would I accept this reason if someone
else gave it to me?**

The gaps where the answer is no are your real to-do list. Not the coverage holes — those are the symptoms.
The reasons you could not defend are the problem.

Thanks for the season.
