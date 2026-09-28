---
season: 4
episode: 7
title: UVM, part two
runtime: about 11 minutes
prerequisites: s1ep08, s4ep05, s4ep06
one_thing: Sequences say what to send, the driver says how, phases say when, and the configuration database says who gets what. The two classic UVM failures — a test that ends at time zero and a test that never ends — are both objection bugs.
---

> Production note: the objection section is the practical heart. The config-database
> misspelling should be told as a small story, not a rule.

## Where we are

Yesterday's integration. What survives? The input and output monitors, unchanged. The protocol
assertions bound to both interfaces. The coverage. The scoreboard and the reference model. What is
switched off? Both agents go passive: their drivers and sequencers disappear. What is thrown away?
The stimulus — the real upstream block now provides it — and the downstream responder, because the
real downstream block now applies the backpressure.

And the trap. If the reference model was fed by the input *driver* — "here is what I sent" — then at
subsystem level, with no driver, the model receives nothing. It predicts nothing. And, as episode
five warned, a scoreboard with no predictions and no end-of-test check passes silently, forever.

Worse, even at block level the shortcut was subtly wrong. The driver knows what it *tried* to send.
The monitor knows what actually *crossed the interface*. If the driver has a bug, or the design
refused a transfer the driver thought it made, those differ — and the model was fed the wrong
truth.

So, a rule worth keeping for life: **the monitor is the only source of truth about what happened on
a wire.** Nothing downstream of it should ever be fed by a driver.

Today: the three parts of UVM that confuse everyone. Sequences, phases, and configuration.

## The problem

Episode six gave you the structure — transaction, driver, monitor, agent, environment, test. It is a
clean structure, and people understand it on a whiteboard in twenty minutes.

Then they write their first UVM test and it passes in zero nanoseconds having checked nothing. Or it
runs forever and has to be killed. Or a setting they changed in the test has no effect at all, with no
error. And they spend a week on it, and conclude that UVM is incomprehensible.

It is not. Nearly all of that week comes from three mechanisms, and each one is simple once you see
what it is for.

## Sequences

A **sequence** is a piece of stimulus, written as an object. It generates a series of transactions —
"ten random packets", "a burst of maximum-length packets", "write every register then read it back"
— and hands them, one at a time, to a sequencer, which hands them to the driver.

Why separate it from the driver? Because the driver knows **how** to put a transaction on the wires,
and that knowledge is fixed per protocol. The sequence knows **what** to send, and that changes with
every test. Keeping them apart means a new test is a new sequence, with no change to the driver at
all.

And the handshake between them is worth recognising. The driver asks for the next item. It blocks
until the sequence provides one. It drives it on the wires. Then it reports "item done", and only
then does the sequence proceed to the next one.

That is valid and ready. Season 1 episode eight — backpressure as a way of thinking — between two
pieces of software. The driver is the consumer, applying backpressure to the sequence whenever the
interface is stalled, and the sequence waits exactly as an upstream block would. The idea you learned
about hardware turns out to be the organising idea of the testbench too.

Sequences compose. A sequence can start other sequences. And a **virtual sequence** runs on no
particular interface — it coordinates several sequences on several agents. "Configure the block over
the register bus, then start traffic on the data interface, then, midway, trigger a reset." That is
where real system scenarios live.

## Phases

Every UVM component goes through the same **phases**, in the same order, coordinated across the whole
testbench. Three groups matter.

**Build**, then **connect**. Build creates every component, from the top of the hierarchy downwards —
the test builds the environment, which builds the agents, which build their drivers and monitors. It
goes top-down so that each parent can configure its children *before* they are created. Then connect
wires up the analysis ports, now that everything exists.

**Run.** The only phase where simulated time passes. All components run in parallel: drivers drive,
monitors watch, sequences generate.

**Check and report**, after time stops. Here the scoreboard does episode five's end-of-test check —
are the prediction queues empty? — and everything reports.

That structure is simple. The confusing part is one question: **how does the run phase know when to
end?**

