/*
 * nandguard_inference.h
 * ─────────────────────────────────────────────────────────────────────────────
 * NandGuard firmware inference engine — ARM Cortex-M, static C, no heap.
 *
 * HOW TO USE:
 *   1. Run 01_retrain_for_firmware.py  →  generates nandguard_model.h
 *   2. Place nandguard_model.h and this file in your firmware project
 *   3. #include "nandguard_inference.h" in your SMART polling task
 *   4. Call nandguard_score() every time you read SMART data
 *
 * MEMORY (with n_estimators=50, max_depth=3, 54 features):
 *   Flash : ~25–35 KB  (the if/else tree from nandguard_model.h)
 *   RAM   : 216 bytes  (feature array, static — never on heap)
 *   Stack : ~64 bytes  (local vars in nandguard_score only)
 *
 * NO dependencies: no stdlib, no malloc, no FPU intrinsics.
 * ─────────────────────────────────────────────────────────────────────────────
 */

#ifndef NANDGUARD_INFERENCE_H
#define NANDGUARD_INFERENCE_H

#include <stdint.h>

/* Pull in the auto-generated model (produced by micromlgen via
 * 01_retrain_for_firmware.py).  This header defines:
 *   float NandGuard_predict(float * x);
 * which returns a probability in [0.0, 1.0].                               */
#include "nandguard_model.h"

/* ── THRESHOLD ────────────────────────────────────────────────────────────── */
/* Probability above which a drive row is considered "at-risk".
 * Matches the threshold chosen in training (0.45).
 * Stored as a scaled integer: 45 means 0.45 (divide by 100).               */
#define NANDGUARD_THRESHOLD_PCT   45u   /* = 0.45 */

/* ── FEATURE COUNT ────────────────────────────────────────────────────────── */
#define NANDGUARD_N_FEATURES      54u

/* ── ALERT LATCH ─────────────────────────────────────────────────────────── */
/* How many consecutive at-risk scores before we raise a real alert.
 * Prevents a single noisy SMART reading from triggering a false alarm.     */
#define NANDGUARD_LATCH_COUNT     3u

/* ────────────────────────────────────────────────────────────────────────── */
/*  Feature index enum                                                        */
/*  Keep in the exact order produced by 01_retrain_for_firmware.py           */
/* ────────────────────────────────────────────────────────────────────────── */
typedef enum {
    NG_FEAT_SMART_9_RAW          =  0,
    NG_FEAT_SMART_12_RAW         =  1,
    NG_FEAT_SMART_170_RAW        =  2,
    NG_FEAT_SMART_173_RAW        =  3,
    NG_FEAT_SMART_174_RAW        =  4,
    NG_FEAT_SMART_177_RAW        =  5,
    NG_FEAT_SMART_194_RAW        =  6,
    NG_FEAT_SMART_233_RAW        =  7,
    NG_FEAT_SMART_241_RAW        =  8,
    NG_FEAT_SMART_242_RAW        =  9,
    /* delta7 features */
    NG_FEAT_SMART_9_DELTA7       = 10,
    NG_FEAT_SMART_9_DELTA30      = 11,
    NG_FEAT_SMART_9_ACCEL        = 12,
    NG_FEAT_SMART_9_ROLL30       = 13,
    NG_FEAT_SMART_12_DELTA7      = 14,
    NG_FEAT_SMART_12_DELTA30     = 15,
    NG_FEAT_SMART_12_ACCEL       = 16,
    NG_FEAT_SMART_12_ROLL30      = 17,
    NG_FEAT_SMART_173_DELTA7     = 18,
    NG_FEAT_SMART_173_DELTA30    = 19,
    NG_FEAT_SMART_173_ACCEL      = 20,
    NG_FEAT_SMART_173_ROLL30     = 21,
    NG_FEAT_SMART_174_DELTA7     = 22,
    NG_FEAT_SMART_174_DELTA30    = 23,
    NG_FEAT_SMART_174_ACCEL      = 24,
    NG_FEAT_SMART_174_ROLL30     = 25,
    NG_FEAT_SMART_194_DELTA7     = 26,
    NG_FEAT_SMART_194_DELTA30    = 27,
    NG_FEAT_SMART_194_ACCEL      = 28,
    NG_FEAT_SMART_194_ROLL30     = 29,
    NG_FEAT_SMART_170_DELTA7     = 30,
    NG_FEAT_SMART_170_DELTA30    = 31,
    NG_FEAT_SMART_170_ACCEL      = 32,
    NG_FEAT_SMART_170_ROLL30     = 33,
    NG_FEAT_SMART_177_DELTA7     = 34,
    NG_FEAT_SMART_177_DELTA30    = 35,
    NG_FEAT_SMART_177_ACCEL      = 36,
    NG_FEAT_SMART_177_ROLL30     = 37,
    NG_FEAT_SMART_233_DELTA7     = 38,
    NG_FEAT_SMART_233_DELTA30    = 39,
    NG_FEAT_SMART_233_ACCEL      = 40,
    NG_FEAT_SMART_233_ROLL30     = 41,
    NG_FEAT_SMART_241_DELTA7     = 42,
    NG_FEAT_SMART_241_DELTA30    = 43,
    NG_FEAT_SMART_241_ACCEL      = 44,
    NG_FEAT_SMART_241_ROLL30     = 45,
    NG_FEAT_SMART_242_DELTA7     = 46,
    NG_FEAT_SMART_242_DELTA30    = 47,
    NG_FEAT_SMART_242_ACCEL      = 48,
    NG_FEAT_SMART_242_ROLL30     = 49,
    /* derived features */
    NG_FEAT_DRIVE_AGE_DAYS       = 50,
    NG_FEAT_POWER_LOSS_RATE      = 51,
    NG_FEAT_WEAR_PER_HOUR        = 52,
    NG_FEAT_TEMP_ROLL7           = 53,
} ng_feature_idx_t;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Rolling window state (one per physical drive slot)                        */
/* ────────────────────────────────────────────────────────────────────────── */
#define NG_HISTORY_LEN  30u   /* days of rolling history for delta features  */

