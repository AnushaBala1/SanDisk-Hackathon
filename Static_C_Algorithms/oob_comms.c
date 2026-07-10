/**
 * oob_comms.c — NANDGuard Out-of-Band Communication Module
 * Target: ARM Cortex-M, C99, zero external dependencies, zero heap
 */

#include "oob_comms.h"

/* =========================================================
 * INTERNAL HELPERS — not exposed in header
 * ========================================================= */

/**
 * pack_u16_le() — write a uint16 into a buffer in little-endian order.
 * BLE is always little-endian (BT Core Spec §1.3).
 */
static void pack_u16_le(uint8_t *buf, uint16_t val) {
    buf[0] = (uint8_t)(val & 0xFF);
    buf[1] = (uint8_t)((val >> 8) & 0xFF);
}

/**
 * pack_u32_le() — write a uint32 into a buffer in little-endian order.
 */
static void pack_u32_le(uint8_t *buf, uint32_t val) {
    buf[0] = (uint8_t)(val & 0xFF);
    buf[1] = (uint8_t)((val >> 8) & 0xFF);
    buf[2] = (uint8_t)((val >> 16) & 0xFF);
    buf[3] = (uint8_t)((val >> 24) & 0xFF);
}

/**
 * read_u16_le() — read a little-endian uint16 from a buffer.
 */
static uint16_t read_u16_le(const uint8_t *buf) {
    return (uint16_t)(buf[0] | ((uint16_t)buf[1] << 8));
}

/**
 * read_u32_le() — read a little-endian uint32 from a buffer.
 */
static uint32_t read_u32_le(const uint8_t *buf) {
    return (uint32_t)(buf[0])
         | ((uint32_t)buf[1] << 8)
         | ((uint32_t)buf[2] << 16)
         | ((uint32_t)buf[3] << 24);
}

/* =========================================================
 * P2 TRIGGER LOGIC — Quine-McCluskey minimized
 *
 * Truth table inputs (4 Boolean variables derived from thresholds):
 *   A = failure_prob   >= OOB_FAIL_PROB_CRITICAL   (70%)
 *   B = failure_prob   >= OOB_FAIL_PROB_WARN        (40%)
 *   C = bad_block_count >= OOB_BAD_BLOCK_CRITICAL   (200)
 *   D = wear_level_pct >= OOB_WEAR_LEVEL_WARN       (80%)
 *
 * Special overrides (not in the minimized SOP — checked first):
 *   - uncorrectable_err > 0     → instant CRITICAL
 *   - failure_prob >= LAST_GASP → LAST_GASP
 *   - ldpc_fail_rate >= 200     → escalate one level
 *
 * QM-minimized Sum of Products for each output level:
 *   CRITICAL  = A  (failure prob alone is sufficient at 70%)
 *             + B·C  (warn-level prob AND critical bad blocks)
 *             + C·D  (critical bad blocks AND high wear)
 *
 *   WARN      = B·¬A  (warn prob but not yet critical)
 *             + D·¬A  (high wear but not yet critical prob)
 *             + C·¬A  (elevated bad blocks but not critical)
 *
 *   OK        = everything else
 *
 * This replaces 20+ nested if-else with 6 prime implicant evaluations.
 * ========================================================= */
uint8_t oob_evaluate_trigger(const OobTriggerInputs *inputs) {

    /* --- Boolean variable derivation (integer comparisons, no floats) --- */
    uint8_t A = (inputs->failure_prob   >= OOB_FAIL_PROB_CRITICAL) ? 1 : 0;
    uint8_t B = (inputs->failure_prob   >= OOB_FAIL_PROB_WARN)     ? 1 : 0;
    uint8_t C = (inputs->bad_block_count >= OOB_BAD_BLOCK_CRITICAL) ? 1 : 0;
    uint8_t D = (inputs->wear_level_pct >= OOB_WEAR_LEVEL_WARN)    ? 1 : 0;

    /* --- Override 1: Last Gasp (highest priority) --- */
    if (inputs->failure_prob >= OOB_LAST_GASP_PROB) {
        return OOB_ALERT_LAST_GASP;
    }

    /* --- Override 2: Any uncorrectable error → instant CRITICAL --- */
    if (inputs->uncorrectable_err > 0) {
        return OOB_ALERT_CRITICAL;
    }

    /* --- Override 3: LDPC failure rate very high → escalate by 1 level --- */
    /* We handle this after computing base level below (see 'escalate' flag) */
    uint8_t ldpc_escalate = (inputs->ldpc_fail_rate >= 200) ? 1 : 0;

    /* --- QM minimized SOP for CRITICAL --- */
    /* CRITICAL = A + B·C + C·D */
    if (A || (B && C) || (C && D)) {
        /* LDPC escalation can't go above CRITICAL, so no change */
        return OOB_ALERT_CRITICAL;
    }

    /* --- QM minimized SOP for WARN --- */
    /* WARN = B·¬A + D·¬A + C·¬A  =  ¬A · (B + D + C) */
    if (!A && (B || D || C)) {
        /* LDPC escalation: WARN → CRITICAL */
        return ldpc_escalate ? OOB_ALERT_CRITICAL : OOB_ALERT_WARN;
    }

    /* --- Default: OK --- */
    /* LDPC escalation: OK → WARN */
    return ldpc_escalate ? OOB_ALERT_WARN : OOB_ALERT_OK;
}

