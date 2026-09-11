# VoE — Handoff

For whoever picks this up next, human or agent. Written to be read cold, with no
access to the conversation that produced it.

Last updated: 2026-09-11 · Branch `claude/reminder-next-task-4g3u1h` · PR #1

---

## 1. What this is

VoE is an FPGA IP project: generate video on a Numato Mimas A7 V3.1, packetise
it into IPv4/UDP, push it out the onboard gigabit PHY, reassemble it on a PC.
The point is not the video — it is modular RTL with real verification and a
documented hardware bring-up. Nothing has been implemented yet. **The project is
at the end of its specification phase and has written no RTL.**

## 2. Where things stand

| Item | State |
|---|---|
| PRD | **v0.2 complete**, superseding the v1.0 Draft skeleton |
| Hardware baseline | **Verified** against schematic and vendor board files |
| Pin constraints | Starter XDC written, not yet compiled |
| RTL | **None written** |
| Testbenches | **None written** |
| CI | **Not set up** |
| Hardware bring-up | **Not started** — Phase 0 not yet run |

### Repository layout

```
VoE_IP/
├─ HANDOFF.md                        this file
├─ VoE_PRD_Mimas_A7_v0.2.md          PRD — SOURCE OF TRUTH
├─ VoE_PRD_Mimas_A7_v0.2.docx        generated from the .md, do not edit directly
├─ VoE_PRD_Mimas_A7_Draft_v1.0.docx  superseded, kept for history
└─ hw/
   ├─ mimas_a7_v3_reference.md       verified hardware facts + evidence
   ├─ voe_rgmii_pins.xdc             starter pin constraints
   └─ MimasA7_V3.1_Sch.pdf           board schematic (Ethernet is sheet 11)
```

The markdown is authoritative. The `.docx` is a build artifact — regenerate it,
never hand-edit it (§8).

## 3. The three facts that shape everything

These were established from the schematic and the vendor board files. They are
not assumptions and they are not negotiable without new evidence.

**H-1 — No on-chip frame buffer is possible.** XC7A50T has ~337 KB of BRAM. A
720p RGB888 frame is 2.76 MB; even 640×480 RGB888 is 921 KB. The design is
line-buffered. If you find yourself designing a frame buffer, something has gone
wrong — it would require DDR3 via MIG, which is explicitly out of scope.

**H-2 — The FPGA owns the entire RGMII skew budget.** On this board the PHY's
TXDLY and RXDLY straps have *both* their pull-up and pull-down footprints marked
DNP (R133/R163 and R140/R164). The internal delays are not merely disabled, they
are **undetermined by the board**. Any design assuming a 2 ns PHY delay will fail
intermittently rather than cleanly — the worst failure mode there is.

**H-3 — TX skew must come from an MMCM phase shift.** Artix-7 has HR banks only,
so there is no `ODELAYE2`. Drive the TXC `ODDR` from a 90°-shifted 125 MHz clock.
RX is fine: `IDELAYE2` works in HR banks, with `IDELAYCTRL` at 200 MHz.

Full evidence and the resistor-by-resistor reading is in
`hw/mimas_a7_v3_reference.md`.

## 4. Decisions already made

| # | Decision | Why | Reversible until |
|---|---|---|---|
| 1 | 640×480@60 RGB888 Phase 1; 720p30 stretch | 480 Mbps on wire, 48% of the link — real headroom for a first bring-up | Phase 5 |
| 2 | Fixed 320-pixel (960 B) payload | Both target widths divide evenly (2 and 4 packets/line), so no line straddles a packet and address generation needs no division | Phase 5 |
| 3 | Stateless 16-byte app header | Repeating width/height/format costs 5 B in 1042 and lets the receiver join mid-stream with no out-of-band config | Phase 5 |
| 4 | Line buffer, no frame buffer | Forced by H-1 | Not reversible |
| 5 | cocotb + Verilator as primary sim | Free, CI-able, and the Python golden model is shared verbatim between sim and the host receiver — one model, so sim/hardware disagreements are real bugs | Phase 3 |
| 6 | Roll our own MAC | This is an IP-ownership project; a third-party MAC hollows out the point. `verilog-ethernet` (MIT) stays a debugging reference | Phase 3 |
| 7 | Markdown as doc source of truth | A PRD in a git repo has to diff in review | Now |
| 8 | TPG runs in `clk_tx`, throttled | Removes the pixel-clock CDC in Phase 1, while the async FIFO is still instantiated same-clock so Phase 2 is a config change not a rework | Phase 2 |

Decisions 5 and 6 are **owner recommendations, not user-ratified**. They were
put to the project owner and answered with a general go-ahead rather than an
explicit ruling on each. If either matters to you, raise it before Phase 3 —
after that, switching is expensive.

## 5. Open items

### Needs a decision

| ID | Question | Note |
|---|---|---|
| D-1 | Confirm cocotb+Verilator, or use Questa/VCS if a licence exists | Verilator's SVA support is partial; protocol checks become cocotb monitors. A licence would restore the SVA plan |
| D-3 | Licence for the released IP | Needed before Phase 9, not before |
| D-4 | Phase 2 input: camera or HDMI first | Deferrable; the CDC hook fits either |

