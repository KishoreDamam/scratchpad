---
season: 5
episode: 11
title: Reading a timing report
runtime: about 11 minutes
prerequisites: s5ep04, s5ep06, s5ep07
one_thing: A timing report is episode four's sum written out term by term. Read the header, then the clocks, then the one or two lines that are out of proportion — the disease is almost always visible in fewer than five lines.
---

> Production note: this episode is a read-aloud. Pace the report lines slowly, with
> a small pause after each. The listener should be able to follow the running total
> in their head.

## Where we are

Yesterday's terms.

The **arrival** time starts at the launching clock edge. Add the clock's latency to the launching
register. Add the register's clock-to-output delay. Add every cell delay along the path. Add every
wire delay between them. If the path starts at an input port, the input delay stands in for everything
before the port.

The **required** time starts at the capturing clock edge, one period later. Add the clock's latency to
the capturing register. Subtract the register's setup time. Subtract the clock uncertainty. Add back
the common-path credit, if the two clock paths share part of the tree. If the path ends at an output
port, subtract the output delay.

Slack is required minus arrival. About nine terms, depending on how you count.

And the diagnostic table you built. **One huge cell delay**: a weak cell driving a big load, or a slow
input transition. **Many modest cell delays**: too many levels of logic. **Large wire delays**: distance
or congestion. **Launch latency much larger than capture latency**: skew working against you. **A large
uncertainty**: a margin that may be too cautious, or a real clock problem. **An input or output delay
consuming most of the period**: a budget problem, and episode ten.

Now we use it.

## The problem

The first time anyone opens a timing report, it is overwhelming. Hundreds of lines per path. Cell names
from a library you have never read. Columns of numbers with no obvious meaning. Thousands of paths.

So people read the top line — the slack — and then stop, and go back to guessing what to change.

But a timing report is not complicated. It is episode four's arithmetic, written out one term per line,
with a running total. Once you have read one out loud, slowly, every other report is the same shape.
The skill is purely familiarity. And the only way to get familiar is to read them until they are boring.

So let us read one. I will describe it the way you would see it, spoken, with round numbers.

## The header

Every path report opens with a few lines that tell you what you are looking at. Read them first, every
time, because half of all misdiagnoses come from not noticing what the header said.

**Startpoint**: a register in the packet parser, clocked by the rising edge of the core clock.

**Endpoint**: a register in the checksum unit, clocked by the rising edge of the core clock.

So: a register-to-register path, same clock, same edge. Good — no exceptions, no ports, no crossings.

**Path group**: core clock. **Path type**: max. Max means the longest delays — this is a **setup** check.
If it said min, it would be hold, and everything we read would mean the opposite.

**Corner**: the slow corner. As it should be, for setup.

The clock period is two nanoseconds — five hundred megahertz.

## The data path

Now the lines, top to bottom, each with the delay it adds and the running total. I will give both.

**Clock core, rising edge.** Adds zero. Total: zero. This is the launching edge.

**Clock network delay.** Adds zero point four five. Total: zero point four five. That is the clock's
latency to the launching register.

**The launching register, clock to output.** Adds zero point one two. Total: zero point five seven.

**A buffer.** Fanout one. Adds zero point zero four. Total: zero point six one. Unremarkable.

**A two-input AND gate.** Fanout one. Adds zero point zero five. Total: zero point six six.

**A buffer.** Fanout sixty-four. Output transition zero point three one. Adds zero point two eight.
Total: zero point nine four.

Stop there for a moment. Every cell so far added four or five hundredths. This one added nearly three
tenths — six times the others. It drives sixty-four loads, and its output transition is three tenths of
a nanosecond, which is slow. Remember episode two: a lazy transition also makes the *next* cell slower.
That is the first suspect. Note it, and keep reading.

**A two-to-one multiplexer.** Adds zero point zero nine. Total: one point zero three. Higher than normal
for a multiplexer — because its input arrived with that lazy transition.

**Then twelve lines of adder cells.** Each adds three or four hundredths. Together, zero point four four.
Total: one point four seven.

A long, regular run of the same small cells, each adding a little. That is a **carry chain** — Season 2
episode five. Many modest delays: the signature of depth. Second suspect.

**A four-to-one multiplexer.** Adds zero point one one. Total: one point five eight.

**A wire.** Adds zero point zero six. Total: one point six four. A little long, not dramatic.

