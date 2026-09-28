---
season: 5
episode: 9
title: Physical awareness in RTL
runtime: about 12 minutes
prerequisites: s3ep06, s3ep10, s5ep08
one_thing: Wires are now slower than gates, and your RTL decides where the wires go. Distance and congestion are set by architecture and module structure months before layout sees them — so think about where things will sit while you still can move them for free.
---

> Production note: the "gates got faster, wires did not" history should be brief
> and plain. The congestion section is the part front-end engineers have never
> been told; give it room.

## Where we are

Yesterday's bus across the chip.

Five millimetres at roughly a hundred and fifty picoseconds per millimetre is seven hundred and
fifty picoseconds — and that figure was an assumption for the exercise, not a law; real numbers vary
a great deal with the process and the metal layer. Of a one-nanosecond cycle, that leaves two hundred
and fifty picoseconds for the launching register's clock-to-output time, the capturing register's
setup time, and the clock uncertainty. On a real design, that is not enough to be safe, and it leaves
nothing for any logic at all.

So: at least two cycles, with a register near the middle of the route, and on a cautious project,
three. Five hundred and twelve bits of pipeline registers dropped along a wire is not elegant, and it
is completely normal.

And who should have known? The architect, from the floorplan, before any RTL existed. It belongs in
the architecture document's latency section — Season 3 episode twelve — and in the interface between
those two blocks, with the extra cycles already in the protocol. Discovered after layout, it is
yesterday's episode: a latency change, rippling through protocols, buffers and credits, at the most
expensive moment in the project.

Today: why distance became your problem.

## The problem

For most of the history of chip design, front-end engineers could think of wires as free. The delay
lived in the gates; the wires just connected them. You wrote RTL, synthesis counted logic levels, and
the logic levels predicted the timing well enough.

Then the processes shrank, and something asymmetric happened. **Gates got faster.** Smaller transistors
switch sooner. But **wires did not.** A thinner wire has more resistance per millimetre, and wires
packed closer together have more capacitance to their neighbours. Shrinking made gates quicker and made
wires, per unit length, relatively slower.

So on a modern process, for any path that travels a meaningful distance, **the wire can dominate.** A
path with three levels of logic spread across two millimetres can be slower than a path with fifteen
levels packed into a small corner.

And synthesis, which counts logic, does not know where anything will be placed. The delay it estimates
for a wire before layout is a guess — traditionally from a statistical table of typical wire lengths
for a given fanout. The guess is often badly wrong for exactly the paths that matter: the long ones.

## The turn

Here is the idea that changes how you write RTL: **your RTL decides where the wires go.**

Not literally — the placement tool chooses coordinates. But the placer can only put cells close together
if the design lets it. If a register must talk to logic in four corners of a block, no placement puts it
near all four. If a module has one output that drives two thousand inputs, those two thousand inputs are
spread out, and the wires reach them. If the architecture puts a central controller in charge of eight
distant units, the controller's signals travel to eight distant places, every cycle.

The physics is decided by the **connectivity**, and the connectivity is decided by you — in the
architecture of Season 3 and in the module structure of Season 2 — months before a layout engineer sees it.

## Distance

A few facts about long wires, enough to reason with.

An **unbuffered** wire's delay grows with the **square** of its length, because both its resistance and its
capacitance grow with length and the delay depends on their product. Double the length, four times the delay.
So long wires are broken up with **repeaters** — buffers every so often — which make delay grow roughly in
proportion to length instead. The back-end flow inserts these automatically.

But repeaters only make it linear. They do not make it fast. A long route still has a delay you can estimate
from its length, and on a fast clock, a few millimetres can be a whole cycle.

The front-end response is the one from this morning's exercise: **register along the way.** If two blocks will
sit far apart, the interface between them should have registers at both ends — episode seven's registered
outputs, and registered inputs too — and possibly in the middle. Valid-and-ready makes those extra stages
harmless. A fixed-latency protocol makes them a negotiation.

## Congestion

Now the physical effect front-end engineers are almost never told about, and it causes a startling amount of
trouble.

A chip has a limited number of routing tracks per square millimetre, on a limited number of metal layers. Most
of the time that is plenty. But certain structures concentrate an enormous number of wires into one small
area, and when demand for tracks exceeds supply, the router must detour. Wires take long roundabout paths.
Timing gets worse. Sometimes the region has to be spread out, leaving cells far apart with empty space between
them, just to make room for wires. Sometimes it simply does not route.

