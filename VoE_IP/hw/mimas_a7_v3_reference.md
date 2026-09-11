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

## PHY strapping (from schematic `MimasA7_V3.1_Sch.pdf`, sheet 11 "Ethernet")

PHY is **RTL8211E-VB-CG** (U9), 25 MHz crystal X1 with 12 pF loading caps on
CKXTAL1/2. Schematic sheet 11 resolves the strap question that the board files
could not.

### The headline: both RGMII delay straps are unpopulated

| Strap | Pin | Pull-up | Pull-down | Result |
|---|---|---|---|---|
| **TXDLY** | 16 (RXD1) | R133 4K7 — **DNP** | R163 4K7 — **DNP** | **unstrapped** |
| **RXDLY** | 32 (LED2) | R140 4K7 — **DNP** | R164 4K7 — **DNP** | **unstrapped** |

Numato laid out both options for each delay strap and fitted neither. The RGMII
internal delays are therefore **not board-configured** — they fall through to the
PHY's internal default pull, which for RTL8211E strap pins is a weak pull-down,
i.e. **both delays off**.

Two consequences, and they are the most important facts in this document:

1. **Do not depend on the PHY for RGMII skew.** It is not merely disabled, it is
   *undetermined by the board*. Any design that assumes a 2 ns internal delay
   will fail, and will fail intermittently rather than cleanly.
2. **The FPGA supplies the entire skew budget, both directions.** This is why
   Numato's reference design carries a 200 MHz MMCM output — `IDELAYCTRL`. Every
   piece of evidence now agrees.

### Consequence for the TX path — no ODELAY on this part

Artix-7 has only HR (High Range) I/O banks, and `ODELAYE2` exists solely in HP
banks. **TX skew cannot be produced with an output delay primitive.** It must
come from an MMCM phase-shifted clock: generate a 125 MHz output at 90° and
drive the `ODDR` that produces `rgmii_tx_clk` from it. The RX path is
unaffected — `IDELAYE2` is available in HR banks and is the right tool there.

### Other straps as fitted

| Function | Pin | Fitted | Value |
|---|---|---|---|
| SELRGV (RGMII I/O voltage) | 14 (RXD0) | R134 4K7 pull-up | 1 → 3.3 V, matches LVCMOS33 |
| AN0 | 17 (RXD2) | R132 4K7 pull-up | 1 |
| AN1 | 18 (RXD3) | R131 4K7 pull-up | 1 → autoneg on, 10/100/1000 |
| PHY_AD2 | 13 (RXCTL) | R130 4K7 pull-up | 1 |
| PHY_AD1 | 35 (LED1) | R142 4K7 pull-**down** | 0 |
| PHY_AD0 | 34 (LED0) | R144 4K7 pull-up | 1 |

That reads as **PHY address 0b101 = 5**, assuming RXCTL carries AD2. Treat as
probable, not certain: confirm by scanning MDIO addresses 0–31 at bring-up. It
is 32 register reads and it is definitive.

### Support circuitry worth knowing

- **MDIO** pin 31, **MDC** pin 30. R136 1K5 pull-up on MDIO to ETHVCC3V3.
- **PHYRSTB** pin 29, driven from FPGA R14, with R138 4K7 pull-up and C144
  0.1 µF to GND — an RC of roughly 470 µs. The reset sequencer must hold reset
  for the PHY's minimum and then wait before the first MDIO transaction;
  RTL8211E wants on the order of 10 ms post-reset. Do not race it.
- **CLK125** pin 46 is **not connected**. We cannot source a 125 MHz TX clock
  from the PHY — it must come from the 100 MHz oscillator via MMCM. This closes
  off a clocking approach that other RGMII designs commonly use.
- **ENSWREG** pin 38 tied to GND — internal switching regulator disabled, LDO
  path in use.
- **PMEB** pin 33 and **NC** pin 12 unconnected.
- **C143, 27 pF from ETH_RXCLK to GND.** Verify this is actually populated. If
  it is, 27 pF is a heavy load on a 125 MHz clock and will visibly slow the RX
  clock edges. It is presumably an EMI measure, but it shifts the RX sampling
  window and must be accounted for when characterising IDELAY taps — measure
  before trusting any calculated tap value.
- RJ45 is J5 with integrated magnetics; LEDs driven via 390R (R141, R143).

## Remaining open items

- Confirm `eth_rx_clk` (W19) is a clock-capable (MRCC/SRCC) input in Vivado.
- Confirm PHY address by MDIO scan (expected 5).
- Confirm C143 is populated on the physical board.
- Characterise RX IDELAY tap centre empirically with an ILA eye scan; there is
  no board-provided delay to inherit and no strap value to start from.
