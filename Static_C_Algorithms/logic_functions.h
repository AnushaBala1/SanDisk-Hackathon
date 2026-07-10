/**
 * logic_functions.h — NANDGuard Auto-Generated Firmware Decision Functions
 *
 * These three functions are the output of the QM minimizer applied to
 * real SSD firmware decision tables.  They are pure Boolean functions:
 * zero side-effects, zero globals, zero dynamic allocation.
 *
 * Variable packing (same for all three functions)
 * ------------------------------------------------
 * Each function receives a uint16_t input_word where bits map to:
 *
 *  Bit  Variable              Type / Range
 *  ---  --------              ------------
 *   0   free_blocks_low       1 = free block ratio < 10%
 *   1   dirty_ratio_high      1 = dirty-page ratio > 80%
 *   2   write_pressure        1 = pending write queue > threshold
 *   3   wear_imbalance        1 = wear-level delta > 1000 P/E cycles
 *   4   hot_cold_ratio_high   1 = hot/cold data ratio > configured limit
 *   5   ldpc_fail_rate_high   1 = LDPC failure rate exceeding safe bound
 *   6   bad_block_rate_high   1 = bad-block count > 2% of total blocks
 *   7   read_disturb_flag     1 = read-disturb counter crossed threshold
 *   8   temp_high             1 = die temperature > 70°C
 *   9   retention_risk        1 = estimated data-retention age exceeded
 *  10   power_cycle_burst     1 = >50 power cycles in last 24 h window
 *  11   reserved              (must be 0; future expansion)
 *
 * All unused bits [12:15] are treated as don't-cares by the minimizer.
 *
 * Usage
 * -----
 *   uint16_t state = nandguard_pack_inputs(smart_data);
 *   if (gc_trigger(state))     { schedule_gc(); }
 *   if (wear_level_trigger(state)) { trigger_wear_leveling(); }
 *   if (oob_alert_trigger(state))  { send_ble_alert(); }
 */

#ifndef LOGIC_FUNCTIONS_H
#define LOGIC_FUNCTIONS_H

#include <stdint.h>

/* =========================================================================
 * Input bit positions — use these when building the input_word
 * ========================================================================= */
#define LF_BIT_FREE_BLOCKS_LOW      (0u)
#define LF_BIT_DIRTY_RATIO_HIGH     (1u)
#define LF_BIT_WRITE_PRESSURE       (2u)
#define LF_BIT_WEAR_IMBALANCE       (3u)
#define LF_BIT_HOT_COLD_RATIO_HIGH  (4u)
#define LF_BIT_LDPC_FAIL_RATE_HIGH  (5u)
#define LF_BIT_BAD_BLOCK_RATE_HIGH  (6u)
#define LF_BIT_READ_DISTURB         (7u)
#define LF_BIT_TEMP_HIGH            (8u)
#define LF_BIT_RETENTION_RISK       (9u)
#define LF_BIT_POWER_CYCLE_BURST    (10u)

/** Pack individual flags into an input_word for the decision functions. */
static inline uint16_t lf_pack(
    uint8_t free_blocks_low,
    uint8_t dirty_ratio_high,
    uint8_t write_pressure,
    uint8_t wear_imbalance,
    uint8_t hot_cold_ratio_high,
    uint8_t ldpc_fail_rate_high,
    uint8_t bad_block_rate_high,
    uint8_t read_disturb_flag,
    uint8_t temp_high,
    uint8_t retention_risk,
    uint8_t power_cycle_burst)
{
    return (uint16_t)(
        ((uint16_t)(free_blocks_low     & 1u) << LF_BIT_FREE_BLOCKS_LOW)    |
        ((uint16_t)(dirty_ratio_high    & 1u) << LF_BIT_DIRTY_RATIO_HIGH)   |
        ((uint16_t)(write_pressure      & 1u) << LF_BIT_WRITE_PRESSURE)     |
        ((uint16_t)(wear_imbalance      & 1u) << LF_BIT_WEAR_IMBALANCE)     |
        ((uint16_t)(hot_cold_ratio_high & 1u) << LF_BIT_HOT_COLD_RATIO_HIGH)|
        ((uint16_t)(ldpc_fail_rate_high & 1u) << LF_BIT_LDPC_FAIL_RATE_HIGH)|
        ((uint16_t)(bad_block_rate_high & 1u) << LF_BIT_BAD_BLOCK_RATE_HIGH)|
        ((uint16_t)(read_disturb_flag   & 1u) << LF_BIT_READ_DISTURB)       |
        ((uint16_t)(temp_high           & 1u) << LF_BIT_TEMP_HIGH)          |
        ((uint16_t)(retention_risk      & 1u) << LF_BIT_RETENTION_RISK)     |
        ((uint16_t)(power_cycle_burst   & 1u) << LF_BIT_POWER_CYCLE_BURST)
    );
}

/* =========================================================================
 * Decision function declarations
 * ========================================================================= */

/**
 * gc_trigger — Garbage Collection trigger.
 *
 * Returns 1 when the firmware should initiate a GC cycle.
 *
 * Minimised from truth table:
 *   Trigger if any of:
 *     - free_blocks_low  (critical, always GC)
 *     - dirty_ratio_high AND write_pressure  (pressure-driven)
 *     - dirty_ratio_high AND free_blocks_low (redundant but retained for
 *       coverage of DC minterms — collapses into free_blocks_low above)
 *     - wear_imbalance AND hot_cold_ratio_high (rewrite for leveling)
 *
 * After QM minimisation the expression is:
 *   GC = free_blocks_low
 *      | (dirty_ratio_high & write_pressure)
 *      | (wear_imbalance   & hot_cold_ratio_high)
 *
 * @param input_word  Packed flags (use lf_pack() or direct bit construction).
 * @return            1 if GC should be triggered, 0 otherwise.
 */
uint8_t gc_trigger(uint16_t input_word);

/**
 * wear_level_trigger — Wear Levelling trigger.
 *
 * Returns 1 when the firmware should move data to rebalance P/E cycles.
 *
 * Minimised expression:
 *   WL = wear_imbalance
 *      | (hot_cold_ratio_high & free_blocks_low)
 *      | (bad_block_rate_high & !temp_high)
 *
 * Rationale:
 *   - A significant wear imbalance alone is sufficient.
 *   - Hot/cold ratio skew during low free-space forces migration.
 *   - Rising bad-block rate (not caused by thermal stress) signals
 *     over-written blocks needing load redistribution.
 *
 * @param input_word  Packed flags.
 * @return            1 if wear-levelling should be triggered, 0 otherwise.
 */
uint8_t wear_level_trigger(uint16_t input_word);

/**
 * oob_alert_trigger — Out-of-Band BLE Alert trigger.
 *
 * Returns 1 when the firmware should emit an OOB health alert packet.
 *
 * Minimised expression:
 *   OOB = bad_block_rate_high
 *       | ldpc_fail_rate_high
 *       | (retention_risk & temp_high)
 *       | (read_disturb_flag & ldpc_fail_rate_high)   [collapses into ldpc above]
 *       | power_cycle_burst
 *
 * After minimisation:
 *   OOB = bad_block_rate_high
 *       | ldpc_fail_rate_high
 *       | (retention_risk & temp_high)
 *       | power_cycle_burst
 *
 * @param input_word  Packed flags.
 * @return            1 if an OOB alert should be sent, 0 otherwise.
 */
uint8_t oob_alert_trigger(uint16_t input_word);

#endif /* LOGIC_FUNCTIONS_H */
