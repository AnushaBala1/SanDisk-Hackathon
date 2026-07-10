/**
 * qm_minimizer.c — NANDGuard Logic Minimization Engine (implementation)
 *
 * Algorithm flow
 * --------------
 *  1. Build initial term list from on-set + don't-care minterms.
 *  2. Group terms by popcount (number of 1-bits) — O(n) bucket sort.
 *  3. Iterative merging: compare adjacent groups, merge differing-by-1-bit
 *     pairs into new terms.  Hash table detects duplicates in O(1).
 *     Un-merged non-DC terms are saved directly into pi_terms[].
 *  4. Collect all prime implicants (terms not merged in any round).
 *  5. Build PI-covers-minterm table.
 *  6. Greedy essential PI extraction:
 *       a. Find minterms covered by exactly one PI -> that PI is essential.
 *       b. Mark the essential PI; remove all minterms it covers.
 *       c. Repeat with remaining minterms using cost heuristic until covered.
 *  7. Populate QM_Result and return.
 *
 * Firmware constraints
 * --------------------
 *  - Zero dynamic allocation; all arrays are statically sized.
 *  - Zero floating-point operations.
 *  - No standard library beyond <stdint.h>, <stdio.h>, <string.h>.
 *  - Re-entrant safe: working buffers are static (single-context use).
 */

#include "qm_minimizer.h"

#include <stdint.h>
#include <stdio.h>    /* snprintf */
#include <string.h>   /* memset, memcpy, strlen */

/* =========================================================================
 * Internal constants
 * ========================================================================= */
#define QM_NUM_GROUPS   (QM_MAX_VARS + 1u)
#define QM_POOL_SIZE    (QM_MAX_PI * 2u)
#define HT_EMPTY32      (0xFFFFFFFFu)

/* =========================================================================
 * Static helper: popcount16
 * ========================================================================= */
static uint8_t popcount16(uint16_t v)
{
    uint8_t c = 0u;
    while (v) { v &= (uint16_t)(v - 1u); ++c; }
    return c;
}

/* =========================================================================
 * Static helper: open-addressing hash insert for (value,mask) pairs.
 * ht[]     - uint32_t array of ht_size entries, pre-filled with HT_EMPTY32.
 * key      - (value << 16) | mask  packed into 32 bits.
 * Returns 1 = inserted (new), 0 = already present (duplicate).
 * ========================================================================= */
static int ht_insert(uint32_t *ht, uint16_t ht_size, uint32_t key)
{
    /* Multiplicative hash, ht_size must be power-of-two */
    uint16_t h = (uint16_t)(
        (((uint32_t)(key >> 16) * 2654435761u) ^
         ((uint32_t)(key & 0xFFFFu) * 2246822519u))
        & (uint32_t)(ht_size - 1u));

    for (uint16_t p = 0u; p < ht_size; ++p) {
        uint16_t slot = (uint16_t)((h + p) & (uint16_t)(ht_size - 1u));
        if (ht[slot] == HT_EMPTY32) { ht[slot] = key; return 1; }
        if (ht[slot] == key)         return 0;
    }
    return 1;  /* table full -- treat as new (safe: may add extra PIs) */
}

/* =========================================================================
 * qm_init
 * ========================================================================= */
void qm_init(QM_Context *ctx, uint8_t n_vars)
{
    memset(ctx, 0, sizeof(QM_Context));
    ctx->n_vars    = (n_vars > QM_MAX_VARS) ? (uint8_t)QM_MAX_VARS : n_vars;
    ctx->hash_size = QM_MAX_PI * 4u;
}

/* =========================================================================
 * qm_add_minterm
 * ========================================================================= */
int qm_add_minterm(QM_Context *ctx, uint16_t minterm)
{
    uint16_t max = (ctx->n_vars == 16u) ? 0xFFFFu
                                        : (uint16_t)((1u << ctx->n_vars) - 1u);
    if (minterm > max) return -1;
    if (ctx->n_minterms >= QM_MAX_MINTERMS) return -1;
    ctx->minterms[ctx->n_minterms++] = minterm;
    return 0;
}

/* =========================================================================
 * qm_add_dont_care
 * ========================================================================= */