That is **congestion**, and a few structures cause most of it.

**Wide multiplexers.** An eight-to-one multiplexer of a five-hundred-and-twelve-bit bus brings four thousand and
ninety-six wires into one place. Every one of those wires starts somewhere else.

**Crossbars.** Season 3 episode six said crossbars cost area growing with the square of the port count. They
cost wiring even faster, and the wiring is concentrated in the middle. That is often the real reason a crossbar
stops scaling — not the gate count, the routing.

**Big central structures that everything talks to.** A register file read from many places. A shared lookup
table. A central scoreboard of state.

**And very high fanout nets**, which fan out through buffer trees into every corner of a region.

## What front-end can do

You cannot see congestion in simulation or in synthesis logic counts. But you can avoid creating it, and the
techniques are architectural.

**Mux near the sources, not at the destination.** If eight sources, spread around a block, must be selected
onto one destination, a single eight-to-one multiplexer at the destination pulls eight wide buses into one spot.
A tree of smaller multiplexers placed near pairs of sources narrows the traffic as it travels. Same function,
very different wiring.

**Narrow wide buses.** Does it need to be five hundred and twelve bits every cycle? Season 3 episode two's
cycle accounting: if the throughput allows, a narrower bus for more cycles moves the same data with a fraction
of the wires.

**Distribute rather than centralise.** Replace one controller talking to eight distant units with eight local
controllers exchanging a small amount of coordination. The wires that must travel become few; the wires that
are many become local.

**Keep the hierarchy physical.** Season 3 episode ten said a module boundary is a physical boundary as well as a
timing, verification and ownership one. Modules that talk a lot should be adjacent, and modules that are
adjacent should be modules that talk a lot. A hierarchy designed only for logical elegance can force a floorplan
where the heaviest traffic crosses the whole die.

**And get a floorplan early.** Even a rough one — boxes on a page, sized from estimated area, arranged by who
talks to whom — tells you which interfaces are long before any RTL is final. Modern synthesis tools can use that
floorplan to estimate wire delays from real distances rather than statistical guesses, and the estimates improve
enormously. Asking for this early is one of the most valuable conversations a front-end engineer can have with
the back-end team.

## On an FPGA

On an FPGA, everything today is more pronounced, not less. Routing passes through programmable switches, so wire
delay is a large share of every path. And some resources are in **fixed places** — block RAMs in columns, hard
multipliers in columns, input and output pins on the edges. A design that needs a block RAM on one side of the
device to feed a multiplier on the other pays for that distance every cycle. Registering at the RAM output and at
the multiplier input — both of which the hard blocks usually provide as optional built-in registers — is often the
single biggest timing improvement available.

## The cost

The cost is a new kind of thinking that has no feedback loop for months. You will make a decision about bus width
or multiplexer placement in RTL, and whether it was right will not be known until layout, long after. That is
uncomfortable, and the only mitigation is to make the physical estimate yourself, early, crudely — lengths,
widths, fanouts — and write it down.

And a cost in elegance. Physically aware RTL often looks slightly odd: pipeline registers that do nothing logically,
multiplexers split into trees for no logical reason, controllers duplicated. Every one of those deserves the same
comment as episode seven's: *this is here for timing, and here is why.*

## The one thing

Wires are now slower than gates, and your RTL decides where the wires go. Distance and congestion are set by
architecture and module structure long before layout sees them — so register long interfaces, mux near the
sources, narrow wide buses, and get a floorplan while things can still move for free.

## Commute exercise

Two blocks, owned by two different engineers. A path runs from a register inside block A, through some logic in A,
out of A's output port, into B's input port, through some logic in B, and into a register in B.

The clock period is two nanoseconds. Each engineer synthesises their block separately.

On the way home, work out what each engineer needs to know in order to constrain their block. What input delay does
B's engineer write? What output delay does A's engineer write? Where do those numbers come from?

Then notice the problem: if A uses one and a half nanoseconds before its output, and B uses one and a half after its
input, each block passes alone and the path fails by a nanosecond.

Then the question worth the drive. **What agreement — or convention — would let both engineers constrain their blocks
correctly without ever meeting?** Think about episode seven's universal preventive.
