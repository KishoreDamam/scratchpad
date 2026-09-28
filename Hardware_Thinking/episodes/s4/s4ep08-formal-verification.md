---
season: 4
episode: 8
title: Formal verification
runtime: about 12 minutes
prerequisites: s2ep09, s2ep10, s4ep04
one_thing: Formal proves a property for every input the assumptions allow — so it is exactly as honest as its assumptions, and a reachable cover is how you check them.
---

> Production note: the "over-constrained proof" section is the one to slow down for.
> The shift from "what did the tool find" to "what did I allow" is the lesson.

## Where we are

Yesterday's zero-nanosecond pass, and the single check that catches every cause.

The objection never raised. The sequence in a background thread with the objection dropped at once.
The override that matched nothing, so the wrong stimulus ran. All different bugs, all the same
symptom: a pass, because nothing was compared and nothing complained.

And one check catches them all: **fail any test that compared zero transactions** — or more
generally, fail any test whose end-of-test count is below what the test expected. Episode five said
it. Episode seven said it again. It is the verification equivalent of Season 1's "my tests pass is a
statement about the tests". A pass with nothing checked is not a pass.

Now notice what all seven episodes so far have had in common. Every instrument — random stimulus,
coverage, assertions, scoreboards, UVM — is still **sampling**. You try a very large number of cases
and measure which ones you tried. Episode three's FIFO showed that sampling can miss an entire
region for ever, and coverage only tells you it was missed.

Today is the other approach. Not trying cases. Proving there is no failing case at all.

## The problem

Season 1 episode nine: a block with a hundred and sixty-four bits of input and state has more
situations than atoms in the universe. Simulation will never explore them. That was the argument
for random stimulus and coverage — explore cleverly, measure honestly, accept the gap.

But some bugs live in that gap permanently. The deadlock that needs four requesters to arrive in a
specific order, on specific cycles, while a counter is at a specific value. Random stimulus can run
for years without producing that combination, and coverage can only tell you that the bin was never
hit, not that the bug exists.

What you want, for some properties, is not "we tried a billion cases". It is "there is no case".

## The turn

**Formal verification** — specifically, **model checking** — does not simulate. It takes your RTL
and a property, and mathematically explores every state the design can reach, from reset, under
every possible input sequence, asking whether any of them violates the property.

And it gives one of three answers.

**Proven.** No reachable state, under any input sequence, violates the property. Not "we did not
find one" — there is none. That is a categorically different claim from anything simulation can
make.

**A counterexample.** A trace — a specific sequence of inputs from reset — that violates the
property. And here is something people do not expect: the counterexample is usually **short**.
The tool finds the *shortest* path to failure, so instead of a failure forty thousand cycles into a
random test, surrounded by noise, you get the same bug in eleven cycles, with nothing irrelevant in
it. It is the best debugging artefact in the field.

**Inconclusive.** The tool ran out of time or memory. Usually it will tell you a **bounded** result:
no violation exists within the first thirty cycles from reset, say. That is weaker than a proof, and
worth knowing exactly how much weaker — which depends on whether anything interesting in your design
takes longer than thirty cycles to happen.

## The language is one you already know

The properties are episode four's assertions. The same language, the same implications, the same
sequences. And episode four promised the three uses would matter here. They do.

**Assert** — this must hold. The tool tries to break it.

**Assume** — the environment will do this. The tool only considers input sequences that obey it.
"Once valid is raised, the upstream holds it until ready." Without that assumption, the tool will
happily show you a failure where the upstream violates the protocol, which is true and useless.

**Cover** — show me that this can happen. The tool searches for a trace that reaches it.

And here is an elegant thing about assumptions: an assumption about a block's input is exactly an
assertion about its neighbour's output. You assume the upstream obeys the protocol when proving this
block; you assert the upstream obeys it when proving the upstream. That is **assume-guarantee**, and
it is how formal scales to more than one block — each proven against a contract, and the contracts
proven to match.

## The narrow band where it is devastating

Formal is not a replacement for simulation. It is overwhelmingly good at a particular kind of logic,
and poor at the rest.

It is devastating on **control**. Arbiters — Season 2 episode nine's fairness, proven rather than
measured. FIFO pointer logic — Season 2 episode eight's full and empty, proven for every sequence of
pushes and pops, including the ones random stimulus never reaches. State machines — proving that no illegal
state is reachable, and that no state is a trap the machine can never leave. Protocol compliance at
interfaces. Handshakes. Cache controllers, where Season 3 episode eight said the real cost of coherence
was the state space — formal is the instrument built for state spaces.

