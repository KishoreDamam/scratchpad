---
episode: 04
title: State machines
runtime: about 12 minutes
prerequisites: ep02
one_thing: Split the design into a datapath that is pure space and a controller that is pure sequence. Your flowchart instinct is legal again, but only inside the controller.
---

> Production note: this is the payoff episode for a sequential thinker. Make the
> "your instinct was not wrong, it was misfiled" line land properly.

## Where we are

We have spent three episodes taking things away from you and giving back
slightly less than we took.

Episode one: no sequence, everything is permanent objects on a table.
Episode two: sequence returns, one step per clock edge, and each step costs real
nanoseconds.
Episode three: and those nanoseconds are policed by a window so narrow that
being logically correct is merely the entry requirement.

Today you get something back, and you get it back with interest. Today I am
going to tell you that the way you naturally think — steps, order, decisions,
what happens next — is not a bad habit to be suppressed. It is a *component
type*. It has a name. And once you know where it lives, you will use it for the
rest of your career.

## The problem

Here is a task. Deliberately mundane.

You have a machine that receives a message. The message arrives one byte at a
time. First comes a start marker, then a length byte saying how many bytes of
payload follow, then that many payload bytes, then a checksum byte. Your job is
to collect the payload, check the checksum, and raise a flag saying the message
was good or bad.

In software this is twenty minutes of work and you can already see the shape of
it. Wait for the marker. Read the length. Loop that many times collecting bytes.
Compare the checksum. Set a flag.

Now try to build it on the table.

Everything you have is permanent and always on. The byte input is just a wire —
bytes wash over it continuously, one per clock cycle, forever, whether or not
they are part of a message. There is nothing that "waits". There is nothing that
"reads the next one". There is no loop, because we established that loops unroll
into copies, and you cannot unroll a loop whose count arrives at runtime in a
length byte.

And yet the task is obviously sequential. The length byte means nothing except
in relation to the marker before it. A payload byte is only a payload byte
because of where it sits in an order. The order is not decoration here, it *is*
the information.

So: how do you build a thing that knows where it is?

## The turn

Take a register — just a register, the component from episode two — and use it
to hold one piece of information. Not data. Not a byte of the message.

Use it to hold the answer to the question: **where am I?**

That is the entire idea. The whole of it. A register whose contents mean "I am
currently waiting for a start marker", or "I am currently collecting payload
bytes", or "I am currently checking the checksum". A register that holds your
position in the process.

We call its contents the **state**, and the arrangement as a whole is a **finite
state machine**. You will hear it as FSM constantly.

And now everything else falls out. Wrap that register in two lumps of
combinational logic — ordinary permanent objects, episode one, nothing new.

The first lump answers: given where I am now, and what just arrived on the
inputs, where should I be next? That is the **next-state logic**, and its output
goes into the state register, to be captured at the next clock edge.

The second lump answers: given where I am now, what should I be doing? Should
the byte counter be loading? Should the payload memory be writing? Should the
good-message flag be raised? That is the **output logic**, and it controls the
rest of the machine.

So the shape is: state register in the middle, next-state logic feeding it,
output logic reading it. Three parts. Every state machine ever built, from a
traffic light to a processor's instruction decoder, is those three parts.

Walk the message decoder through it and listen to how natural it becomes.

You sit in the idle state. Every cycle, a byte washes past. The next-state logic
looks at it: is this the start marker? No — stay idle. No, stay idle. No, stay
idle. Yes — next cycle, move to the length state.

In the length state, exactly one byte arrives, and the output logic says: load
the counter with it. Next state: collecting.

In the collecting state, the output logic says: write this byte into memory, and
decrement the counter. And the next-state logic asks one question — has the
counter reached zero? No: stay in collecting. Yes: move to the checksum state.

There is your loop. It did not unroll into a thousand copies, because it is not
a loop in the structural sense. It is a state that *does not leave itself yet*.
A loop in hardware is a cycle in the state diagram — the same physical machine,
visited repeatedly on successive clock edges.

