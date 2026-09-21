# The path to front-end VLSI mastery

Season 1 gave you a mental model. This document plans what comes after it: seven
further seasons, eighty-four more episodes, taking you from "thinks correctly
about hardware" to "is trusted to own a block from specification to tapeout".

**Read the honesty section first.** It changes how you should use the rest.

---

## Honesty about what audio can and cannot do

Listening cannot make you a front-end VLSI engineer. It is worth saying that
plainly at the top of a document that is otherwise an argument for listening.

What audio is genuinely good at:

- **Vocabulary.** A huge fraction of what separates a junior from a senior
  engineer in a design review is knowing what the words mean and which concept
  is being invoked. That is pure listening material.
- **Models and intuitions.** Why a thing is the way it is. Why one approach
  beats another. What the trade is. These survive being heard once and sit in
  your head for years.
- **Recognising the shape of a problem.** Being able to think "that smells like
  a reset domain crossing" before you have any evidence. This is most of what
  seniority actually is, and it is transmissible in prose.
- **Error catalogues.** The twenty mistakes that every engineer makes once.
  Hearing them costs twelve minutes; making them costs a week each.

What audio cannot do, at all:

- Build fluency in a language. That is fingers on keys.
- Teach you a tool. Every one of them is a thousand menus and a culture.
- Give you the experience of a bug that took four days.
- Replace reading actual specifications, which are long, dry, and the job.

So the structure of this plan is **two tracks running in parallel**:

**The listening track** — the seasons below, on your commute. Roughly two and a
half hours per season, one season per week if you listen one leg and think the
other.

**The lab track** — one project per season, on evenings and weekends. Each
season ends with a specific thing to build, and the listening for the next
season is deliberately about the problems that project will have raised.

The listening track is about seventeen hours in total and takes around two
months at commute pace. The lab track is where the actual time goes and is
realistically twelve to eighteen months of consistent evenings. That is the real
shape of it, and anyone selling you a faster version is selling something.

---

## The eight seasons

| # | Season | The gap it closes | Hours |
|---|---|---|---|
| 1 | The Mental Model | You think in software | 2.5 |
| 2 | RTL That Synthesises | Your code works in simulation and not in silicon | 2.5 |
| 3 | Microarchitecture | You can code a block but cannot decide what block to build | 2.5 |
| 4 | Verification for Designers | You cannot prove anything you build | 2.5 |
| 5 | Timing, Synthesis and Physics | You do not know why your design is slow | 2.5 |
| 6 | Power, Clocks and Domains | Your design works and burns too much, intermittently | 2.5 |
| 7 | Interfaces, IP and SoC | You build blocks, not systems | 2.5 |
| 8 | DFT, Reliability and the Craft | Your block is not manufacturable or maintainable | 2.5 |

Seasons 2, 3 and 4 are the core. If you only ever do three, do those.

---

## Season 2 — RTL That Synthesises

**Premise.** There is a gap between RTL that simulates correctly and RTL that
becomes good silicon, and almost nobody is taught where it is. This season is
that gap, exhaustively.

**Prerequisite.** Season 1, and having written at least one small module.

| # | Episode | The one idea |
|---|---|---|
| 2.01 | Blocking and non-blocking | One rule, mechanically applied, eliminates a whole class of bug you cannot see in a waveform |
| 2.02 | The latch you did not ask for | Incompleteness is a request for memory, and the tool will grant it silently |
| 2.03 | Reset architecture | Assert asynchronously, release synchronously — and know why each half is there |
| 2.04 | What the tool actually builds | Synthesis is pattern matching; learn the patterns and you control the result |
| 2.05 | Adders and the carry chain | Arithmetic is not free, and the carry is why your critical path is where it is |
| 2.06 | Multipliers and hard blocks | The fastest multiplier is the one already built into the die |
| 2.07 | Muxes, priority and one-hot | A priority chain and a parallel select cost wildly different amounts for the same behaviour |
| 2.08 | FIFOs done properly | Full, empty, and the off-by-one that has cost the industry a fortune |
| 2.09 | Arbiters | Fairness is a design decision, and starvation is what happens when you skip it |
| 2.10 | Parameterisation | Design families, not instances — and the moment generality starts costing more than it saves |
| 2.11 | Lint, and which warnings matter | A thousand warnings means zero warnings; curate ruthlessly |
| 2.12 | Reviewing RTL | What an experienced reviewer looks at first, and why it is never the logic |

