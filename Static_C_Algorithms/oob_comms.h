/**
 * oob_comms.h — NANDGuard Out-of-Band Communication Module
 * Target: ARM Cortex-M, C99, zero external dependencies, zero heap
 *
 * Implements:
 *  1. BLE GAP advertisement packet builder (real BLE spec format)
 *  2. Last Gasp Protocol — emergency beacon on imminent failure
 *  3. Trigger logic — P2 minimized Boolean decision (when to broadcast)
 *  4. Health snapshot compression — packs SMART telemetry into 31 bytes
 */

#ifndef OOB_COMMS_H
#define OOB_COMMS_H

#include <stdint.h>   /* uint8_t, uint16_t, uint32_t */
#include <stddef.h>   /* size_t */

/* =========================================================
 * CONSTANTS
 * ========================================================= */

/* BLE GAP advertisement payload max is 31 bytes (BT Core Spec 5.3 §2.3.1) */
#define OOB_BLE_MAX_PAYLOAD     31

/* NANDGuard company ID in BLE Manufacturer Specific Data (0xFFFF = test/dev) */
#define OOB_COMPANY_ID_LO       0xFF
#define OOB_COMPANY_ID_HI       0xFF

/* NANDGuard magic byte — identifies this as a NANDGuard OOB packet */
#define OOB_MAGIC               0x4E47  /* 'N','G' */

/* Alert severity levels — stored in 2 bits of the flags byte */
#define OOB_ALERT_OK            0x00    /* Drive healthy */
#define OOB_ALERT_WARN          0x01    /* Degraded, monitor closely */
#define OOB_ALERT_CRITICAL      0x02    /* Failure imminent, backup now */
#define OOB_ALERT_LAST_GASP     0x03    /* Last Gasp Protocol triggered */

/* Trigger thresholds — inputs to P2 logic minimizer */
#define OOB_FAIL_PROB_WARN      40      /* % — trigger WARN above this */
#define OOB_FAIL_PROB_CRITICAL  70      /* % — trigger CRITICAL above this */
#define OOB_BAD_BLOCK_WARN      50      /* count — bad blocks to warn */
#define OOB_BAD_BLOCK_CRITICAL  200     /* count — critical bad block count */
#define OOB_WEAR_LEVEL_WARN     80      /* % worn — warn threshold */
#define OOB_LAST_GASP_PROB      90      /* % — Last Gasp Protocol threshold */

/* Broadcast interval in firmware ticks (caller controls actual timer) */
#define OOB_INTERVAL_OK_MS      5000    /* 5 s when healthy */
#define OOB_INTERVAL_WARN_MS    1000    /* 1 s when degraded */
#define OOB_INTERVAL_CRITICAL_MS 200   /* 200 ms when critical */
#define OOB_INTERVAL_LAST_GASP_MS 50   /* 50 ms — rapid fire on Last Gasp */

/* =========================================================
 * DATA STRUCTURES
 * ========================================================= */

/**
 * OobHealthSnapshot — compressed SMART telemetry
 * All values are scaled integers (no floats) to fit in firmware RAM.
 *
 * Total size when packed: fits inside 20 bytes of the 31-byte BLE payload
 * (leaving 11 bytes for AD headers + company ID + magic + flags).
 */
typedef struct {
    uint8_t  failure_prob;      /* 0–100 — output of P5 XGBoost predictor   */
    uint8_t  wear_level_pct;    /* 0–100 — % of P/E cycles consumed          */
    uint16_t bad_block_count;   /* raw count from P1 Bad Block Manager        */
    uint8_t  ldpc_fail_rate;    /* 0–255 — LDPC correction failures per 1000 */
    uint8_t  temperature_c;     /* drive temperature in Celsius               */
    uint32_t reallocated_sectors; /* SMART attribute 5                        */
    uint32_t power_on_hours;    /* SMART attribute 9                          */
    uint8_t  uncorrectable_errors; /* SMART attribute 187, clamped to 255     */
} OobHealthSnapshot;