That is the trick. You got iteration back, and it cost you one register.

## Control and datapath

Now the bigger idea, the one that reorganises how you look at every design from
here on.

Notice that the state machine never touched the data. It did not add the
checksum. It did not store the bytes. It did not count. What it did was *say
when*: load now, write now, compare now, flag now.

The adding, storing and counting were done by other components — adders,
memories, counters — sitting out there on the table, permanent and always on,
exactly as episode one described.

That split is the fundamental architectural move in digital design, and it has
standard names.

The **datapath** is everything that touches data. Adders, multipliers, memories,
registers holding values, the wires between them. It is pure space. It is wide,
parallel, permanent, and it has no idea what is going on. It is a workshop full
of machines, all switched on.

The **controller** is the state machine. It is narrow, sequential, and holds no
data at all. It is one person walking around that workshop pulling levers in the
right order.

And here is the line I have been building towards for four episodes.

Your sequential instinct was never wrong. It was misfiled. You were trying to
apply it to the whole design, which is why hardware felt like it was fighting
you. It does not belong to the whole design. It belongs to the controller. In
the controller, flowcharts are not just allowed, they are the correct and
professional way to think, and the diagram you would draw on a whiteboard
translates into the implementation almost line for line.

Someone whose instinct is strongly sequential tends to write very good
controllers — clean, complete, with every case handled and no forgotten
transitions. That is a real advantage and it is worth knowing you have it.

The discipline you need to add is simply this: know which side of the line you
are standing on. Datapath is space. Controller is sequence. Confusing them is
the single most common way that designs become slow, enormous, and impossible to
verify.

## The cost

Three costs. The first is small, the second is real, the third is the one that
ends projects.

**States are cheap, but transitions are not.** A machine with sixteen states
needs a register of four bits. Trivial. But the next-state logic has to decide,
every cycle, given the current state and every input that matters, which state
comes next. That logic grows with the number of *arrows*, not the number of
boxes, and arrows multiply much faster than people expect.

**State explosion.** If you need to track two independent things — say, whether
a message is in progress and separately whether the link is up — you might be
tempted to make states for every combination: idle-and-up, idle-and-down,
collecting-and-up, and so on. Two independent things with four conditions each
is sixteen states. Add a third and you are at sixty-four. The fix is to not do
that: build two small state machines that talk to each other rather than one
machine holding the product of everything. Small machines that communicate beat
one big machine, always, and this remains true right up to the scale of an
entire chip.

**The unspoken states.** This is the one that bites. A four-bit register can
hold sixteen values. If your machine has eleven states, five of those values are
not in your design and have never been in your plan. And a chip in the real
world *can* land in one of them — a power glitch, a stray particle, a reset that
did not quite reach everywhere.

If you have not said what happens in those states, the answer is: whatever the
logic happens to do, which may well be sitting there forever doing nothing. A
device that works perfectly on the bench and once a month locks up in the field
and needs a power cycle is very often a state machine that fell into a state its
designer never named. Say what happens. Always have a default that goes home to
idle. It costs almost nothing and it is the difference between a product and a
support ticket.

## The one thing

Split the design in two. Datapath is pure space, always on, no idea what is
happening. Controller is pure sequence, holds no data, says only *when*. Your
flowchart instinct is legal again — inside the controller, and nowhere else.

## Commute exercise

Think about a set of traffic lights at a junction with a pedestrian button.

Name the states out loud in the car. Not the colours — the states. Be careful:
they are not the same thing, and working out why they are not the same thing is
most of the exercise.

Then ask the hard question. Somebody presses the button during the two seconds
when the lights are already changing. What happens to that press?

There is no single right answer, and that is the point. There are several
defensible designs, and they differ in what they *remember* and for how long.
Pick one and follow it through. You are now doing specification work, which is
the part of this job that actually decides whether a product is good.