### Needs verification on hardware

None of these are blocking today, but each is cheap and each removes a way to
waste a week later.

| What | How | Why it matters |
|---|---|---|
| PHY address | MDIO scan of addresses 0–31 | Strap reading suggests 5, but that assumes RXCTL carries AD2. 32 reads settles it |
| `eth_rx_clk` (W19) is clock-capable | Check in Vivado | If it can't drive a BUFG/MMCM the whole RX clocking scheme changes |
| C143 (27 pF on RX_CLK) populated? | Inspect the board | 27 pF is heavy at 125 MHz. If fitted it slows the clock edge and shifts the sampling window — it would quietly invalidate any calculated IDELAY tap |
| PHY latched strap config | Read back over MDIO | Confirms H-2 empirically rather than by inference from DNP markings |

## 6. What to do next

**Phase 0 — do this before writing any RTL.** Flash Numato's prebuilt reference
bitstream and ELF from `github.com/numato/Mimas-A7` (`MimasA7_Ethernet/Bitstream/`).
Program the `.bit`, load the `.elf` over JTAG, serial at 9600 baud, set the host
NIC to 192.168.1.15/24, then telnet to 192.168.1.10 port 7 and confirm the echo.

This costs an afternoon and buys a great deal: when our own RGMII fails to link
— and given H-2 it will, at first — we already know the board, PHY, cable and
host NIC are not the reason. Note the reference design is MicroBlaze + lwIP +
MIG + Xilinx TEMAC, which is licence-encumbered, so we cannot lift its MAC. The
prebuilt bitstream needs no licence to flash.

**Phase 1 — repo skeleton.** CI, Verilator lint, cocotb harness, golden-model
stub. Exit criterion is CI green on an empty design, which sounds trivial and is
the reason every later phase moves quickly.

Then follow §13 of the PRD. Each phase has an exit criterion; a phase is done
when its criterion is demonstrated, not when its work feels finished.

## 7. Traps

Collected because each one is a known time sink in this class of design.

- **Runt frames.** The last packet of a frame can fall under the 64-byte Ethernet
  minimum. Pad it. Real NICs drop runts silently and you will blame the
  packetizer.
- **UDP checksum.** Mandatory for IPv4 *header*, optional for UDP over IPv4 —
  send UDP checksum as zero. Don't burn days implementing it.
- **PHY reset timing.** There is a ~470 µs RC on the reset line, and RTL8211E
  wants roughly 10 ms after reset before the first MDIO transaction. Don't race
  it; the failure looks like a dead PHY.
- **`CLK125` is not connected** on this board. You cannot source the 125 MHz TX
  clock from the PHY the way many RGMII designs do. It comes from the 100 MHz
  oscillator via MMCM — VCO 1000 MHz, M=10, D=1, divides of 8 and 5.
- **RTL8211E has no public datasheet.** Realtek gates it. `drivers/net/phy/realtek.c`
  in the Linux kernel is the most reliable public description of its
  extended-page delay registers.
- **ARP is a hidden requirement.** Sending to a PC by IP needs its MAC. Implement
  the ARP responder, and implement ICMP echo too — being able to ping the board
  before video flows cleanly separates "link works" from "packetizer is wrong".
- **Don't chase >95% coverage before writing the coverage plan.** A coverage
  number without a defined model measures nothing; bins drawn after the fact fit
  whatever the tests already do.

## 8. Environment notes

Quirks of the container this work was done in. They cost time to rediscover.

- **`numato.com` is blocked** by the egress proxy. Vendor material has to come
  from their GitHub org: `numato/Mimas-A7` (reference designs) and
  `numato/vivadoBSP` (board files, which carry the pinout).
- **LibreOffice cannot load `.docx` here.** Its Writer import filter is broken —
  it fails on Word-authored files too, not just generated ones. Consequence:
  **the generated `.docx` has never been visually rendered.** It was verified
  structurally only (valid zip, well-formed XML, 615 paragraphs, 25 tables, no
  malformed rows). Open it in Word before circulating it.
- **`pandoc` and `poppler-utils` are not installed** by default. `apt-get update`
  then `apt-get install poppler-utils` works and gives you `pdftotext` /
  `pdftoppm`, which the Read tool needs to render PDF pages.
- **`pypdf` installs but is broken** (`cryptography` has a bad `_cffi_backend`).
  Use poppler instead.
- **Regenerating the `.docx`:** the converter script is not committed — it lived
  in scratch. `npm install docx`, then a script walking the markdown and emitting
  docx-js `Paragraph`/`Table` nodes. If the docx needs regenerating often, commit
  the script; if not, treat the `.md` as the deliverable and generate on demand.

## 9. Git state

Everything is on `claude/reminder-next-task-4g3u1h`, open as PR #1 against `main`.

The branch name is an artifact of an unrelated first task in the same session and
has nothing to do with VoE. `main` is an empty root commit created solely to give
the PR a base — the repository had no commits at all before this work. **The
feature branch is still GitHub's default branch**; switching the default to
`main` in repo settings is worth doing before the PR is merged, or the merge will
look strange.