int qm_add_dont_care(QM_Context *ctx, uint16_t minterm)
{
    uint16_t max = (ctx->n_vars == 16u) ? 0xFFFFu
                                        : (uint16_t)((1u << ctx->n_vars) - 1u);
    if (minterm > max) return -1;
    if (ctx->n_dont_cares >= QM_MAX_MINTERMS) return -1;
    ctx->dont_cares[ctx->n_dont_cares++] = minterm;
    return 0;
}

/* =========================================================================
 * qm_minimize
 * ========================================================================= */
int qm_minimize(QM_Context *ctx, QM_Result *res)
{
    /* Static working storage (not re-entrant across threads, fine for MCU) */
    static QM_Term   pool_a[QM_POOL_SIZE];          /* current round  */
    static QM_Term   pool_b[QM_POOL_SIZE];          /* next round     */
    static QM_Term   pi_terms[QM_MAX_PI];           /* collected PIs  */
    static uint32_t  ht[QM_MAX_PI * 4u];            /* dedup hash tbl */
    static uint16_t  sorted_idx[QM_POOL_SIZE];      /* bucket-sort tmp*/
    static uint8_t   cover[QM_MAX_PI][QM_MAX_MINTERMS / 8u + 1u];
    static uint8_t   uncovered[QM_MAX_MINTERMS / 8u + 1u];
    static uint8_t   selected[QM_MAX_PI];

    uint16_t i, j, k;
    uint16_t n_cur, n_next, n_pi;
    uint8_t  any_merged;
    uint16_t full_mask;

    memset(res, 0, sizeof(QM_Result));
    if (!ctx || ctx->n_minterms == 0u) return 0;

    full_mask = (ctx->n_vars == 16u) ? 0xFFFFu
                                     : (uint16_t)((1u << ctx->n_vars) - 1u);

    /* ------------------------------------------------------------------
     * Step 1: build initial term pool
     * ------------------------------------------------------------------ */
    n_cur = 0u;
    for (i = 0u; i < ctx->n_minterms && n_cur < QM_POOL_SIZE; ++i) {
        pool_a[n_cur].value = ctx->minterms[i];
        pool_a[n_cur].mask  = full_mask;
        pool_a[n_cur].used  = 0u;
        pool_a[n_cur].is_dc = 0u;
        ++n_cur;
    }
    for (i = 0u; i < ctx->n_dont_cares && n_cur < QM_POOL_SIZE; ++i) {
        pool_a[n_cur].value = ctx->dont_cares[i];
        pool_a[n_cur].mask  = full_mask;
        pool_a[n_cur].used  = 0u;
        pool_a[n_cur].is_dc = 1u;
        ++n_cur;
    }

    /* ------------------------------------------------------------------
     * Steps 2-4: iterative merging, collect un-merged terms as PIs
     * ------------------------------------------------------------------ */
    n_pi = 0u;
    memset(pi_terms, 0, sizeof(pi_terms));

    do {
        memset(ht, 0xFF, sizeof(ht));  /* fill with HT_EMPTY32 */
        n_next     = 0u;
        any_merged = 0u;

        /* Bucket-sort current pool by popcount(value & mask) */
        uint16_t gc[QM_NUM_GROUPS];
        uint16_t gs[QM_NUM_GROUPS + 1u];
        memset(gc, 0, sizeof(gc));

        for (i = 0u; i < n_cur; ++i) {
            uint8_t pc = popcount16((uint16_t)(pool_a[i].value & pool_a[i].mask));
            if (pc < QM_NUM_GROUPS) gc[pc]++;
        }
        gs[0] = 0u;
        for (i = 1u; i <= QM_NUM_GROUPS; ++i)
            gs[i] = gs[i-1u] + gc[i-1u];

        uint16_t gp[QM_NUM_GROUPS];
        memcpy(gp, gs, sizeof(gp));
        for (i = 0u; i < n_cur; ++i) {
            uint8_t pc = popcount16((uint16_t)(pool_a[i].value & pool_a[i].mask));
            if (pc < QM_NUM_GROUPS)
                sorted_idx[gp[pc]++] = i;
        }

        /* Compare adjacent popcount groups */
        for (uint8_t g = 0u; g + 1u < QM_NUM_GROUPS; ++g) {
            uint16_t s0 = gs[g],     e0 = gs[g + 1u];
            uint16_t s1 = gs[g+1u],  e1 = gs[g + 2u];

            for (i = s0; i < e0; ++i) {
                QM_Term *ta = &pool_a[sorted_idx[i]];
                for (j = s1; j < e1; ++j) {
                    QM_Term *tb = &pool_a[sorted_idx[j]];

                    if (ta->mask != tb->mask) continue;

                    uint16_t diff = (uint16_t)(ta->value ^ tb->value);
                    /* Mergeable iff exactly one bit differs */
                    if (diff == 0u || (diff & (uint16_t)(diff - 1u)) != 0u) continue;
                    if ((diff & ta->mask) == 0u) continue;

                    uint16_t nv = (uint16_t)(ta->value & ~diff);
                    uint16_t nm = (uint16_t)(ta->mask  & ~diff);

                    if (n_next < QM_POOL_SIZE) {
                        uint32_t key = ((uint32_t)nv << 16u) | nm;
                        if (ht_insert(ht, (uint16_t)(QM_MAX_PI * 4u), key)) {
                            pool_b[n_next].value = nv;
                            pool_b[n_next].mask  = nm;
                            pool_b[n_next].used  = 0u;
                            pool_b[n_next].is_dc = (uint8_t)(ta->is_dc & tb->is_dc);
                            ++n_next;
                        }
                    }
                    ta->used = 1u;
                    tb->used = 1u;
                    any_merged = 1u;
                }
            }
        }

        /* Save un-merged non-DC terms as prime implicants */
        for (i = 0u; i < n_cur; ++i) {
            if (!pool_a[i].used && !pool_a[i].is_dc) {
                if (n_pi < QM_MAX_PI) {
                    pi_terms[n_pi++] = pool_a[i];
                } else {
                    res->overflow = 1u;
                }
            }
        }

        /* Swap buffers for next round */
        memcpy(pool_a, pool_b, sizeof(QM_Term) * n_next);
        n_cur = n_next;

    } while (any_merged && n_cur > 0u);

    /* Anything left in pool_a after the last round with no merges */
    for (i = 0u; i < n_cur; ++i) {
        if (!pool_a[i].is_dc && n_pi < QM_MAX_PI) {
            pi_terms[n_pi++] = pool_a[i];
        }
    }

    /* ------------------------------------------------------------------
     * Step 5: build cover table
     * cover[pi][minterm/8] bit set = PI covers that on-set minterm
     * ------------------------------------------------------------------ */
    memset(cover, 0, sizeof(cover));
    for (i = 0u; i < n_pi; ++i) {
        for (j = 0u; j < ctx->n_minterms; ++j) {
            uint16_t m = ctx->minterms[j];
            if ((m & pi_terms[i].mask) == pi_terms[i].value) {
                cover[i][j / 8u] |= (uint8_t)(1u << (j % 8u));
            }
        }
    }

    /* ------------------------------------------------------------------
     * Step 6: greedy essential PI extraction
     * ------------------------------------------------------------------ */
    memset(uncovered, 0, sizeof(uncovered));
    for (j = 0u; j < ctx->n_minterms; ++j)
        uncovered[j / 8u] |= (uint8_t)(1u << (j % 8u));

    memset(selected, 0, sizeof(selected));
    uint16_t bytes_per_row = (uint16_t)((ctx->n_minterms + 7u) / 8u);
    uint8_t changed = 1u;

    /* 6a: essential PIs — minterms covered by exactly one PI */
    while (changed) {
        changed = 0u;
        for (j = 0u; j < ctx->n_minterms; ++j) {
            uint8_t by = (uint8_t)(j / 8u);
            uint8_t bv = (uint8_t)(1u << (j % 8u));
            if (!(uncovered[by] & bv)) continue;

            uint16_t sole = QM_INVALID_IDX;
            uint16_t cnt  = 0u;
            for (i = 0u; i < n_pi; ++i) {
                if (selected[i]) continue;
                if (cover[i][by] & bv) { sole = i; if (++cnt > 1u) break; }
            }
            if (cnt == 1u && sole != QM_INVALID_IDX) {
                selected[sole]       = 1u;
                pi_terms[sole].is_dc = 2u;  /* mark essential */
                changed              = 1u;
                for (k = 0u; k < ctx->n_minterms; ++k) {
                    uint8_t bk = (uint8_t)(k / 8u);
                    uint8_t bkv = (uint8_t)(1u << (k % 8u));
                    if (cover[sole][bk] & bkv)
                        uncovered[bk] &= (uint8_t)~bkv;
                }
            }
        }
    }

    /* 6b: greedy cover for any remaining uncovered minterms */
    uint8_t any_unc = 0u;
    for (j = 0u; j < bytes_per_row; ++j) if (uncovered[j]) { any_unc = 1u; break; }

    while (any_unc) {
        uint16_t best_pi = QM_INVALID_IDX, best_sc = 0u, best_dc = 0u;
        for (i = 0u; i < n_pi; ++i) {
            if (selected[i]) continue;
            uint16_t sc = 0u;
            for (j = 0u; j < ctx->n_minterms; ++j) {
                uint8_t by = (uint8_t)(j / 8u);
                uint8_t bv = (uint8_t)(1u << (j % 8u));
                if ((uncovered[by] & bv) && (cover[i][by] & bv)) ++sc;
            }
            uint16_t dc = popcount16((uint16_t)(~pi_terms[i].mask & full_mask));
            if (sc > best_sc || (sc == best_sc && dc > best_dc)) {
                best_sc = sc; best_dc = dc; best_pi = i;
            }
        }
        if (best_pi == QM_INVALID_IDX || best_sc == 0u) break;

        selected[best_pi] = 1u;
        for (k = 0u; k < ctx->n_minterms; ++k) {
            uint8_t bk = (uint8_t)(k / 8u);
            uint8_t bkv = (uint8_t)(1u << (k % 8u));
            if (cover[best_pi][bk] & bkv)
                uncovered[bk] &= (uint8_t)~bkv;
        }

        any_unc = 0u;
        for (j = 0u; j < bytes_per_row; ++j) if (uncovered[j]) { any_unc = 1u; break; }
    }

    /* ------------------------------------------------------------------
     * Step 7: populate QM_Result
     * ------------------------------------------------------------------ */
    res->n_pi = 0u; res->n_essential = 0u; res->cover_complete = 1u;

    for (i = 0u; i < n_pi; ++i) {
        if (!selected[i]) continue;
        if (res->n_pi >= QM_MAX_PI) { res->overflow = 1u; break; }

        QM_PI *out    = &res->prime_implicants[res->n_pi++];
        out->value    = pi_terms[i].value;
        out->mask     = pi_terms[i].mask;
        out->is_essential = (pi_terms[i].is_dc == 2u) ? 1u : 0u;
        out->n_covered = 0u;
        for (j = 0u; j < ctx->n_minterms; ++j) {
            uint8_t by = (uint8_t)(j / 8u);
            uint8_t bv = (uint8_t)(1u << (j % 8u));
            if (cover[i][by] & bv) ++out->n_covered;
        }
        if (out->is_essential) ++res->n_essential;
    }

    for (j = 0u; j < bytes_per_row; ++j)
        if (uncovered[j]) { res->cover_complete = 0u; break; }

    return res->overflow ? -1 : 0;
}