typedef struct {
    /* Ring buffer of raw SMART values — oldest entry first */
    int32_t  smart_9_hist  [NG_HISTORY_LEN];
    int32_t  smart_12_hist [NG_HISTORY_LEN];
    int32_t  smart_173_hist[NG_HISTORY_LEN];
    int32_t  smart_174_hist[NG_HISTORY_LEN];
    int32_t  smart_194_hist[NG_HISTORY_LEN];
    int32_t  smart_170_hist[NG_HISTORY_LEN];
    int32_t  smart_177_hist[NG_HISTORY_LEN];
    int32_t  smart_233_hist[NG_HISTORY_LEN];
    int32_t  smart_241_hist[NG_HISTORY_LEN];
    int32_t  smart_242_hist[NG_HISTORY_LEN];

    uint16_t head;           /* next write position in ring buffer            */
    uint16_t count;          /* how many valid entries (0..NG_HISTORY_LEN)    */
    uint32_t drive_age_days; /* incremented by caller each day                */
    uint8_t  latch;          /* consecutive at-risk count                     */
    uint8_t  alerted;        /* 1 = alert already raised, don't re-raise      */
} ng_drive_state_t;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Current SMART reading (caller fills this, passes to nandguard_update)    */
/* ────────────────────────────────────────────────────────────────────────── */
typedef struct {
    int32_t smart_9;    /* Power-on hours                */
    int32_t smart_12;   /* Power cycle count             */
    int32_t smart_170;  /* Available reserved space      */
    int32_t smart_173;  /* Average erase count           */
    int32_t smart_174;  /* Unexpected power loss count   */
    int32_t smart_177;  /* Wear range delta              */
    int32_t smart_194;  /* Temperature (Celsius)         */
    int32_t smart_233;  /* Media wearout indicator       */
    int32_t smart_241;  /* Total LBAs written            */
    int32_t smart_242;  /* Total LBAs read               */
} ng_smart_reading_t;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Return value of nandguard_update()                                        */
/* ────────────────────────────────────────────────────────────────────────── */
typedef enum {
    NG_STATUS_HEALTHY    = 0,   /* score below threshold                      */
    NG_STATUS_AT_RISK    = 1,   /* single reading above threshold             */
    NG_STATUS_ALERT      = 2,   /* latch count reached — raise alarm NOW      */
    NG_STATUS_NO_DATA    = 3,   /* not enough history yet for delta features  */
} ng_status_t;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Internal helpers (static = invisible outside this translation unit)      */
/* ────────────────────────────────────────────────────────────────────────── */

/* Return value at ring-buffer offset 'ago' days before the current head.
 * ago=0 → most recent, ago=29 → oldest.
 * Returns 0 if we don't have that many entries yet.                         */
static inline int32_t
_ng_hist_get(const int32_t *buf, uint16_t head, uint16_t count, uint16_t ago)
{
    if (ago >= count) return 0;
    uint16_t idx = (uint16_t)((head + NG_HISTORY_LEN - 1u - ago) % NG_HISTORY_LEN);
    return buf[idx];
}

