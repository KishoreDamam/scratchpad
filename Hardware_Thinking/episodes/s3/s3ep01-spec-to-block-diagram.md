---
season: 3
episode: 1
title: Spec to block diagram
runtime: about 13 minutes
prerequisites: s1ep04, s1ep06, s1ep11
one_thing: Cut the design where the rate changes or the working set changes. Those two questions generate your module boundaries; nothing else does.
---

> Production note: the five steps should be stated as a list the listener can count
> on their fingers. Repeat the two cut criteria at the end verbatim.

## Where we are

Welcome to Season 3.

First, the debt from the end of Season 2. I gave you a review with four findings —
a wrong increment, a private handshake instead of the house protocol, a
combinational block with no defaults, and a clock crossing built from one register
instead of a synchroniser — and asked which cost an hour, which cost a day, and
which cost three modules and a schedule conversation.

The wrong increment is the hour. It is one line, and it is wrong in a way
simulation will confirm immediately.

The missing defaults and the broken crossing are the days, and the reason is worth
having: **neither is really one defect.** If one combinational block has no
defaults, the habit is absent, so every combinational block in that file needs
checking and the verification needs re-running. If one crossing was built from a
single register, every other crossing in that block is now suspect. Both findings
are categories wearing the costume of instances — which is exactly why Season 2
episode twelve said the best review comment eliminates a category.

And the private handshake is the expensive one. Three modules, a conversation, a
schedule.

Which is why you raise it **first, today, before anything else** — because it is the
only finding whose cost is still growing. Every day it stands, somebody builds
another module against the wrong contract. The hour-long fix will cost an hour next
month too. That one will not.

That is Season 3's whole subject, actually. The decisions that get more expensive
the longer you leave them. Season 2 was about writing RTL well. This season is
about deciding what RTL to write, which happens before any of it exists and
determines whether the project works.

## The problem

Here is the situation, and it is genuinely uncomfortable.

You have a specification. Perhaps ten pages. It says what the thing must do,
probably in prose, probably with some numbers, probably with gaps.

And you have a blank file.

There is no mechanical route from one to the other. Nobody teaches this step.
Courses teach you how to build a FIFO and how to close timing; the step where prose
becomes a structure of modules is left to be absorbed by osmosis from senior
engineers, which is why it takes most people years and why some people never get
good at it.

So what happens instead is one of two failure modes.

**Paralysis.** You stare at it. Every decision depends on every other decision, so
there is no obvious first move, and you spend three days reading the specification
again.

**Or accretion**, which is worse because it feels like progress. You start writing
the part you understand. Then you need something else, so you add a module. Then
two modules need to talk, so you add signals between them. Six weeks later you have
a working design whose structure is a fossil record of the order in which you
happened to understand the problem. Nobody can review it, the boundaries are in
arbitrary places, and the timing is bad for reasons that are structural and
therefore unfixable without starting again.

What you want is a *method*. Not inspiration — a procedure you can follow on a bad
day that produces a defensible first structure.

## The turn

Here is the method. Five steps, in order. It is not the only one, but it is
repeatable, and it has the property that each step's output is the next step's
input.

**Step one: draw the data flow, with rates.**

Not modules. Not logic. Just: what comes in, what goes out, and how fast. One line
per interface, with a number on it. Pixels in at a hundred and fifty megabytes per
second. Packets out at two hundred thousand per second. Configuration writes in,
rarely.

This is Season 1 episode eleven — compute the budgets first — and it is step one
because it is the only step you can do with no design decisions at all. It is pure
reading of the specification, and if you cannot do it, you have found a gap in the
specification and that is the most valuable thing you will discover today.

**Step two: write the transformations as a chain.**

What has to happen to the data between the input and the output? List the
operations in order. Receive and validate. Convert the format. Filter it. Scale it.
Packetise it. Transmit it.

Prose, one line each, no structure yet. You are building a chain of verbs.

Most specifications yield six to fifteen of these, and the ordering is usually
forced by the problem. This step is easy and people skip it because it feels too
simple to write down. Write it down. It is the skeleton everything else hangs on.

**Step three: for each transformation, ask what it needs to see.**

This is the step that does the real work.

For each verb in your chain, ask: to produce one unit of output, what does this
operation need to have in front of it? One sample? Three adjacent samples? A whole
line? Two whole frames? A packet's worth, with the header at the front and the
checksum at the end?

