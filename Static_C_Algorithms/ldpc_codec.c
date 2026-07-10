/**
 * NANDGuard - Simplified LDPC Codec (P3) — Implementation
 */

#include "ldpc_codec.h"

/* BIT HELPERS */
static inline uint8_t bit_get(const uint8_t *buf, uint32_t pos)
{
    return (buf[pos >> 3U] >> (pos & 7U)) & 1U;
}

static inline void bit_set(uint8_t *buf, uint32_t pos, uint8_t val)
{
    if (val)
        buf[pos >> 3U] |= (uint8_t)(1U << (pos & 7U));
    else
        buf[pos >> 3U] &= (uint8_t)~(1U << (pos & 7U));
}

/* Bit flip - declared non-static so main.c can use it */
void bit_flip(uint8_t *buf, uint32_t pos)
{
    buf[pos >> 3U] ^= (uint8_t)(1U << (pos & 7U));
}

/* H-MATRIX DEFINITION */
static void build_hmatrix(ldpc_hmatrix_t *H)
{
    uint32_t r, c, w;
    for (r = 0U; r < LDPC_M; r++) {
        w = 0U;
        for (c = 0U; c < LDPC_K; c++) {
            if ((c % LDPC_M) == r && w < LDPC_MAX_ROW_WEIGHT) {
                H->cols[r][w++] = (uint8_t)c;
            }
        }
        if (w < LDPC_MAX_ROW_WEIGHT) {
            H->cols[r][w++] = (uint8_t)(LDPC_K + r);
        }
        H->row_weight[r] = (uint8_t)w;
    }
}

/* ROW PARITY */
static uint8_t row_parity(const ldpc_hmatrix_t *H, uint32_t row, const ldpc_codeword_t *cw)
{
    uint8_t p = 0U;
    uint32_t j;
    for (j = 0U; j < H->row_weight[row]; j++) {
        p ^= bit_get(cw->bytes, H->cols[row][j]);
    }
    return p;
}

/* PUBLIC API */
int ldpc_init(ldpc_context_t *ctx)
{
    if (!ctx) return LDPC_ERR_NULL;
    build_hmatrix(&ctx->H);
    ctx->initialized = 1U;
    return LDPC_OK;
}

int ldpc_encode(const ldpc_context_t *ctx, const uint8_t *data, ldpc_codeword_t *cw)
{
    if (!ctx || !data || !cw) return LDPC_ERR_NULL;

    uint32_t i, r;
    for (i = 0U; i < sizeof(cw->bytes); i++) cw->bytes[i] = 0U;

    for (i = 0U; i < LDPC_K; i++) {
        bit_set(cw->bytes, i, bit_get(data, i));
    }

    for (r = 0U; r < LDPC_M; r++) {
        uint8_t p = 0U;
        for (uint32_t j = 0U; j < ctx->H.row_weight[r]; j++) {
            uint8_t col = ctx->H.cols[r][j];
            if (col < LDPC_K) {
                p ^= bit_get(cw->bytes, col);
            }
        }
        bit_set(cw->bytes, LDPC_K + r, p);
    }
    return LDPC_OK;
}

int ldpc_syndrome(const ldpc_context_t *ctx, const ldpc_codeword_t *cw, uint8_t *syndrome)
{
    if (!ctx || !cw || !syndrome) return LDPC_ERR_NULL;

    uint8_t any_nonzero = 0U;
    for (uint32_t r = 0U; r < LDPC_M; r++) {
        syndrome[r] = row_parity(&ctx->H, r, cw);
        any_nonzero |= syndrome[r];
    }
    return any_nonzero ? 1 : 0;
}

int ldpc_decode(const ldpc_context_t *ctx, ldpc_codeword_t *cw, uint8_t *corrected, uint32_t *errors_corrected)
{
    if (!ctx || !cw || !corrected) return LDPC_ERR_NULL;

    uint8_t syndrome[LDPC_M];
    uint8_t errors = 0U;
    uint32_t r, col, j;

    for (r = 0U; r < LDPC_M; r++) {
        syndrome[r] = row_parity(&ctx->H, r, cw);
        errors |= syndrome[r];
    }

    uint32_t flipped = 0U;

    if (errors) {
        uint8_t found = 0U;
        uint32_t err_pos = 0U;

        for (col = 0U; col < LDPC_N && !found; col++) {
            uint8_t match = 1U;
            for (r = 0U; r < LDPC_M; r++) {
                uint8_t h_rc = 0U;
                for (j = 0U; j < ctx->H.row_weight[r]; j++) {
                    if (ctx->H.cols[r][j] == (uint8_t)col) {
                        h_rc = 1U;
                        break;
                    }
                }
                if (h_rc != syndrome[r]) {
                    match = 0U;
                    break;
                }
            }
            if (match) {
                err_pos = col;
                found = 1U;
            }
        }

        if (!found) {
            if (errors_corrected) *errors_corrected = 0U;
            return LDPC_ERR_UNCORRECTABLE;
        }

        bit_flip(cw->bytes, err_pos);
        flipped = 1U;

        uint8_t verify_syndrome[LDPC_M];
        uint8_t still_bad = 0U;
        for (r = 0U; r < LDPC_M; r++) {
            verify_syndrome[r] = row_parity(&ctx->H, r, cw);
            still_bad |= verify_syndrome[r];
        }

        if (still_bad) {
            if (errors_corrected) *errors_corrected = 0U;
            return LDPC_ERR_UNCORRECTABLE;
        }
    }

    /* Extract corrected data */
    for (col = 0U; col < (LDPC_K + 7U) / 8U; col++) {
        corrected[col] = 0U;
    }
    for (col = 0U; col < LDPC_K; col++) {
        uint8_t b = bit_get(cw->bytes, col);
        corrected[col >> 3U] |= (uint8_t)(b << (col & 7U));
    }

    if (errors_corrected) *errors_corrected = flipped;
    return LDPC_OK;
}