**Lab project.** A parameterised synchronous FIFO and a round-robin arbiter,
both linted clean, both with self-checking testbenches. Small, and everything
after this uses them.

**Checkpoint.** You can look at a page of someone else's RTL and say, within a
minute, where the latches, the reset problems and the critical path are.

---

## Season 3 — Microarchitecture

**Premise.** Coding is not designing. This season is about deciding *what to
build* — the step that happens before any RTL exists and that determines whether
the project succeeds.

**Prerequisite.** Season 2.

| # | Episode | The one idea |
|---|---|---|
| 3.01 | Spec to block diagram | A repeatable decomposition method, not inspiration |
| 3.02 | Cycle accounting | Clock rate divided by item rate is your entire budget; spend it deliberately |
| 3.03 | Buffering and latency hiding | Latency you cannot remove, you can cover |
| 3.04 | Double buffering and ping-pong | The cheapest way to turn a stall into a stream |
| 3.05 | Credit-based flow control | Backpressure that works across a distance |
| 3.06 | Interconnect topology | Bus, crossbar, ring, mesh — and the cost curve that picks between them |
| 3.07 | Caches, part one | Locality, associativity, and why a cache is a bet about the future |
| 3.08 | Caches, part two | Write policies, coherence, and the moment simplicity dies |
| 3.09 | Hazards and forwarding | When pipelining meets dependency, and what it costs to paper over |
| 3.10 | Partitioning and hierarchy | Module boundaries are timing boundaries and team boundaries at once |
| 3.11 | Modelling before RTL | A spreadsheet or a C model answers in a day what RTL answers in a month |
| 3.12 | The architecture document | Writing the thing that lets ten people build one design |

**Lab project.** A small streaming processing block, specified in a document
first, modelled in Python, then implemented — and the model reused as the
verification reference.

**Checkpoint.** Given a specification, you can produce a block diagram, a cycle
budget, and a defensible argument for why that structure and not another.

---

## Season 4 — Verification for Designers

**Premise.** Season 1 gave you the philosophy. This is the practice, in the
languages and frameworks the industry actually uses. Even if you never become a
verification engineer, this decides whether anyone trusts your blocks.

**Prerequisite.** Season 3.

| # | Episode | The one idea |
|---|---|---|
| 4.01 | SystemVerilog for verification | It is a second language living inside the first, and it is the one that pays |
| 4.02 | Constrained random, properly | You are programming a solver, not writing a test |
| 4.03 | Functional coverage | Covergroups that describe the problem, not the implementation |
| 4.04 | Assertions | Executable specification, checked a billion times while you sleep |
| 4.05 | Scoreboards and transactions | Stop comparing signals; compare meanings |
| 4.06 | UVM, part one | What the framework is for, and the four components that matter |
| 4.07 | UVM, part two | Sequences, phases and configuration — the parts that confuse everyone |
| 4.08 | Formal verification | Proof instead of sampling, and the narrow band where it is devastating |
| 4.09 | Regression and closure | Turning a pile of tests into a signal you can act on |
| 4.10 | Debugging someone else's failure | A method, not a talent |
| 4.11 | The verification plan | The document that decides when you are allowed to stop |
| 4.12 | Risk-based stopping | Everything is unverified somewhere; saying where is the job |

**Lab project.** Take the Season 3 block and verify it properly —
constrained-random stimulus, a reference model, assertions, a written coverage
plan closed to a number you declared in advance.

**Checkpoint.** You can hand someone a block and a one-page claim about what has
been verified, what has not, and why that is acceptable.

---

## Season 5 — Timing, Synthesis and Physics

**Premise.** Season 1, episode 3 told you timing exists. This season is what
front-end engineers actually do about it, which is a large fraction of the job
in any real project.

**Prerequisite.** Season 2. Can be taken before Season 4 if your current work
demands it.

