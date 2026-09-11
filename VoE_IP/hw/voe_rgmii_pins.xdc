####################################################################
# VoE - Mimas A7 V3 (xc7a50tfgg484-1) pin constraints
# Pins from numato/vivadoBSP MimasA7/1.0/part0_pins.xml
#
# SLEW/DRIVE are NOT from the board file - they are VoE's starting
# values for 125 MHz RGMII DDR and must be validated on hardware.
####################################################################

# ---------- Clock and reset ----------
set_property -dict { PACKAGE_PIN H4  IOSTANDARD LVCMOS33 } [get_ports { sys_clk_100 }]
set_property -dict { PACKAGE_PIN M2  IOSTANDARD LVCMOS33 } [get_ports { sys_rst_n   }]

create_clock -period 10.000 -name sys_clk_100 [get_ports sys_clk_100]

# ---------- PHY management ----------
set_property -dict { PACKAGE_PIN R14 IOSTANDARD LVCMOS33 } [get_ports { phy_reset_n }]
set_property -dict { PACKAGE_PIN R19 IOSTANDARD LVCMOS33 } [get_ports { eth_mdc     }]
set_property -dict { PACKAGE_PIN P16 IOSTANDARD LVCMOS33 } [get_ports { eth_mdio    }]

# ---------- RGMII TX (FPGA -> PHY) ----------
set_property -dict { PACKAGE_PIN U20 IOSTANDARD LVCMOS33 SLEW FAST DRIVE 12 } [get_ports { rgmii_tx_clk   }]
set_property -dict { PACKAGE_PIN T20 IOSTANDARD LVCMOS33 SLEW FAST DRIVE 12 } [get_ports { rgmii_tx_ctl   }]
set_property -dict { PACKAGE_PIN V18 IOSTANDARD LVCMOS33 SLEW FAST DRIVE 12 } [get_ports { rgmii_txd[0]   }]
set_property -dict { PACKAGE_PIN U18 IOSTANDARD LVCMOS33 SLEW FAST DRIVE 12 } [get_ports { rgmii_txd[1]   }]
set_property -dict { PACKAGE_PIN V17 IOSTANDARD LVCMOS33 SLEW FAST DRIVE 12 } [get_ports { rgmii_txd[2]   }]
set_property -dict { PACKAGE_PIN U17 IOSTANDARD LVCMOS33 SLEW FAST DRIVE 12 } [get_ports { rgmii_txd[3]   }]

# ---------- RGMII RX (PHY -> FPGA) ----------
set_property -dict { PACKAGE_PIN W19  IOSTANDARD LVCMOS33 } [get_ports { rgmii_rx_clk }]
set_property -dict { PACKAGE_PIN Y19  IOSTANDARD LVCMOS33 } [get_ports { rgmii_rx_ctl }]
set_property -dict { PACKAGE_PIN AB18 IOSTANDARD LVCMOS33 } [get_ports { rgmii_rxd[0] }]
set_property -dict { PACKAGE_PIN W20  IOSTANDARD LVCMOS33 } [get_ports { rgmii_rxd[1] }]
set_property -dict { PACKAGE_PIN W17  IOSTANDARD LVCMOS33 } [get_ports { rgmii_rxd[2] }]
set_property -dict { PACKAGE_PIN V20  IOSTANDARD LVCMOS33 } [get_ports { rgmii_rxd[3] }]

# RX clock is recovered from the PHY and is its own domain.
create_clock -period 8.000 -name rgmii_rx_clk [get_ports rgmii_rx_clk]

# TODO(phase-0): confirm W19 is a clock-capable (MRCC/SRCC) input.
# TODO(phase-0): add IDELAYE2 tap constraints once RX skew is characterised.
# TODO(phase-1): declare the TX/RX clock domains asynchronous once the CDC
#                FIFOs are in place (set_clock_groups -asynchronous).