/* =========================================================================
 * qm_pi_to_c_expr
 * ========================================================================= */
int qm_pi_to_c_expr(const QM_PI  *pi,
                     uint8_t       n_vars,
                     const char   *var_names[],
                     char         *buf,
                     uint16_t      buf_len)
{
    if (!pi || !buf || buf_len < 4u) return -1;

    uint16_t pos = 0u;
    uint8_t first = 1u;

    if (pos + 1u >= buf_len) return -1;
    buf[pos++] = '(';

    for (uint8_t v = 0u; v < n_vars; ++v) {
        uint16_t bit = (uint16_t)(1u << v);
        if (!(pi->mask & bit)) continue;

        if (!first) {
            if (pos + 4u >= buf_len) return -1;
            buf[pos++] = ' '; buf[pos++] = '&'; buf[pos++] = '&'; buf[pos++] = ' ';
        }
        first = 0u;

        if (!(pi->value & bit)) {
            if (pos + 1u >= buf_len) return -1;
            buf[pos++] = '!';
        }

        const char *name = var_names[v];
        uint16_t nlen = (uint16_t)strlen(name);
        if (pos + nlen >= buf_len) return -1;
        memcpy(&buf[pos], name, nlen);
        pos += nlen;
    }

    if (pos + 2u >= buf_len) return -1;
    buf[pos++] = ')';
    buf[pos]   = '\0';
    return (int)pos;
}