| # | Episode | The one idea |
|---|---|---|
| 5.01 | What synthesis does | Three phases, and where your intent survives or dies in each |
| 5.02 | Standard cells and libraries | Your design is built from a catalogue somebody else characterised |
| 5.03 | The four constraints | Clocks, input delay, output delay, exceptions — and almost nothing else |
| 5.04 | Static timing analysis | Every path, every corner, no simulation required |
| 5.05 | False paths and multicycle paths | The two most powerful and most dangerous lines in any constraints file |
| 5.06 | Clock trees | Skew, jitter, uncertainty, and why the clock is never quite one thing |
| 5.07 | Closing timing, part one | Restructure the logic: the fixes that are free |
| 5.08 | Closing timing, part two | Re-architect: the fixes that are not, and when to admit you need them |
| 5.09 | Physical awareness in RTL | Congestion, distance and the wire delay you caused six months earlier |
| 5.10 | Budgeting across hierarchy | How ten people close timing on one chip without meeting |
| 5.11 | Reading a timing report | Line by line, out loud, until it is boring |
| 5.12 | The handoff to back-end | What they need, what they will complain about, and what you owe them |

**Lab project.** Synthesise the Season 3 block. Write the constraints yourself.
Find the critical path, fix it three different ways, and record what each fix
cost in area and power.

**Checkpoint.** You can be handed a failing timing report and produce a ranked
list of causes and candidate fixes without guessing.

---

## Season 6 — Power, Clocks and Domains

**Premise.** Power is now a first-class specification, not an afterthought. And
the domain problems — clock, reset, power — are where intermittent field
failures come from.

**Prerequisite.** Season 5, and Season 1 episode 7.

| # | Episode | The one idea |
|---|---|---|
| 6.01 | Where the power goes | Dynamic, short-circuit, leakage — three different enemies with three different fixes |
| 6.02 | Clock gating | The single highest-return power technique, and why you never hand-write the gate |
| 6.03 | Architectural gating | The real wins are upstream of the cell: do not compute it at all |
| 6.04 | Power gating and retention | Turning it off, and remembering what it knew |
| 6.05 | Multi-voltage design | Level shifters, isolation, and a whole new class of connectivity bug |
| 6.06 | DVFS | Selling speed back for power, at runtime |
| 6.07 | Power intent files | UPF and CPF: the design's power structure as a separate, checkable document |
| 6.08 | Clock architecture for a real chip | Dozens of domains, one coherent plan |
| 6.09 | Reset architecture for a real chip | Who resets whom, in what order, and what is still running |
| 6.10 | CDC signoff | Structural and functional checking, and why the tool's clean report is not the end |
| 6.11 | Reset domain crossing | The problem almost nobody checks for, and the failures it explains |
| 6.12 | Power numbers | Estimating early, being asked to defend it, and the credibility that depends on it |

**Lab project.** Add clock gating to your block and measure the difference.
Introduce a second clock domain deliberately and cross it properly. Run a CDC
tool and read every finding.

**Checkpoint.** You can draw the clock, reset and power domain map of a design
and defend every crossing on it.

---

## Season 7 — Interfaces, IP and SoC

**Premise.** Nobody pays for blocks. They pay for systems. This season is
integration, standard protocols, and the discipline of building something other
people can use.

**Prerequisite.** Seasons 2 and 3.

| # | Episode | The one idea |
|---|---|---|
| 7.01 | Why standard buses exist | Interfaces are contracts; standard contracts create markets |
| 7.02 | APB | The simple one, and why simple is often correct |
| 7.03 | AHB | Pipelined, shared, and a lesson in what pipelining a bus costs |
| 7.04 | AXI, part one | Five independent channels, and the freedom that creates |
| 7.05 | AXI, part two | IDs, outstanding transactions, ordering, and the deadlocks they permit |
| 7.06 | Streaming interfaces | Season 1's valid-and-ready, standardised and industrialised |
| 7.07 | Register maps | Generate them; never hand-write a CSR block again |
| 7.08 | Interrupts and DMA | Who wakes whom, and why polling lost |
| 7.09 | Memory interfaces | What front-end owns at the edge of a DDR controller |
| 7.10 | High-speed serial | SerDes, encoding, and where the digital design stops |
| 7.11 | Packaging IP for reuse | Configurability, deliverables, documentation, and the integrator's experience |
| 7.12 | Integrating an SoC | The top level is a project with its own schedule, not a file |

