/**
 * NANDGuard - Bad Block Manager (P1) — Implementation
 * bad_block_manager.c
 *
 * C99, integer arithmetic only, no malloc, no heap, no floats.
 * Targets ARM Cortex-M bare-metal firmware.
 */

#include "bad_block_manager.h"

/* ══════════════════════════════════════════════════════════════════════════
 *  INTERNAL HASH PRIMITIVES
 *  All hashes are integer-only, branchless, and fit in 32-bit registers.
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * mix32 — Fast 32-bit finalizer (Murmur3-inspired).
 * Used as the base mixer for both XOR and Bloom hashes.
 */
static inline uint32_t mix32(uint32_t x)
{
    x ^= x >> 16U;
    x *= 0x45D9F3BU;
    x ^= x >> 16U;
    return x;
}

/**
 * hash_seed — Generate a salted hash for a given block address.
 * Each call with a different seed produces an independent hash.
 */
static inline uint32_t hash_seed(uint32_t block, uint32_t seed)
{
    return mix32(block ^ (seed * 0x9E3779B9U));
}

/* ══════════════════════════════════════════════════════════════════════════
 *  LAYER 1 — XOR FILTER INTERNALS
 *
 *  Construction algorithm (Binary Fuse / XOR Filter variant):
 *  1. Assign each key to 3 hash slots (one per segment).
 *  2. Peel the graph: find slots with exactly one key, assign fingerprint.
 *  3. Back-substitute to set remaining fingerprints.
 *
 *  Fingerprint for key x: fp(x) = hash_seed(x, 0) & 0xFF
 *  Stored invariant:      B[h0(x)] ^ B[h1(x)] ^ B[h2(x)] == fp(x)
 *
 *  Lookup: compute fp and 3 slot indices; XOR the 3 stored bytes;
 *          match = (result == fp).
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * xor_fingerprint — 8-bit fingerprint of a block address.
 * Must be identical at build time and lookup time.
 */
static inline uint8_t xor_fingerprint(uint32_t block)
{
    return (uint8_t)(mix32(block) & BBM_XOR_FINGERPRINT_MASK);
}

/**
 * xor_slot — Map a block to its slot index in a given segment.
 * @param block   block address
 * @param seg     segment index: 0, 1, or 2
 * @param seg_len segment length (n, padded to next power-of-2-ish)
 */
static inline uint32_t xor_slot(uint32_t block, uint32_t seg,
                                 uint32_t seg_len)
{
    /* Each segment uses a different seed to ensure independence. */
    uint32_t h = hash_seed(block, seg + 1U);
    /* Fast modulo: h % seg_len.  If seg_len is power of 2 use mask.
     * For firmware robustness we use a multiply-shift reduction. */
    return (uint32_t)(((uint64_t)h * seg_len) >> 32U);
}

/**
 * bbm_xor_build — Internal: populate fingerprint array.
 *
 * Simplified construction for firmware:
 * - Uses a stack-allocated mapping array (max BBM_XOR_MAX_ENTRIES).
 * - Single-pass peeling with a queue stored in the same stack array.
 * - All integer, no dynamic allocation.
 *
 * Returns 0 on success, -1 if construction failed (retry with larger n).
 */
static int bbm_xor_build(bbm_xor_filter_t *f,
                          const uint32_t   *keys,
                          uint32_t          n)
{
    /*
     * seg_len must be at least ceil(n / 3) * 1.23 for the XOR filter
     * construction to succeed with high probability.
     * We use seg_len = (n * 5) / 4 + 4  (a safe over-allocation).
     */
    uint32_t seg_len = (n * 5U) / 4U + 4U;
    if (seg_len * 3U > BBM_XOR_MAX_ENTRIES * 3U) {
        seg_len = BBM_XOR_MAX_ENTRIES;
    }
    f->segment_len = seg_len;
    f->entry_count = n;

    /* --- Step 1: Count how many keys map to each slot --- */

    /* count[i] = number of keys whose slot in segment s is i */
    static uint8_t  count[BBM_XOR_MAX_ENTRIES * 3U];
    static uint32_t xor_val[BBM_XOR_MAX_ENTRIES * 3U];

    /* Zero the working arrays — explicit loop for embedded targets */
    for (uint32_t i = 0U; i < seg_len * 3U; i++) {
        count[i]   = 0U;
        xor_val[i] = 0U;
    }
    /* Zero fingerprint output */
    for (uint32_t i = 0U; i < seg_len * 3U; i++) {
        f->fingerprints[i] = 0U;
    }

    for (uint32_t k = 0U; k < n; k++) {
        for (uint32_t seg = 0U; seg < 3U; seg++) {
            uint32_t slot = xor_slot(keys[k], seg, seg_len)
                            + seg * seg_len;
            count[slot]++;
            xor_val[slot] ^= keys[k];
        }
    }

    /* --- Step 2: Queue slots with exactly one key (peeling) --- */
    static uint32_t queue[BBM_XOR_MAX_ENTRIES * 3U];
    uint32_t q_head = 0U, q_tail = 0U;

    for (uint32_t i = 0U; i < seg_len * 3U; i++) {
        if (count[i] == 1U) {
            queue[q_tail++] = i;
        }
    }

    /* --- Step 3: Assign order array by peeling --- */
    static uint32_t order[BBM_XOR_MAX_ENTRIES];   /* key indices, in peel order */
    static uint32_t order_slot[BBM_XOR_MAX_ENTRIES]; /* which slot peeled it */
    uint32_t filled = 0U;

    while (q_head < q_tail && filled < n) {
        uint32_t slot = queue[q_head++];
        if (count[slot] != 1U) continue;

        uint32_t key    = xor_val[slot];
        order[filled]      = key;
        order_slot[filled] = slot;
        filled++;

        /* Remove this key from the other two segments */
        uint32_t seg_of_slot = slot / seg_len;
        for (uint32_t seg = 0U; seg < 3U; seg++) {
            if (seg == seg_of_slot) continue;
            uint32_t other = xor_slot(key, seg, seg_len) + seg * seg_len;
            count[other]--;
            xor_val[other] ^= key;
            if (count[other] == 1U) {
                queue[q_tail++] = other;
            }
        }
        count[slot] = 0U;
    }

    if (filled < n) {
        /* Construction failed — shouldn't happen with seg_len formula above */
        return -1;
    }

    /* --- Step 4: Back-assign fingerprints in reverse peel order --- */
    for (int32_t i = (int32_t)n - 1; i >= 0; i--) {
        uint32_t key  = order[i];
        uint32_t slot = order_slot[i];
        uint8_t  fp   = xor_fingerprint(key);

        /* fp[slot] = fp(key) ^ fp[other_slot_0] ^ fp[other_slot_1] */
        uint32_t seg_of_slot = slot / seg_len;
        uint8_t  xor_others  = 0U;
        for (uint32_t seg = 0U; seg < 3U; seg++) {
            if (seg == seg_of_slot) continue;
            uint32_t other = xor_slot(key, seg, seg_len) + seg * seg_len;
            xor_others ^= f->fingerprints[other];
        }
        f->fingerprints[slot] = fp ^ xor_others;
    }

    f->ready = 1U;
    return 0;
}

