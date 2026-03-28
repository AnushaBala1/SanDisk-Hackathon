"""
oob_sim.py — NANDGuard OOB Simulation Core
Mirrors the C firmware logic exactly (same constants, same packet format,
same trigger thresholds) but runs in Python so we can drive it from a
simulated NAND environment and stream results to the Node.js bridge.

Architecture:
  This script <--WebSocket (port 3002)--> server.js <--Socket.io (port 3001)--> React dashboard

CHANGE from original:
  WS_URI updated from ws://localhost:3001 → ws://localhost:3002
  Reason: port 3001 is now the unified REST + Socket.io server.
          The raw WebSocket listener for oob_sim.py has moved to 3002.

Run:
  pip install websockets
  python oob_sim.py
"""

import asyncio
import json
import struct
import time
import random
import math
import websockets

# ─── Constants (must match oob_comms.h exactly) ───────────────────────────────

OOB_FAIL_PROB_WARN      = 40
OOB_FAIL_PROB_CRITICAL  = 70
OOB_BAD_BLOCK_WARN      = 50
OOB_BAD_BLOCK_CRITICAL  = 200
OOB_WEAR_LEVEL_WARN     = 80
OOB_LAST_GASP_PROB      = 90

OOB_ALERT_OK        = 0
OOB_ALERT_WARN      = 1
OOB_ALERT_CRITICAL  = 2
OOB_ALERT_LAST_GASP = 3

ALERT_NAMES = {
    OOB_ALERT_OK:        "OK",
    OOB_ALERT_WARN:      "WARN",
    OOB_ALERT_CRITICAL:  "CRITICAL",
    OOB_ALERT_LAST_GASP: "LAST_GASP",
}

INTERVAL_MS = {
    OOB_ALERT_OK:        5000,
    OOB_ALERT_WARN:      1000,
    OOB_ALERT_CRITICAL:  200,
    OOB_ALERT_LAST_GASP: 50,
}

OOB_COMPANY_ID_LO = 0xFF
OOB_COMPANY_ID_HI = 0xFF
MAGIC_N = 0x4E   # 'N'
MAGIC_G = 0x47   # 'G'

# ── UPDATED: port 3002 (raw WS listener moved out of 3001 to avoid conflict) ──
WS_URI = "ws://localhost:3002"

# ─── Python mirror of oob_evaluate_trigger() ──────────────────────────────────

def evaluate_trigger(failure_prob, bad_block_count, wear_level_pct,
                     ldpc_fail_rate, uncorrectable_err):
    """
    Exact Python translation of the QM-minimized C function.
    Boolean variables:
      A = failure_prob >= 70
      B = failure_prob >= 40
      C = bad_block_count >= 200
      D = wear_level_pct >= 80
    QM SOP:
      CRITICAL = A + B·C + C·D
      WARN     = ¬A · (B + D + C)
    """
    A = failure_prob    >= OOB_FAIL_PROB_CRITICAL
    B = failure_prob    >= OOB_FAIL_PROB_WARN
    C = bad_block_count >= OOB_BAD_BLOCK_CRITICAL
    D = wear_level_pct  >= OOB_WEAR_LEVEL_WARN

    # Last Gasp override (highest priority)
    if failure_prob >= OOB_LAST_GASP_PROB:
        return OOB_ALERT_LAST_GASP

    # Uncorrectable error → instant CRITICAL
    if uncorrectable_err > 0:
        return OOB_ALERT_CRITICAL

    ldpc_escalate = ldpc_fail_rate >= 200

    # QM minimized CRITICAL: A + B·C + C·D
    if A or (B and C) or (C and D):
        return OOB_ALERT_CRITICAL

    # QM minimized WARN: ¬A·(B + D + C)
    if (not A) and (B or D or C):
        return OOB_ALERT_CRITICAL if ldpc_escalate else OOB_ALERT_WARN

    return OOB_ALERT_WARN if ldpc_escalate else OOB_ALERT_OK


# ─── Python mirror of oob_build_packet() ─────────────────────────────────────

def build_packet(snapshot: dict, alert: int) -> bytes:
    """
    Builds the exact 25-byte BLE GAP advertisement packet.
    Packet layout mirrors the C implementation byte-for-byte.
    """
    flags_byte = (alert & 0x03) | (0x04 if alert == OOB_ALERT_LAST_GASP else 0x00)

    packet = struct.pack(
        "<"
        "BBB"
        "BB"
        "BB"
        "BB"
        "B"
        "B"
        "B"
        "H"
        "B"
        "B"
        "I"
        "I"
        "B",
        2, 0x01, 0x06,
        21, 0xFF,
        OOB_COMPANY_ID_LO, OOB_COMPANY_ID_HI,
        MAGIC_N, MAGIC_G,
        flags_byte,
        snapshot["failure_prob"],
        snapshot["wear_level_pct"],
        snapshot["bad_block_count"],
        snapshot["ldpc_fail_rate"],
        snapshot["temperature_c"],
        snapshot["reallocated_sectors"],
        snapshot["power_on_hours"],
        snapshot["uncorrectable_errors"],
    )
    return packet   # 25 bytes


