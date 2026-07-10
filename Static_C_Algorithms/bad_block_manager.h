/**
 * NANDGuard - Bad Block Manager (P1)
 * Two-layer XOR Filter + Bloom Filter hybrid
 *
 * Layer 1: XOR Filter  — built at boot from known bad blocks
 *                        1.23 bits/entry, 3 XOR ops per lookup
 *                        Zero false negatives guaranteed
 *
 * Layer 2: Bloom Filter — handles dynamically discovered bad blocks
 *                         at runtime (post-boot bad block growth)
 *
 * Target: ARM Cortex-M (C99, no malloc, no heap, no floats, no stdlib)
 *
 * Usage:
 *   bbm_init(&bbm, bad_block_list, count);
 *   if (bbm_is_bad(&bbm, block_addr)) { ... }
 *   bbm_mark_bad(&bbm, new_bad_block);   // runtime bad block
 */

#ifndef NANDGUARD_BAD_BLOCK_MANAGER_H
#define NANDGUARD_BAD_BLOCK_MANAGER_H

#include <stdint.h>
#include <stddef.h>

/* ─────────────────────────── Configuration ────────────────────────────── */

/** Maximum bad blocks tracked by the XOR filter (built at boot). */
#define BBM_XOR_MAX_ENTRIES     4096U

/**
 * Bloom filter size in BITS.
 * For 1M-block SSD with ~1% bad blocks: 10,000 blocks.
 * Using m = 10 * n bits gives ~1% false-positive rate with k=7 hashes.
 * Keep as a power of 2 for fast modulo via bitmask.
 */
#define BBM_BLOOM_BITS          131072U   /* 128 Kbits = 16 KB */
#define BBM_BLOOM_BYTES         (BBM_BLOOM_BITS / 8U)
#define BBM_BLOOM_MASK          (BBM_BLOOM_BITS - 1U)

/** Number of Bloom hash functions (k). Optimal for above ratio ≈ 7. */
#define BBM_BLOOM_HASH_COUNT    7U

/** Fingerprint size for XOR filter segments (8-bit fingerprints). */
#define BBM_XOR_FINGERPRINT_BITS  8U
#define BBM_XOR_FINGERPRINT_MASK  0xFFU

/* ─────────────────────────── Return Codes ──────────────────────────────── */

#define BBM_OK                  0
#define BBM_ERR_TOO_MANY        (-1)   /* exceeded XOR_MAX_ENTRIES */
#define BBM_ERR_NULL            (-2)   /* null pointer argument    */
#define BBM_ERR_NOT_INIT        (-3)   /* bbm_init not called yet  */

/* ─────────────────────────── Data Structures ──────────────────────────── */

/**
 * XOR Filter internal layout.
 *
 * The filter uses a 3-segment array B[0..3n-1] where n = entry count.
 * Each entry maps to exactly one slot in each segment via 3 hash
 * functions h0, h1, h2.  The fingerprint stored at B[h_i(x)] xors to
 * the key fingerprint, giving a zero-false-negative probabilistic set.
 *
 * Memory cost: 3 * n bytes  (1 byte fingerprint per slot)
 * For n=4096: 12 KB
 */
typedef struct {
    uint8_t  fingerprints[BBM_XOR_MAX_ENTRIES * 3U]; /* 3 segments        */
    uint32_t segment_len;                             /* n (entries padded)*/
    uint32_t entry_count;                             /* actual bad blocks */
    uint8_t  ready;                                   /* 1 after build     */
} bbm_xor_filter_t;

/**
 * Bloom Filter — handles runtime-discovered bad blocks.
 * Standard k-hash Bloom; false negatives impossible.
 */
typedef struct {
    uint8_t  bits[BBM_BLOOM_BYTES];
    uint32_t entry_count;
} bbm_bloom_filter_t;

/**
 * Top-level Bad Block Manager context.
 * Allocate statically:  static bbm_context_t bbm;
 */
typedef struct {
    bbm_xor_filter_t   xor_filter;
    bbm_bloom_filter_t bloom;
    uint8_t            initialized;
} bbm_context_t;

/* ─────────────────────────── Public API ────────────────────────────────── */

#ifdef __cplusplus
extern "C" {
#endif

/**
 * bbm_init — Build the XOR filter from a list of known bad blocks.
 *            Call once at firmware boot after scanning the bad block table.
 *
 * @param ctx        Pointer to a statically allocated bbm_context_t.
 * @param bad_blocks Array of bad block physical addresses (LBAs or PBAs).
 * @param count      Number of entries in bad_blocks[].
 * @return           BBM_OK on success, negative error code on failure.
 *
 * Time complexity: O(n)  — single pass build
 * Space:           3*n bytes for XOR fingerprints (on-chip SRAM)
 */
int bbm_init(bbm_context_t *ctx,
             const uint32_t *bad_blocks,
             uint32_t count);

/**
 * bbm_is_bad — Query whether a block address is bad.
 *              Layer 1: XOR filter (boot-time bad blocks, zero false neg)
 *              Layer 2: Bloom filter (runtime bad blocks)
 *
 * @param ctx    Initialized bbm_context_t.
 * @param block  Physical block address to test.
 * @return       1 if bad (or probable bad), 0 if definitely good.
 *
 * Time complexity: O(1) — exactly 3 XOR ops + 7 hash ops
 */
int bbm_is_bad(const bbm_context_t *ctx, uint32_t block);

/**
 * bbm_mark_bad — Register a runtime-discovered bad block.
 *               Inserts into the Bloom filter layer.
 *
 * @param ctx    Initialized bbm_context_t.
 * @param block  Physical block address newly identified as bad.
 * @return       BBM_OK always (Bloom never fails to insert).
 */
int bbm_mark_bad(bbm_context_t *ctx, uint32_t block);

/**
 * bbm_stats — Fill in diagnostic counters (for P4 OOB / P5 ML pipeline).
 *
 * @param ctx            Initialized bbm_context_t.
 * @param out_boot_bad   Bad block count known at boot (XOR filter).
 * @param out_runtime_bad  Bad blocks discovered at runtime (Bloom).
 */
void bbm_stats(const bbm_context_t *ctx,
               uint32_t *out_boot_bad,
               uint32_t *out_runtime_bad);

#ifdef __cplusplus
}
#endif

#endif /* NANDGUARD_BAD_BLOCK_MANAGER_H */