/**
 * xor_query — Check if block is in the XOR filter.
 * Returns 1 if present (zero false negatives), 0 if absent.
 */
static inline int xor_query(const bbm_xor_filter_t *f, uint32_t block)
{
    if (!f->ready) return 0;

    uint32_t s0 = xor_slot(block, 0U, f->segment_len);
    uint32_t s1 = xor_slot(block, 1U, f->segment_len) + f->segment_len;
    uint32_t s2 = xor_slot(block, 2U, f->segment_len) + f->segment_len * 2U;

    uint8_t result = f->fingerprints[s0]
                   ^ f->fingerprints[s1]
                   ^ f->fingerprints[s2];

    return (result == xor_fingerprint(block)) ? 1 : 0;
}

/* ══════════════════════════════════════════════════════════════════════════
 *  LAYER 2 — BLOOM FILTER INTERNALS
 *
 *  Standard k-hash Bloom filter.
 *  k = BBM_BLOOM_HASH_COUNT = 7
 *  m = BBM_BLOOM_BITS       = 131072  (16 KB)
 *
 *  Each of the 7 hash functions is hash_seed(block, i) & BBM_BLOOM_MASK.
 *  Bit is set using byte array: bits[idx >> 3] |= (1 << (idx & 7))
 * ══════════════════════════════════════════════════════════════════════════ */

static inline void bloom_set(bbm_bloom_filter_t *b, uint32_t block)
{
    for (uint32_t i = 0U; i < BBM_BLOOM_HASH_COUNT; i++) {
        uint32_t idx = hash_seed(block, i + 10U) & BBM_BLOOM_MASK;
        b->bits[idx >> 3U] |= (uint8_t)(1U << (idx & 7U));
    }
    b->entry_count++;
}

static inline int bloom_test(const bbm_bloom_filter_t *b, uint32_t block)
{
    for (uint32_t i = 0U; i < BBM_BLOOM_HASH_COUNT; i++) {
        uint32_t idx = hash_seed(block, i + 10U) & BBM_BLOOM_MASK;
        if (!(b->bits[idx >> 3U] & (uint8_t)(1U << (idx & 7U)))) {
            return 0;  /* definitely not bad */
        }
    }
    return 1;  /* probably bad */
}

/* ══════════════════════════════════════════════════════════════════════════
 *  PUBLIC API IMPLEMENTATION
 * ══════════════════════════════════════════════════════════════════════════ */

int bbm_init(bbm_context_t  *ctx,
             const uint32_t *bad_blocks,
             uint32_t        count)
{
    if (!ctx || !bad_blocks) return BBM_ERR_NULL;
    if (count > BBM_XOR_MAX_ENTRIES) return BBM_ERR_TOO_MANY;

    /* Clear the Bloom filter bits */
    for (uint32_t i = 0U; i < BBM_BLOOM_BYTES; i++) {
        ctx->bloom.bits[i] = 0U;
    }
    ctx->bloom.entry_count = 0U;

    /* Build XOR filter from the boot-time bad block list */
    int rc = bbm_xor_build(&ctx->xor_filter, bad_blocks, count);
    if (rc != 0) return rc;

    ctx->initialized = 1U;
    return BBM_OK;
}

int bbm_is_bad(const bbm_context_t *ctx, uint32_t block)
{
    if (!ctx || !ctx->initialized) return 0;

    /* Layer 1: XOR filter — zero false negatives for boot-time bad blocks */
    if (xor_query(&ctx->xor_filter, block)) return 1;

    /* Layer 2: Bloom filter — covers runtime-discovered bad blocks */
    if (bloom_test(&ctx->bloom, block)) return 1;

    return 0;
}

int bbm_mark_bad(bbm_context_t *ctx, uint32_t block)
{
    if (!ctx || !ctx->initialized) return BBM_ERR_NOT_INIT;
    bloom_set(&ctx->bloom, block);
    return BBM_OK;
}

void bbm_stats(const bbm_context_t *ctx,
               uint32_t *out_boot_bad,
               uint32_t *out_runtime_bad)
{
    if (!ctx) return;
    if (out_boot_bad)    *out_boot_bad    = ctx->xor_filter.entry_count;
    if (out_runtime_bad) *out_runtime_bad = ctx->bloom.entry_count;
}