**Two more gates.** Together zero point one one. Total: one point seven five.

**The wire into the capturing register's data pin.** Adds zero point zero three. Total: one point seven
eight.

**Data arrival time: one point seven eight.**

## The required time

Now the capture side.

**Clock core, rising edge.** Two point zero zero. One period after launch.

**Clock network delay.** Zero point four one. Total: two point four one.

Compare that with the launching side: zero point four five. The capturing clock arrives **four hundredths
earlier** than the launching one. That is skew working against setup — yesterday's diagnostic table. Small,
but it is being subtracted from us. Third suspect, minor.

**Common path pessimism removal.** Adds zero point zero two. Total: two point four three. The two clock
paths share the top of the tree, and the tool is handing back the double-counting from episode four.

**Clock uncertainty.** Minus zero point one. Total: two point three three.

**Library setup time.** Minus zero point zero five. Total: two point two eight.

**Data required time: two point two eight.**

## The slack

Required, two point two eight. Arrival, one point seven eight. **Slack: plus zero point five.**

It passes, with half a nanosecond to spare.

I did that deliberately, because the first lesson of reading reports is to read them when they pass. This
path is fine. Now imagine the same design at seven hundred megahertz — a period of about one point four
three nanoseconds. Every capture-side term shifts down by the difference, about zero point five seven. The
required time becomes about one point seven one. Arrival is still one point seven eight. **Slack: about
minus zero point zero seven.**

Same path, same cells. Now it fails by seventy picoseconds, and we know exactly where to look.

## The diagnosis

Three suspects, in order of size.

**The carry chain**: forty-four hundredths. The biggest single contributor, but spread over twelve cells. It
is the adder's structure. Can the adder be a faster architecture? Can the comparison it feeds be precomputed
— episode seven? Is the full width needed?

**The high-fanout buffer**: twenty-eight hundredths, plus its lazy transition slowing the next multiplexer by
perhaps five hundredths. Episode seven's duplication: if the register feeding it were copied four times, each
copy would drive sixteen loads, and this might fall to a tenth. That alone saves around twenty picoseconds.

**The skew**: four hundredths against us. Probably not yours to fix directly, but worth noting to the
back-end team — and after the real clock tree, it may change sign.

Seventy picoseconds is needed. Duplication alone gets nearly a third of the way. Restructuring the carry
chain could get all of it. And none of this needed guessing: it was five lines out of about twenty-five.

## Reading many paths

One path is a diagnosis. A design has thousands. Three habits turn a mountain of reports into a picture.

**Look at the worst path per endpoint, not every path.** Many paths share an endpoint, and fixing the worst
usually fixes the rest.

**Group by start and end module.** If three hundred failing paths all run from the parser to the checksum
unit, that is one problem at one interface — perhaps a budget, perhaps a missing register — not three hundred.
Season 4 episode nine's bucketing, applied to timing.

**Look at the distribution.** A histogram of slack across all endpoints. A narrow cluster just below zero is a
design close to closing. A long tail far below zero is a small number of structurally broken paths. A huge mass
below zero is an architecture problem — episode eight.

## The cost

There is no shortcut. Nobody reads timing reports fluently without having read a great many of them. The first
ten are slow and confusing. By the fiftieth, you will glance at a path and see the one line that is out of
proportion before you have consciously read the rest.

So do it deliberately. On your lab project, read ten full path reports, out loud, top to bottom — passing paths as
well as failing ones. It is dull. It is also the single fastest way to acquire a skill that separates engineers who
close timing from engineers who wait for somebody else to.

## The one thing

A timing report is episode four's sum written out term by term. Read the header first, then compare the launch and
capture clocks, then find the one or two lines that are out of proportion — the disease is almost always visible in
fewer than five lines.

## Commute exercise

Tomorrow, your block leaves your hands. It goes to the back-end team, who will place it, build its clock tree, route
it and close it physically.

On the way home, make the list of everything you must hand over. Start with the obvious — the netlist. Then keep
going. What do they need to know about your clocks? Your exceptions? Your interfaces? Your worries?

You should get to at least eight items.

Then the question worth the drive. Imagine you are the back-end engineer, receiving a block from a front-end engineer
you have never met. **What is the first thing you would complain about?** And what does that tell you about what a good
handoff actually contains, beyond the files?
