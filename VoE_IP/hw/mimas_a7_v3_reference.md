# Mimas A7 V3 — Hardware Reference for VoE

Facts gathered from Numato's published Vivado board-support files and the
Ethernet reference design. This is the authoritative hardware baseline for the
VoE PRD; anything not listed here is unverified.

Sources:
- `github.com/numato/vivadoBSP` — `MimasA7/1.0/{board.xml,part0_pins.xml}`
- `github.com/numato/Mimas-A7` — `MimasA7_Ethernet/` reference design

## Part

| Item | Value |
|---|---|
| FPGA | `xc7a50tfgg484-1` |
| Board name (Vivado) | `Mimas_A7_50T`, vendor `numato.com`, board rev `1.0` |
| Ethernet PHY | Realtek RTL8211E, RGMII, 10/100/1000 |
| DDR3 | Present (MIG used in Numato reference design) |

XC7A50T on-chip BRAM is ~2.7 Mb (~337 KB). A 720p RGB888 frame is 2.76 MB, and
even 640x480 RGB888 is 921 KB. **No full-frame buffer fits on-chip at any
useful resolution.** VoE Phase 1 is line-buffered; a frame buffer would require
DDR3 via MIG.

## Pinout (from `part0_pins.xml`)

All Ethernet pins are `LVCMOS33`.

| Signal | Pin |
|---|---|
| `clk` (100 MHz osc) | H4 |
| `reset` | M2 |
| `eth_rst` / `phy_reset_n` | R14 |
| `eth_mdc` | R19 |
| `eth_mdio` | P16 |
| `eth_tx_clk` | U20 |
| `eth_tx_ctl` | T20 |
| `eth_txd[0..3]` | V18, U18, V17, U17 |
| `eth_rx_clk` | W19 |
| `eth_rx_ctl` | Y19 |
| `eth_rxd[0..3]` | AB18, W20, W17, V20 |

Notes:
- `eth_rst` and `phy_reset_n` are the same physical pin (R14); the board file
  lists it twice under two names.
- The board file declares MDIO only as `eth_mdio_i`. MDIO is bidirectional and
  needs an `IOBUF`; treat the board file name as informational.
- The board file specifies no `SLEW` or `DRIVE`. RGMII TX at 125 MHz DDR needs
  them set explicitly — start at `SLEW FAST`, `DRIVE 12` and tune.
- **To verify in Vivado:** that `eth_rx_clk` (W19) is on a clock-capable
  (MRCC/SRCC) input so it can drive a BUFG/MMCM. The Numato design works, so it
  should be, but confirm before committing to a receive clocking scheme.

## Clocking (from the reference design's MMCM config)

Board-proven recipe, 100 MHz input:

| Output | Frequency | Purpose |
|---|---|---|
| CLKOUT1 | 100 MHz | System / control |
| CLKOUT2 | 200 MHz | `IDELAYCTRL` reference |
| CLKOUT3 | 125 MHz | RGMII TX |

VCO 1000 MHz (M=10, D=1); divides of 5 and 8 give 200 and 125 MHz exactly.

The presence of a 200 MHz output confirms the reference design uses `IDELAYE2`
for RGMII RX skew, with `IDELAYCTRL` at 200 MHz (~78 ps/tap). **VoE adopts the
same approach** — skew is tuned in our RTL with an ILA rather than relying on
the RTL8211E's internal delay configuration.

## What the reference design actually is

Not a lightweight RGMII example. It is MicroBlaze + lwIP + MIG (DDR3) + Xilinx
**AXI Ethernet (TEMAC)**, which is licence-encumbered. Two consequences:

1. We cannot lift its MAC. VoE writes its own; that was the plan regardless.
2. A **prebuilt bitstream and ELF are in the repo** (`MimasA7_Ethernet/Bitstream/`).
   Flashing those needs no licence and proves board, PHY, link, and cable before
   we debug a single line of our own RTL. This is the Phase-0 gate.

Reference design bring-up (from its README): program `.bit`, then load `.elf`
over JTAG, serial at 9600 baud, board answers telnet echo on port 7 at
192.168.1.10. Set the host NIC to 192.168.1.15/24.

## Still missing: the schematic

`numato.com` is blocked by this environment's egress proxy, and the GitHub repos
carry no schematic PDF. The board files give us the complete FPGA-side pinout,
which is most of what a schematic would have told us — but **not** the one thing
that matters for RGMII bring-up:

> **The RTL8211E strap-resistor states.** Whether Numato tied the TX/RX internal
> delay straps high, low, or floating determines the PHY's power-on delay
> configuration, and therefore the starting point for skew tuning.

This stays an open Phase-0 item. Ways to close it, cheapest first:

1. Read the straps back over MDIO at runtime once we have an MDIO master — the
   PHY reports its latched strap configuration. This needs no document.
2. Request the V3 schematic from Numato support, or fetch it from
   `numato.com/docs/mimas-artix-7-fpga-development-board-with-ddr-sdram-and-gigabit-ethernet/`
   on an unproxied network.
3. Inspect the board directly around the PHY.

Option 1 is likely to be fastest and is worth building the MDIO master early for
that reason alone. Note also that Realtek does not publish the RTL8211E
datasheet openly; `drivers/net/phy/realtek.c` in the Linux kernel is the most
reliable public description of its extended-page delay registers.