It is poor on **wide arithmetic** and **deep time**. A thirty-two bit multiplier is a mathematically
brutal thing for a model checker; simulation or a specialised equivalence tool handles it far better.
And anything that takes thousands of cycles to reach — a large counter wrapping, a long pipeline
filling, a timeout — makes the reachable state space explode, and the tool gives up.

So the judgement is: **control-heavy, data-light, and full of corner cases** means formal. Wide
datapaths and long sequences mean simulation. Most real blocks have both, and the right plan uses
each where it wins.

## Making it fit

When a proof will not finish, three techniques do most of the work.

**Shrink the parameters.** Season 2 episode ten's parameterisation pays off here. A FIFO with a
parameter for depth can be proven at depth four, and the pointer logic is the same logic as at depth
five hundred and twelve. If the design is truly parameterised — the same structure at every size —
the small proof is strong evidence about the large one.

**Cut the datapath.** If a property is about control, the actual values of the data do not matter.
Tell the tool to treat the data as arbitrary, and the state space collapses.

**Track one item.** To prove that a FIFO delivers every item in order and uncorrupted, you do not need
to reason about every item. Pick one arbitrary item — the tool chooses which, and when it enters — and
prove that it comes out, unchanged, after exactly the items that entered before it. Because the tool
considers *every* choice of item, proving it for one arbitrary item proves it for all of them. It is a
beautiful trick, and it turns a hopeless proof into a fast one.

## The trap

Now the thing that makes formal dangerous, and it is the mirror of episode four's vacuity.

A proof holds for every input the **assumptions allow**. So what if the assumptions allow almost
nothing?

Suppose, to get a stubborn arbiter proof to finish, somebody adds an assumption: at most one requester
asks at a time. The proof completes instantly. Proven. Green.

And it has proven nothing about arbitration. With one requester at a time, there is never a conflict
to arbitrate. The fairness property holds trivially, because no one ever waits. The assumption quietly
removed the entire problem.

That is an **over-constrained** proof, and it is worse than a failing one, because it looks like
success. And unlike a simulation, there is no waveform to glance at and notice that nothing
interesting happened.

The defence is the same as episode four's, and it is not optional. **Write covers for the scenarios
that matter, and require the tool to reach them.** Cover: all four requesters asking at once. Cover:
the FIFO full while a push arrives. Cover: the state machine reaching every state. If a cover is
**unreachable**, your assumptions have made that scenario impossible, and every proof in that
environment is suspect until you find out why.

A proof tells you what the tool found. A reachable cover tells you what you allowed it to look at. You
need both before a proof means anything.

## The cost

**Expertise.** Writing properties that are correct, assumptions that are neither too loose nor too
tight, and abstractions that let proofs converge — that is a specialised skill, and it takes time to
build.

**Inconclusive results.** Some proofs never finish, and a bounded result has to be argued about: is
thirty cycles deep enough for this design? Sometimes the honest answer is "we don't know", and that
has to go into episode eleven's plan as a stated gap.

**And one kind of formal you will use without choosing to.** **Equivalence checking** proves that two
versions of a design are functionally identical — the RTL and the synthesised netlist, for example. It
runs in every serious flow, mostly automatically, and it is why you rarely hear about synthesis bugs.
It is formal's quiet success, and Season 5 will lean on it.

## The one thing

Formal proves a property for every input the assumptions allow — so it is exactly as honest as its
assumptions. Use it on control, not wide arithmetic; shrink, cut, and track one item to make it fit;
and never trust a proof until the covers you care about are reachable.

## Commute exercise

A round-robin arbiter with four requesters. You are going to prove it formally.

On the way home, write three properties in words.

One: the grant is either one-hot or all zero. Two: nobody is granted who is not requesting. Three:
fairness — a requester that is waiting will be granted before any other requester is granted twice.

Then the assumption. For the fairness property to make sense, you need to assume something about how
requesters behave. What? Think about what "waiting" means if a requester can drop its request and raise
it again whenever it likes.

Then the question worth the drive. Your proofs all pass. What covers would you write to convince a
sceptical reviewer that the proofs are not over-constrained? Name at least three scenarios that must be
reachable — and for each, say which bug it would expose if your assumptions had quietly made it
impossible.