def decode_packet(raw: bytes) -> dict | None:
    """
    Decode a 25-byte OOB packet back to a dict.
    Mirrors oob_decode_packet() in C.
    Returns None on invalid packet.
    """
    if len(raw) < 25:
        return None
    if raw[7] != MAGIC_N or raw[8] != MAGIC_G:
        return None

    alert_flags = raw[9]
    alert = alert_flags & 0x03
    if alert_flags & 0x04:
        alert = OOB_ALERT_LAST_GASP

    bad_block_count     = struct.unpack_from("<H", raw, 12)[0]
    reallocated_sectors = struct.unpack_from("<I", raw, 16)[0]
    power_on_hours      = struct.unpack_from("<I", raw, 20)[0]

    return {
        "alert":                alert,
        "alert_name":           ALERT_NAMES[alert],
        "failure_prob":         raw[10],
        "wear_level_pct":       raw[11],
        "bad_block_count":      bad_block_count,
        "ldpc_fail_rate":       raw[14],
        "temperature_c":        raw[15],
        "reallocated_sectors":  reallocated_sectors,
        "power_on_hours":       power_on_hours,
        "uncorrectable_errors": raw[24],
    }


# ─── SMART Telemetry Generator ────────────────────────────────────────────────

class SmartGenerator:
    """
    Produces synthetic SMART telemetry that realistically degrades over time.
    Phase 1 (t=0..200):   Healthy drive, slow degradation
    Phase 2 (t=200..350): Accelerating wear, bad blocks accumulating
    Phase 3 (t=350+):     Critical phase, Last Gasp imminent
    """

    def __init__(self):
        self.t = 0
        self.power_on_hours = 8760   # 1 year of prior use
        self.reallocated    = 0
        self.uncorrectable  = 0

    def tick(self) -> dict:
        self.t += 1
        t = self.t

        raw_prob    = 100 / (1 + math.exp(-0.025 * (t - 280)))
        failure_prob = max(0, min(100, int(raw_prob + random.gauss(0, 2))))
        wear         = min(100, int(t * 0.22 + random.gauss(0, 1)))

        if t < 200:
            bad_blocks = int(t * 0.1 + random.gauss(0, 2))
        elif t < 300:
            bad_blocks = int(20 + (t - 200) * 1.5 + random.gauss(0, 5))
        else:
            bad_blocks = int(170 + (t - 300) * 3.0 + random.gauss(0, 8))
        bad_blocks = max(0, bad_blocks)

        ldpc_fail   = max(0, min(255, int(bad_blocks * 0.8 + random.gauss(0, 5))))
        temperature = max(20, min(85, int(35 + wear * 0.25 + random.gauss(0, 1.5))))
        self.reallocated = min(0xFFFFFFFF, int(bad_blocks * 2))

        if failure_prob >= 80 and random.random() < 0.15:
            self.uncorrectable = min(255, self.uncorrectable + 1)

        self.power_on_hours += 1

        return {
            "failure_prob":         failure_prob,
            "wear_level_pct":       wear,
            "bad_block_count":      bad_blocks,
            "ldpc_fail_rate":       ldpc_fail,
            "temperature_c":        temperature,
            "reallocated_sectors":  self.reallocated,
            "power_on_hours":       self.power_on_hours,
            "uncorrectable_errors": self.uncorrectable,
        }


# ─── Main simulation loop ─────────────────────────────────────────────────────

async def run_simulation():
    gen = SmartGenerator()
    last_gasp_mode = False

    print("[oob_sim] Starting NANDGuard OOB simulation...")
    print(f"[oob_sim] Connecting to Node.js bridge at {WS_URI}")

    while True:
        try:
            async with websockets.connect(WS_URI) as ws:
                print("[oob_sim] Connected to Node.js bridge.")

                while True:
                    snapshot = gen.tick()

                    alert = evaluate_trigger(
                        snapshot["failure_prob"],
                        snapshot["bad_block_count"],
                        snapshot["wear_level_pct"],
                        snapshot["ldpc_fail_rate"],
                        snapshot["uncorrectable_errors"],
                    )

                    if alert == OOB_ALERT_LAST_GASP and not last_gasp_mode:
                        print("[oob_sim] *** LAST GASP PROTOCOL ACTIVATED ***")
                        last_gasp_mode = True

                    raw_packet = build_packet(snapshot, alert)
                    decoded    = decode_packet(raw_packet)

                    message = {
                        "ts":          int(time.time() * 1000),
                        "tick":        gen.t,
                        "raw_hex":     raw_packet.hex(),
                        "packet_len":  len(raw_packet),
                        "alert":       decoded["alert"],
                        "alert_name":  decoded["alert_name"],
                        "interval_ms": INTERVAL_MS[alert],
                        "snapshot":    snapshot,
                    }

                    await ws.send(json.dumps(message))

                    print(
                        f"[t={gen.t:04d}] alert={decoded['alert_name']:9s} | "
                        f"fail={snapshot['failure_prob']:3d}% | "
                        f"wear={snapshot['wear_level_pct']:3d}% | "
                        f"bad_blk={snapshot['bad_block_count']:4d} | "
                        f"ldpc={snapshot['ldpc_fail_rate']:3d} | "
                        f"temp={snapshot['temperature_c']}°C"
                    )

                    interval_s = INTERVAL_MS[alert] / 1000.0
                    await asyncio.sleep(interval_s)

        except (websockets.ConnectionClosed, OSError) as e:
            print(f"[oob_sim] Connection error: {e}. Retrying in 2s...")
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(run_simulation())