/* delta7  = current - value 7 days ago  */
static inline float
_ng_delta7(const int32_t *buf, uint16_t head, uint16_t count)
{
    return (float)(_ng_hist_get(buf, head, count, 0)
                 - _ng_hist_get(buf, head, count, 7u));
}

/* delta30 = current - value 30 days ago */
static inline float
_ng_delta30(const int32_t *buf, uint16_t head, uint16_t count)
{
    return (float)(_ng_hist_get(buf, head, count, 0)
                 - _ng_hist_get(buf, head, count, 29u));
}

/* accel = delta7 - prev_delta7  (second derivative, week over week) */
static inline float
_ng_accel(const int32_t *buf, uint16_t head, uint16_t count)
{
    float d_now  = _ng_delta7(buf, head, count);
    /* prev delta7 = (value 7 days ago) - (value 14 days ago) */
    float d_prev = (float)(_ng_hist_get(buf, head, count, 7u)
                          - _ng_hist_get(buf, head, count, 14u));
    return d_now - d_prev;
}

/* roll30 = simple mean of last 30 values */
static inline float
_ng_roll30(const int32_t *buf, uint16_t head, uint16_t count)
{
    int32_t  sum = 0;
    uint16_t n   = (count < NG_HISTORY_LEN) ? count : NG_HISTORY_LEN;
    uint16_t i;
    if (n == 0u) return 0.0f;
    for (i = 0u; i < n; i++) {
        sum += _ng_hist_get(buf, head, count, i);
    }
    return (float)sum / (float)n;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  nandguard_init()                                                          */
/*  Call once per drive slot at boot or when a new drive is inserted.        */
/* ────────────────────────────────────────────────────────────────────────── */
static inline void
nandguard_init(ng_drive_state_t *s)
{
    uint16_t i;
    /* Zero the ring buffers */
    for (i = 0u; i < NG_HISTORY_LEN; i++) {
        s->smart_9_hist  [i] = 0;
        s->smart_12_hist [i] = 0;
        s->smart_173_hist[i] = 0;
        s->smart_174_hist[i] = 0;
        s->smart_194_hist[i] = 0;
        s->smart_170_hist[i] = 0;
        s->smart_177_hist[i] = 0;
        s->smart_233_hist[i] = 0;
        s->smart_241_hist[i] = 0;
        s->smart_242_hist[i] = 0;
    }
    s->head           = 0u;
    s->count          = 0u;
    s->drive_age_days = 0u;
    s->latch          = 0u;
    s->alerted        = 0u;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  nandguard_update()                                                        */
/*                                                                            */
/*  Call this once per day (or on every SMART poll) for each drive.          */
/*                                                                            */
/*  Parameters:                                                               */
/*    s       — drive state (persists between calls)                         */
/*    reading — today's SMART values                                          */
/*                                                                            */
/*  Returns:                                                                  */
/*    NG_STATUS_NO_DATA  — need at least 14 days of history                  */
/*    NG_STATUS_HEALTHY  — score below threshold                              */
/*    NG_STATUS_AT_RISK  — single reading above threshold                    */
/*    NG_STATUS_ALERT    — 3 consecutive AT_RISK → raise alarm NOW           */
/* ────────────────────────────────────────────────────────────────────────── */
static inline ng_status_t
nandguard_update(ng_drive_state_t       *s,
                 const ng_smart_reading_t *reading)
{
    /* ── 1. Push new SMART values into ring buffers ─────────────────────── */
    uint16_t h = s->head;

    s->smart_9_hist  [h] = reading->smart_9;
    s->smart_12_hist [h] = reading->smart_12;
    s->smart_173_hist[h] = reading->smart_173;
    s->smart_174_hist[h] = reading->smart_174;
    s->smart_194_hist[h] = reading->smart_194;
    s->smart_170_hist[h] = reading->smart_170;
    s->smart_177_hist[h] = reading->smart_177;
    s->smart_233_hist[h] = reading->smart_233;
    s->smart_241_hist[h] = reading->smart_241;
    s->smart_242_hist[h] = reading->smart_242;

    s->head  = (uint16_t)((h + 1u) % NG_HISTORY_LEN);
    if (s->count < NG_HISTORY_LEN) s->count++;
    s->drive_age_days++;

    /* ── 2. Need at least 14 days to compute accel (2nd derivative) ─────── */
    if (s->count < 15u) {
        return NG_STATUS_NO_DATA;
    }

    /* ── 3. Build the feature array — static, no heap ───────────────────── */
    static float feat[NANDGUARD_N_FEATURES];

    uint16_t cnt = s->count;
    uint16_t hd  = s->head;   /* head already advanced past the new entry    */

/* Convenience macro: get the ring-buffer helpers for one SMART attribute   */
#define _NG_FILL(IDX_BASE, BUF)                                  \
    feat[IDX_BASE + 0u] = _ng_delta7 (s->BUF, hd, cnt);         \
    feat[IDX_BASE + 1u] = _ng_delta30(s->BUF, hd, cnt);         \
    feat[IDX_BASE + 2u] = _ng_accel  (s->BUF, hd, cnt);         \
    feat[IDX_BASE + 3u] = _ng_roll30 (s->BUF, hd, cnt)

    /* Raw SMART values (features 0-9) */
    feat[NG_FEAT_SMART_9_RAW]   = (float)reading->smart_9;
    feat[NG_FEAT_SMART_12_RAW]  = (float)reading->smart_12;
    feat[NG_FEAT_SMART_170_RAW] = (float)reading->smart_170;
    feat[NG_FEAT_SMART_173_RAW] = (float)reading->smart_173;
    feat[NG_FEAT_SMART_174_RAW] = (float)reading->smart_174;
    feat[NG_FEAT_SMART_177_RAW] = (float)reading->smart_177;
    feat[NG_FEAT_SMART_194_RAW] = (float)reading->smart_194;
    feat[NG_FEAT_SMART_233_RAW] = (float)reading->smart_233;
    feat[NG_FEAT_SMART_241_RAW] = (float)reading->smart_241;
    feat[NG_FEAT_SMART_242_RAW] = (float)reading->smart_242;

    /* Delta/roll features (features 10-49) */
    _NG_FILL(10u, smart_9_hist);
    _NG_FILL(14u, smart_12_hist);
    _NG_FILL(18u, smart_173_hist);
    _NG_FILL(22u, smart_174_hist);
    _NG_FILL(26u, smart_194_hist);
    _NG_FILL(30u, smart_170_hist);
    _NG_FILL(34u, smart_177_hist);
    _NG_FILL(38u, smart_233_hist);
    _NG_FILL(42u, smart_241_hist);
    _NG_FILL(46u, smart_242_hist);

#undef _NG_FILL

    /* Derived features (50-53) */
    feat[NG_FEAT_DRIVE_AGE_DAYS] = (float)s->drive_age_days;

    /* power_loss_rate = smart_174 / max(smart_9, 1) — avoid div/0 */
    {
        float poh = (float)(reading->smart_9 > 0 ? reading->smart_9 : 1);
        feat[NG_FEAT_POWER_LOSS_RATE] = (float)reading->smart_174 / poh;
    }

    /* wear_per_hour = smart_173 / max(smart_9, 1) */
    {
        float poh = (float)(reading->smart_9 > 0 ? reading->smart_9 : 1);
        feat[NG_FEAT_WEAR_PER_HOUR] = (float)reading->smart_173 / poh;
    }

    /* temp_roll7 = rolling mean of last 7 temperature readings */
    {
        int32_t  tsum = 0;
        uint16_t tn   = (cnt < 7u) ? cnt : 7u;
        uint16_t ti;
        for (ti = 0u; ti < tn; ti++) {
            tsum += _ng_hist_get(s->smart_194_hist, hd, cnt, ti);
        }
        feat[NG_FEAT_TEMP_ROLL7] = (tn > 0u) ? ((float)tsum / (float)tn) : 0.0f;
    }

    /* ── 4. Run the model ───────────────────────────────────────────────── */
    /* NandGuard_predict() is generated by micromlgen from nandguard_model.h.
     * Returns a probability in [0.0, 1.0].                                  */
    float prob = NandGuard_predict(feat);

    /* ── 5. Threshold + latch logic ─────────────────────────────────────── */
    /* Convert threshold to float for comparison — still one compare,
     * no FPU division needed since it's a compile-time constant.            */
    if (prob >= ((float)NANDGUARD_THRESHOLD_PCT / 100.0f)) {
        s->latch++;
        if ((s->latch >= NANDGUARD_LATCH_COUNT) && (!s->alerted)) {
            s->alerted = 1u;
            return NG_STATUS_ALERT;
        }
        return NG_STATUS_AT_RISK;
    } else {
        /* Decay latch — a single healthy reading cuts it in half */
        if (s->latch > 0u) s->latch--;
        return NG_STATUS_HEALTHY;
    }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  nandguard_reset_alert()                                                   */
/*  Call after the host has acknowledged and logged the alert.               */
/* ────────────────────────────────────────────────────────────────────────── */
static inline void
nandguard_reset_alert(ng_drive_state_t *s)
{
    s->alerted = 0u;
    s->latch   = 0u;
}

#endif /* NANDGUARD_INFERENCE_H */