/* =========================================================
 * PACKET BUILDER
 *
 * BLE GAP Advertisement wire format we produce:
 *
 * Byte 0:    AD length for Flags structure = 2
 * Byte 1:    AD type  = 0x01 (Flags)
 * Byte 2:    Flags    = 0x06 (LE General Discoverable | BR/EDR Not Supported)
 *
 * Byte 3:    AD length for Manufacturer Specific Data = (payload_len + 1)
 * Byte 4:    AD type  = 0xFF (Manufacturer Specific Data)
 * Byte 5-6:  Company ID (little-endian) = OOB_COMPANY_ID_LO, HI
 * Byte 7-8:  Magic    = 'N','G' (0x4E, 0x47)
 * Byte 9:    Flags byte: bits[1:0] = alert_level, bit[2] = last_gasp flag
 * Byte 10:   failure_prob   (1 byte, 0–100)
 * Byte 11:   wear_level_pct (1 byte, 0–100)
 * Byte 12-13:bad_block_count (uint16 LE)
 * Byte 14:   ldpc_fail_rate  (1 byte)
 * Byte 15:   temperature_c   (1 byte)
 * Byte 16-19:reallocated_sectors (uint32 LE)
 * Byte 20-23:power_on_hours       (uint32 LE)
 * Byte 24:   uncorrectable_errors (1 byte, clamped)
 *
 * Total: 25 bytes — well within the 31-byte BLE GAP limit.
 * Remaining 6 bytes reserved for future expansion.
 * ========================================================= */

/* Offsets into raw[] for each field — defined as constants so the
 * decoder can use the exact same values. Single source of truth. */
#define OFF_FLAGS_LEN       0
#define OFF_FLAGS_TYPE      1
#define OFF_FLAGS_VAL       2
#define OFF_MSD_LEN         3   /* Manufacturer Specific Data AD length */
#define OFF_MSD_TYPE        4
#define OFF_COMPANY_LO      5
#define OFF_COMPANY_HI      6
#define OFF_MAGIC_N         7
#define OFF_MAGIC_G         8
#define OFF_ALERT_FLAGS     9
#define OFF_FAIL_PROB       10
#define OFF_WEAR_LEVEL      11
#define OFF_BAD_BLOCK       12  /* 2 bytes LE */
#define OFF_LDPC_FAIL       14
#define OFF_TEMPERATURE     15
#define OFF_REALLOC_SECT    16  /* 4 bytes LE */
#define OFF_POWER_ON_HRS    20  /* 4 bytes LE */
#define OFF_UNCORR_ERR      24
#define OOB_PACKET_BYTES    25  /* total valid bytes */

/* MSD AD payload length = everything after the AD length byte itself
 * = type(1) + company_id(2) + magic(2) + fields(20) = 25 - OFF_MSD_TYPE = 21 */
#define OOB_MSD_PAYLOAD_LEN  21  /* value written into OFF_MSD_LEN byte */