## Objections

The answer is **objections**, and they are the single biggest source of UVM pain.

The run phase continues as long as **somebody objects to it ending**. Any component can raise an
objection — "I am busy, do not stop" — and drop it later. When the last objection is dropped, the run
phase ends and the testbench moves on to checking.

Typically, the test raises an objection, starts its main sequence, waits for the sequence to finish,
then drops the objection.

Now the two classic failures, and both are the same bug.

**The test that ends at time zero.** Nobody raised an objection. The run phase started, saw no
objections, and immediately ended. The sequence never ran. No transactions happened. The scoreboard
received nothing. And — if the end-of-test check is missing — it passed. Zero nanoseconds, zero
transactions, clean log. This is the single most common first-week UVM bug in the world.

**The test that never ends.** Somebody raised an objection and never dropped it — a sequence waiting
for a response the design never sends, a component that raised in a loop and dropped once. The
simulation runs until somebody kills it or a global timeout fires.

And one subtlety: when the sequence finishes, the last transactions may still be *inside the design*,
not yet out the other side. Drop the objection immediately and the test ends before they emerge — and
the end-of-test check reports them as lost. The fix is a short **drain time**, or better, having the
scoreboard itself hold an objection while it still has predictions outstanding. Then the test ends
exactly when every expected transaction has been accounted for. That is the correct design, and it
turns episode five's end-of-test check into an end-of-test *condition*.

## Configuration

The last mechanism. Components need settings — is this agent active or passive, what is the data
width, which virtual interface does this driver talk to. They cannot take constructor arguments in the
normal way, because the factory creates them. So UVM has a **configuration database**.

A parent puts a value into the database with a path saying who it is for — "for the agent at this
place in the hierarchy, the setting called is-active is passive". The child, during its build phase,
asks the database for its setting by name.

Here is the story that happens to everyone.

You set the output agent to passive in the test. You run. The output agent is still active, still
driving, fighting the real downstream block. No error, no warning. You check the code ten times. It
looks right.

Then you notice that the path in the test says "env dot out underscore agent" and the environment
actually named it "env dot output underscore agent". The path matched nothing. The value sat in the
database, addressed to a component that does not exist. The agent asked for its setting, found none,
and quietly used its default.

The configuration database is **matched by strings**, and a string that matches nothing is not an
error. That is its fundamental weakness. The defence is equally mechanical: **whenever a component
gets a setting it cannot work without, check whether the get succeeded, and stop the simulation with a
fatal error if it did not.** One line per setting. It converts a silent week into an immediate,
named failure.

## The cost

These three mechanisms are where UVM's reputation comes from, and it is deserved. They are powerful,
they are indirect, and indirect things fail far from their cause.

The defences are all the same shape: make silent failures loud. Check every configuration get. Have
the scoreboard object until it is empty. Report the number of transactions compared. Fail any test
that checked zero. Put a global timeout on every simulation, so "never ends" becomes "failed after
this long" in a nightly run instead of a job that sits for a weekend.

With those in place, UVM becomes what it was meant to be: a boring, dependable structure. Without
them, it is a machine for producing green results that mean nothing.

## The one thing

Sequences say what to send, the driver says how, phases say when, and the configuration database says
who gets what. The two classic failures — a test that ends at time zero and a test that never ends —
are both objection bugs, and every indirect mechanism needs a check that makes its silent failure loud.

## Commute exercise

A colleague's new test passes in zero nanoseconds. The log shows no errors. They are pleased.

On the way home, list every cause you can think of, in the order you would check them. At least four.

Some are from today: an objection that was never raised; a sequence started in a background thread,
with the objection dropped straight away instead of after the sequence finished; a test that runs the
wrong sequence because a factory override or a configuration setting matched nothing.

Then the question worth the drive. Every one of those causes is a different bug in a different
component. But they all produced the same symptom — a pass. **What single check, anywhere in the
testbench, would have turned every one of them into a failure?** You have heard it twice this season
already.