/**
 * OobPacket — the full BLE GAP advertisement packet
 *
 * BLE GAP advertisement structure (§11 BT Core Spec):
 *   [len][type][data...] [len][type][data...] ...
 *
 * We build two AD structures:
 *   AD 1: Flags (type 0x01) — LE General Discoverable, BR/EDR not supported
 *   AD 2: Manufacturer Specific Data (type 0xFF) — NANDGuard payload
 *
 * The raw[] array is what you hand to the BLE radio (e.g. hci_le_set_advertising_data).
 */
typedef struct {
    uint8_t raw[OOB_BLE_MAX_PAYLOAD];   /* ready-to-transmit bytes */
    uint8_t length;                      /* number of valid bytes in raw[] */
    uint8_t alert_level;                 /* OOB_ALERT_* — for caller logic  */
    uint32_t next_interval_ms;           /* how long until next broadcast   */
} OobPacket;

/**
 * OobTriggerInputs — inputs to the P2 Boolean trigger logic
 * These come from P1 (Bad Block Manager), P3 (LDPC), P5 (Failure Predictor).
 */
typedef struct {
    uint8_t  failure_prob;      /* 0–100 from P5 */
    uint16_t bad_block_count;   /* from P1 */
    uint8_t  wear_level_pct;    /* 0–100 */
    uint8_t  ldpc_fail_rate;    /* 0–255 from P3 */
    uint8_t  uncorrectable_err; /* nonzero = instant CRITICAL */
} OobTriggerInputs;

/* =========================================================
 * PUBLIC API
 * ========================================================= */

/**
 * oob_evaluate_trigger()
 * P2-minimized Boolean decision function — determines alert severity.
 *
 * This is the output of the Quine-McCluskey minimizer applied to the
 * truth table of all combinations of (fail_prob, bad_blocks, wear, ldpc).
 * Instead of 16 nested if-else branches, the minimizer reduced it to
 * 4 essential prime implicants (see implementation for the SOP expression).
 *
 * Returns: OOB_ALERT_OK / WARN / CRITICAL / LAST_GASP
 */
uint8_t oob_evaluate_trigger(const OobTriggerInputs *inputs);

/**
 * oob_build_packet()
 * Assembles the BLE GAP advertisement packet from a health snapshot.
 * Packs snapshot into the Manufacturer Specific Data AD structure.
 *
 * @param snapshot  — pointer to current SMART telemetry
 * @param alert     — alert level from oob_evaluate_trigger()
 * @param out       — output packet (caller provides storage, no malloc)
 * @return          — number of bytes written to out->raw[]
 */
uint8_t oob_build_packet(const OobHealthSnapshot *snapshot,
                          uint8_t alert,
                          OobPacket *out);

/**
 * oob_last_gasp()
 * Last Gasp Protocol — called when failure_prob >= OOB_LAST_GASP_PROB.
 * Builds a maximum-urgency packet and sets the shortest broadcast interval.
 * Designed to be called from a hardware interrupt handler (power-loss IRQ).
 *
 * The "last gasp" concept: on imminent power loss or catastrophic failure,
 * the SSD fires this beacon as fast as the BLE radio allows, broadcasting
 * the final health snapshot so a nearby observer (phone, gateway) can log it
 * even if the host system is already dead.
 *
 * @param snapshot  — final health snapshot at moment of failure
 * @param out       — output packet
 * @return          — bytes written
 */
uint8_t oob_last_gasp(const OobHealthSnapshot *snapshot, OobPacket *out);

/**
 * oob_decode_packet()
 * Parse a raw received BLE advertisement back into a health snapshot.
 * Used on the receiver side (ESP32 / phone app / Node.js via serial).
 *
 * @param raw       — raw bytes from BLE radio
 * @param len       — length of raw buffer
 * @param out_snap  — decoded snapshot (caller provides storage)
 * @param out_alert — decoded alert level
 * @return          — 1 on success, 0 on invalid/corrupt packet
 */
uint8_t oob_decode_packet(const uint8_t *raw, uint8_t len,
                           OobHealthSnapshot *out_snap,
                           uint8_t *out_alert);

/**
 * oob_get_interval_ms()
 * Returns the recommended broadcast interval for a given alert level.
 * Caller uses this to program the hardware timer between broadcasts.
 */
uint32_t oob_get_interval_ms(uint8_t alert_level);

#endif /* OOB_COMMS_H */