uint8_t oob_build_packet(const OobHealthSnapshot *snapshot,
                          uint8_t alert,
                          OobPacket *out) {

    uint8_t *p = out->raw;

    /* --- AD Structure 1: Flags --- */
    p[OFF_FLAGS_LEN]  = 2;       /* length: type(1) + data(1) */
    p[OFF_FLAGS_TYPE] = 0x01;    /* AD type: Flags */
    p[OFF_FLAGS_VAL]  = 0x06;    /* LE General Discoverable | No BR/EDR */

    /* --- AD Structure 2: Manufacturer Specific Data --- */
    p[OFF_MSD_LEN]    = OOB_MSD_PAYLOAD_LEN; /* len = everything after this byte */
    p[OFF_MSD_TYPE]   = 0xFF;    /* AD type: Manufacturer Specific Data */
    p[OFF_COMPANY_LO] = OOB_COMPANY_ID_LO;
    p[OFF_COMPANY_HI] = OOB_COMPANY_ID_HI;
    p[OFF_MAGIC_N]    = 0x4E;    /* 'N' */
    p[OFF_MAGIC_G]    = 0x47;    /* 'G' */

    /* Flags byte: bits[1:0] = alert level, bit[2] = last_gasp flag */
    p[OFF_ALERT_FLAGS] = (alert & 0x03)
                       | ((alert == OOB_ALERT_LAST_GASP) ? 0x04 : 0x00);

    /* Health fields */
    p[OFF_FAIL_PROB]   = snapshot->failure_prob;
    p[OFF_WEAR_LEVEL]  = snapshot->wear_level_pct;
    pack_u16_le(&p[OFF_BAD_BLOCK],    snapshot->bad_block_count);
    p[OFF_LDPC_FAIL]   = snapshot->ldpc_fail_rate;
    p[OFF_TEMPERATURE] = snapshot->temperature_c;
    pack_u32_le(&p[OFF_REALLOC_SECT], snapshot->reallocated_sectors);
    pack_u32_le(&p[OFF_POWER_ON_HRS], snapshot->power_on_hours);
    p[OFF_UNCORR_ERR]  = snapshot->uncorrectable_errors;

    out->length          = OOB_PACKET_BYTES;
    out->alert_level     = alert;
    out->next_interval_ms = oob_get_interval_ms(alert);

    return OOB_PACKET_BYTES;
}

/* =========================================================
 * LAST GASP PROTOCOL
 *
 * Called from power-loss interrupt or when failure_prob >= 90%.
 * Forces alert to LAST_GASP and sets minimum broadcast interval.
 * ========================================================= */
uint8_t oob_last_gasp(const OobHealthSnapshot *snapshot, OobPacket *out) {
    /* Build a standard packet but force alert level to LAST_GASP */
    uint8_t bytes = oob_build_packet(snapshot, OOB_ALERT_LAST_GASP, out);

    /* Override interval to maximum urgency */
    out->next_interval_ms = OOB_INTERVAL_LAST_GASP_MS;

    /* Set the last_gasp bit explicitly (already done in build, but be explicit) */
    out->raw[OFF_ALERT_FLAGS] |= 0x04;

    return bytes;
}

/* =========================================================
 * PACKET DECODER
 * ========================================================= */
uint8_t oob_decode_packet(const uint8_t *raw, uint8_t len,
                           OobHealthSnapshot *out_snap,
                           uint8_t *out_alert) {

    /* Minimum sanity check */
    if (len < OOB_PACKET_BYTES) {
        return 0;
    }

    /* Validate magic bytes */
    if (raw[OFF_MAGIC_N] != 0x4E || raw[OFF_MAGIC_G] != 0x47) {
        return 0;   /* Not a NANDGuard packet */
    }

    /* Validate AD type for MSD */
    if (raw[OFF_MSD_TYPE] != 0xFF) {
        return 0;
    }

    /* Extract alert level from flags byte */
    *out_alert = raw[OFF_ALERT_FLAGS] & 0x03;
    if (raw[OFF_ALERT_FLAGS] & 0x04) {
        *out_alert = OOB_ALERT_LAST_GASP;  /* last_gasp bit set */
    }

    /* Extract health snapshot */
    out_snap->failure_prob         = raw[OFF_FAIL_PROB];
    out_snap->wear_level_pct       = raw[OFF_WEAR_LEVEL];
    out_snap->bad_block_count      = read_u16_le(&raw[OFF_BAD_BLOCK]);
    out_snap->ldpc_fail_rate       = raw[OFF_LDPC_FAIL];
    out_snap->temperature_c        = raw[OFF_TEMPERATURE];
    out_snap->reallocated_sectors  = read_u32_le(&raw[OFF_REALLOC_SECT]);
    out_snap->power_on_hours       = read_u32_le(&raw[OFF_POWER_ON_HRS]);
    out_snap->uncorrectable_errors = raw[OFF_UNCORR_ERR];

    return 1;   /* success */
}

/* =========================================================
 * INTERVAL LOOKUP
 * ========================================================= */
uint32_t oob_get_interval_ms(uint8_t alert_level) {
    switch (alert_level) {
        case OOB_ALERT_OK:        return OOB_INTERVAL_OK_MS;
        case OOB_ALERT_WARN:      return OOB_INTERVAL_WARN_MS;
        case OOB_ALERT_CRITICAL:  return OOB_INTERVAL_CRITICAL_MS;
        case OOB_ALERT_LAST_GASP: return OOB_INTERVAL_LAST_GASP_MS;
        default:                  return OOB_INTERVAL_OK_MS;
    }
}