/* =========================================================================
 * qm_result_to_c_function
 * ========================================================================= */
int qm_result_to_c_function(const QM_Result *res,
                             uint8_t          n_vars,
                             const char      *var_names[],
                             const char      *func_name,
                             char            *buf,
                             uint32_t         buf_len)
{
    if (!res || !buf || buf_len < 64u) return -1;
    uint32_t pos = 0u;
    int w;

    w = snprintf(&buf[pos], buf_len - pos,
        "/* Auto-generated by NANDGuard QM minimizer -- do not edit */\n"
        "/* Variables: ");
    if (w < 0 || (uint32_t)w >= buf_len - pos) return -1;
    pos += (uint32_t)w;

    for (uint8_t v = 0u; v < n_vars; ++v) {
        w = snprintf(&buf[pos], buf_len - pos, "[%u]=%s ", v, var_names[v]);
        if (w < 0 || (uint32_t)w >= buf_len - pos) return -1;
        pos += (uint32_t)w;
    }

    w = snprintf(&buf[pos], buf_len - pos,
        "*/\nuint8_t %s(uint16_t input_word)\n{\n", func_name);
    if (w < 0 || (uint32_t)w >= buf_len - pos) return -1;
    pos += (uint32_t)w;

    for (uint8_t v = 0u; v < n_vars; ++v) {
        w = snprintf(&buf[pos], buf_len - pos,
            "    const uint8_t %s = (uint8_t)((input_word >> %u) & 1u);\n",
            var_names[v], v);
        if (w < 0 || (uint32_t)w >= buf_len - pos) return -1;
        pos += (uint32_t)w;
    }

    w = snprintf(&buf[pos], buf_len - pos, "    return (uint8_t)(\n");
    if (w < 0 || (uint32_t)w >= buf_len - pos) return -1;
    pos += (uint32_t)w;

    if (res->n_pi == 0u) {
        w = snprintf(&buf[pos], buf_len - pos, "        0u\n");
        if (w < 0 || (uint32_t)w >= buf_len - pos) return -1;
        pos += (uint32_t)w;
    } else {
        char expr[256];
        for (uint16_t i = 0u; i < res->n_pi; ++i) {
            int ew = qm_pi_to_c_expr(&res->prime_implicants[i],
                                     n_vars, var_names, expr, sizeof(expr));
            if (ew < 0) return -1;
            const char *sep = (i + 1u < res->n_pi) ? " ||\n" : "\n";
            w = snprintf(&buf[pos], buf_len - pos, "        %s%s", expr, sep);
            if (w < 0 || (uint32_t)w >= buf_len - pos) return -1;
            pos += (uint32_t)w;
        }
    }

    w = snprintf(&buf[pos], buf_len - pos, "    );\n}\n");
    if (w < 0 || (uint32_t)w >= buf_len - pos) return -1;
    pos += (uint32_t)w;

    return (int)pos;
}

/* =========================================================================
 * qm_dump_result (debug only)
 * ========================================================================= */
#if QMDBG
#include <stdio.h>
void qm_dump_result(const QM_Result *res, uint8_t n_vars,
                    const char *var_names[])
{
    printf("=== QM: %u PIs (%u essential) complete=%u overflow=%u ===\n",
           res->n_pi, res->n_essential, res->cover_complete, res->overflow);
    char buf[512];
    for (uint16_t i = 0u; i < res->n_pi; ++i) {
        const QM_PI *pi = &res->prime_implicants[i];
        qm_pi_to_c_expr(pi, n_vars, var_names, buf, sizeof(buf));
        printf("  PI[%u] val=0x%04X mask=0x%04X cov=%u ess=%u  %s\n",
               i, pi->value, pi->mask, pi->n_covered, pi->is_essential, buf);
    }
}
#endif
