---
season: 2
episode: 2
title: The latch you did not ask for
runtime: about 11 minutes
prerequisites: s2ep01
one_thing: Incompleteness is a request for memory. If a combinational block does not assign a signal on every path, you have asked the tool to remember, and it will.
---

> Production note: the "the tool is not being stupid, it is being obedient"
> framing is important. Listeners who feel the tool betrayed them do not learn
> the lesson.

## Where we are

Yesterday: one rule about two operators, applied mechanically, kills a whole
class of simulation-versus-silicon mismatch. Non-blocking for registers, blocking
for logic, never mixed.

If you did the exercise, you found that writing the shift register *backwards* —
C gets B, B gets A, A gets the input — accidentally works with blocking
assignments, because each statement reads a value not yet overwritten. And that
is precisely what makes it more dangerous: the technique appears to work, so the
habit survives, and it breaks the day somebody reorders the lines for
readability. A rule that only fails sometimes is worse than one that always
fails.

Today, the same theme in a different costume. Something you did not write,
appearing in your design, because of something you did not say.

## The problem

You have written a combinational block. A lump of logic, blocking assignments,
no clock anywhere near it. It decodes a three-bit opcode into some control
signals.

You handle the cases you care about. Opcode zero does this, opcode one does that,
opcode two does the other. The remaining five opcodes never occur — the block
upstream cannot generate them — so you do not write anything for them.

Synthesis runs, and the report tells you your design contains latches.

You did not write a latch. You do not want a latch. You are not sure you could
write one on purpose. And yet there they are, and now somebody senior is going to
ask you about them in a review, and the honest answer — "I have no idea where
those came from" — is not the answer you want to give.

## The turn

The tool is not being stupid. It is being obedient, and to see why, you have to
read your own code the way the tool reads it.

Remember Season 1, episode one: a combinational block describes a permanent
object. A thing that exists, always on, whose output is determined entirely by
its inputs *right now*. That is what combinational means — the output is a pure
function of the present inputs, with no memory of the past.

Now look at what you actually wrote. You said: if the opcode is zero, the output
is this. If it is one, the output is that. If it is two, the other.

And for opcode five, you said nothing.

So the tool asks the only question it can ask: when the opcode is five, what is
the output?

You have not given it a value. But this is hardware — the wire cannot be absent.
It has to carry *something*, permanently, at every instant, for every input
combination, because there is no such thing as a wire with no value.

So the tool reads your silence as a specification. And the only specification
consistent with "the designer did not name a new value here" is: **keep the value
it had before.**

And a thing that keeps the value it had before is not combinational logic. It is
memory. Specifically it is a level-sensitive latch — a device that passes its
input through while some condition holds, and freezes when it stops holding.

You asked for memory. You asked by omission. The tool granted it.

Once you see it that way, it stops being a mysterious tool behaviour and becomes
almost obvious. **Incompleteness is a request for memory.** Every inferred latch
in the history of the field is that sentence.

## Why a latch is bad news

It is worth being specific, because "latches are bad" repeated without reasons is
how the rule gets broken the first time it is inconvenient.

**It is not what you designed.** That alone is sufficient. Your mental model says
combinational; the silicon says storage. Every reasoning step you take about that
block from now on is about a different circuit than the one that exists.

**It is transparent, and transparency is a window for glitches.** A register is
deaf except at one instant — Season 1, episode two, the whole point. A latch is
*awake* for an entire interval. Anything that happens on its input during that
interval goes straight through. So a glitch on the data, or on the condition that
controls it, is captured rather than ignored. Combinational logic glitches
constantly and harmlessly, because registers are not looking. A latch is looking.

**It complicates timing analysis in a way that has real consequences.** The clean
question from Season 1, episode three — did the signal settle before the edge —
becomes a messier question about windows of transparency, borrowed time, and
paths that analysis tools handle but handle differently and less conservatively.
Design flows exist that use latches deliberately and extract real benefit from
them, and those flows are built by people who chose it on purpose. An accidental
latch is not in that flow.

**And it fights your test infrastructure.** We will get to this properly in
Season 8, but the short version: the scan machinery that makes a chip testable is
built around registers. Latches need special handling, and an unexpected latch in
the middle of a block is a hole in the test coverage of your design — which
translates into chips that fail in the field and pass on the tester.

So: not a stylistic preference. A real defect.

## How it actually gets into your code

Four ways, and they are worth being able to recognise by ear.

**An if with no else.** The most common. You assign inside the if, and say nothing
about the other case. Silence.

**A case statement with no default.** Same thing, more so, because a case over a
three-bit selector has eight branches and people habitually write the four they
care about.

**A branch that assigns fewer signals than its neighbours.** The subtle one. You
have three output signals and four branches, and in one branch you only remember
to assign two of them. The block looks complete — every branch is present — and
one signal is silently incomplete across one path. This is the version that
survives review, because the shape of the code looks right.

**A signal you compute in one branch and use in another.** Which is a related
disease: not just a latch, but potentially a combinational loop, where a block's
output feeds back into its own input with no register in the path. That produces
something that oscillates or settles unpredictably, and it is the one genuinely
frightening item on this list.

## The fix, which is embarrassingly simple

**Assign every output a default value at the top of the block, unconditionally,
before any conditional logic.**

One line per output. Set each to whatever the safe inactive value is — zero, or
idle, or the previous stage's value, whatever "nothing is happening" means for
that signal. Then write your conditional logic underneath, overriding the
defaults where you mean to.

Because you used blocking assignments — yesterday's rule — the later assignment
simply wins. And now there is no path through the block on which any output is
unassigned. There is nothing for the tool to interpret as memory. The latch
cannot be inferred, ever, including in the branch you add in six months without
re-reading the whole block.

Two supporting habits make it airtight.

**Always write a default in a case statement**, even when you believe every case
is covered. Especially then — this is the same argument as Season 1, episode
four's unspoken states, and it is the same fix.

**Use the block types that let the tool check you.** Modern SystemVerilog gives
you keywords that declare your intent — this block is combinational, this block
is a register, this block is a latch *on purpose*. When you declare intent, the
tool can compare your declaration against what your code actually describes and
complain when they differ. That turns a report you have to read into an error you
cannot ignore, which is a much better place for the check to live.

## The cost

The cost is a handful of lines of what looks like redundancy at the top of every
combinational block, and a slight feeling of writing something twice.

There is also a subtler cost worth naming. Defaults make the block *always*
complete, which means the tool will never again warn you about a signal you forgot
to think about. You have traded a noisy safety net for a silent one. The
compensation is that you now choose the safe value deliberately, once, at the top
— and "what is the safe value when nothing is happening" is a better question to
be forced to answer than "why is there a latch in my decoder".

## The one thing

Incompleteness is a request for memory. Default every output at the top of every
combinational block, always write a case default, and declare your intent so the
tool can check it.

## Commute exercise

A combinational block with a two-bit selector and three output signals. Four
branches, one per selector value, so the case statement is genuinely complete.

In three of the four branches, all three outputs are assigned. In the fourth
branch, only two of them are.

On the way home, answer three things.

How many latches does that block infer? Be precise — the answer is not three and
it is not one.

Second: in simulation, would you *see* anything wrong? Think about what the
waveform looks like when a signal holds its previous value instead of taking a
new one. Consider the case where the previous value happened to be the right
answer anyway.

And third, the one that matters: what would have caught this? Not "being more
careful" — an actual mechanism. There are at least three, and they turn up in
episode eleven of this season.