**Lab project.** Wrap your block in an AXI-Stream interface and give it an APB
register map generated from a specification file. Integrate it with something
else — a soft processor, or a second block — and make them talk.

**Checkpoint.** You can read a protocol specification and implement a compliant
interface without anyone explaining it to you.

---

## Season 8 — DFT, Reliability and the Craft

**Premise.** The last gaps between a working design and a shippable product,
plus the professional context the whole thing sits in.

**Prerequisite.** Everything.

| # | Episode | The one idea |
|---|---|---|
| 8.01 | Why testability is your problem | A chip you cannot test is a chip you cannot sell |
| 8.02 | Scan | Turning every register into a shift register, and the RTL rules that permits |
| 8.03 | ATPG and fault coverage | A different meaning of coverage, with a number attached to revenue |
| 8.04 | Built-in self test | Memories test themselves, because nothing else can reach them |
| 8.05 | Debug infrastructure | JTAG and the machinery that makes post-silicon debug survivable |
| 8.06 | Post-silicon bring-up | Season 1's ladder of doubt, at industrial scale and with a schedule attached |
| 8.07 | Functional safety | ECC, parity, lockstep, and designing for a failure you will never see |
| 8.08 | Security in front-end | Side channels, secure boot, and what is actually yours to own |
| 8.09 | Area, yield and cost | Your design decisions have a unit price, and someone can calculate it |
| 8.10 | Working on a real team | Repos, branches, CI for RTL, and why hardware version control is strange |
| 8.11 | The shape of the career | Design, verification, architecture, methodology — what each life is like |
| 8.12 | Mastery | What it actually consists of, and how to tell when you have it |

**Lab project.** Take everything you have built, make it scan-friendly, put it
under continuous integration, and write the documentation another engineer would
need to use it without talking to you.

**Checkpoint.** You could be handed an unfamiliar block and a vague complaint,
and know where to start.

---

## Sequencing

**The default path** is straight through, one season per week of listening, one
project per month or two of evenings. The lab track will lag the listening
track badly, and that is correct — let it.

**If you are already working in the field**, take the season matching your
current pain first. Seasons 2, 5 and 6 are the ones that make an immediate
difference to someone mid-project. Then come back and do the rest in order.

**If you are targeting interviews**, the highest-yield order is 2, 3, 4, then 5.
Front-end interviews concentrate almost entirely in those four, with a strong
bias towards Season 2's error catalogue and Season 3's "design me a block"
questions.

**Season 5 before Season 4** is a legitimate variation if your work is
synthesis-facing rather than verification-facing.

---

## Prerequisites to the lab track

You need three things, and all three have free versions that are completely
adequate for everything in this plan:

- **A simulator.** Verilator, plus cocotb if you want to write testbenches in
  Python rather than SystemVerilog. For Season 4's UVM material you will need a
  commercial simulator or a student licence, which is the one genuine paywall in
  this plan.
- **A synthesis tool.** A vendor FPGA toolchain is free and will give you real
  timing reports, real critical paths and real area numbers. Everything in
  Season 5 works on it. Chip-specific flows differ in the detail and not in the
  thinking.
- **A development board.** Any small FPGA board. Season 1 episode 10 is the
  argument for why this matters more than it looks.

---

## Reading alongside

Deliberately short. Four books, one per phase, all of which reward being read
slowly while the corresponding season is playing.

- A rigorous digital design text, for the fundamentals you will be tempted to
  skip. Read it once properly.
- A computer architecture text, during Season 3. It teaches decomposition better
  than anything else available.
- A SystemVerilog verification text, during Season 4, with the simulator open.
- A static timing analysis text, during Season 5. This is the subject where the
  standard book is genuinely much better than the internet.

And, once per season, one real specification document from end to end. It will
be boring. Reading specifications without flinching is a professional skill and
it is trainable.

---

## What is actually being planned here

Eighty-four episodes, about seventeen hours of listening, roughly two months of
commutes.

Eight lab projects, each building on the last, ending with one nontrivial,
verified, synthesised, documented, integrated IP block that you own completely.
That block is the artefact that proves the whole thing, and it is worth more in
any professional conversation than the eight seasons are.

Mastery is not the eighty-four episodes. It is the block, plus the judgement the
episodes install about why it is the way it is.