That is the operation's **working set**, and Season 1 episode six already told you
what it decides: which memory tier it lives in, and therefore whether the operation
is possible at all on your part. A verb needing a whole frame is a completely
different creature from a verb needing three samples, and until you have written the
working set next to each verb, you do not know which of your operations are cheap
and which are architecture-defining.

**Step four: cut the chain where the rate changes or the working set changes.**

This is the generative rule. If you remember one thing from this episode, this is
it.

Walk along your chain of verbs and look at the numbers you have written next to
each. Wherever the *data rate* changes — a decimation, a packetisation, a
compression, a stage that consumes two items to produce one — there is a boundary.
Wherever the *working set* changes — a stage that needed three samples handing over
to a stage that needs a whole line — there is a boundary.

Everything between two such points is one module.

Why does that rule work? Because a rate change is exactly where you need buffering
and flow control, so a boundary there is a boundary you were going to have to build
anyway. And a working-set change is where the storage structure changes, so it is
where the internal design of one module would otherwise have to be two designs
wearing one name. Cutting at those points produces modules that are internally
uniform — one rate, one working set, one kind of storage — and internally uniform
modules are the ones that are easy to write, easy to verify, and easy to time.

Cut anywhere else and you get a module with two personalities, which is the single
most common structural defect in real designs.

**Step five: for each module, separate control from datapath, and name the
interfaces.**

Season 1 episode four. For each module you just cut out, the datapath is the verbs
and the storage. The controller is the thing that says when. Write down, for each
module, what its state machine's states are — even roughly. If a module needs a
state machine with thirty states, that is a signal you cut in the wrong place.

Then put the house interface on every boundary. Valid and ready, or whatever your
organisation uses. Name every signal so you can tell which module and which clock
domain it belongs to.

And now you have a block diagram. Modules, interfaces, rates, working sets,
controllers. On one page.

## Then critique it

The method gives you a first structure, and the first structure is never the one you
build. But now you have something to attack, and there are four good attacks.

**Where is the widest arithmetic, and is it inside a feedback loop?** Season 2
episode five. If yes, you have found your clock limit before writing any code.

**Which module holds the most state, and does it fit?** Season 1 episode six. Do
the arithmetic now. If it does not fit, the structure is already dead and you have
lost twenty minutes instead of two months.

**Which interfaces carry the most bandwidth?** Those are the ones whose width and
protocol you should think hardest about, and the ones you should be most reluctant
to cross a clock domain or a physical distance with.

**Is there any module I cannot describe in one sentence?** If so, it is two modules.
This is the same test as Season 2 episode ten's test for over-parameterisation, and
it is just as reliable.

## The cost

Two costs, both real.

**The method produces a structure you will not like.** It is mechanical, so it
produces something serviceable rather than elegant. Experienced designers often see
a better decomposition immediately and resent being walked through steps.

Fine — but write down the mechanical one anyway, because the value is not the
structure, it is having something explicit to argue against. An intuition you cannot
compare to anything is not reviewable, including by yourself.

**It front-loads decisions you would rather defer.** Step one requires rates you may
not have. Step three requires working sets that depend on algorithms not yet chosen.
You will be forced to write down assumptions, and some will be wrong.

That is the point. An assumption written on the block diagram is a thing somebody can
challenge in a review. The same assumption held silently becomes a module boundary,
and a module boundary is what Season 2 episode twelve taught you costs three modules
and a schedule conversation to move.

## The one thing

Data flow with rates, then verbs, then working sets, then cut where the rate or the
working set changes, then split control from datapath. The two cut criteria are the
whole method.

## Commute exercise

A specification, roughly: audio arrives as a stereo stream, forty-eight thousand
samples per second per channel, twenty-four bits per sample. You must apply a
ten-band equaliser to each channel, mix the two channels down to mono, compress the
dynamic range using a loudness measurement taken over the last two hundred
milliseconds, and output the result as packets of two hundred and fifty-six samples
over a standard interface.

On the way home, run the method out loud.

Rates first. Then the verbs. Then — and this is where it gets interesting — the
working set of each verb. Notice that most of them need one sample, one needs a
handful, one needs two hundred milliseconds of history, and one needs two hundred
and fifty-six samples.

Then cut. You should find three or four modules, and the boundaries should feel
forced rather than chosen.

And then the real question: two hundred milliseconds of audio at forty-eight
kilohertz is a lot of samples. Work out how many, and how many bytes. Then ask
whether you actually need to *store* them — or whether the loudness measurement can
be computed with far less state than the naive reading of the specification implies.

That last question is worth the whole drive. It is the difference between an
architecture that fits and one that does not, and it is decided by a property of the
mathematics rather than anything about hardware.
