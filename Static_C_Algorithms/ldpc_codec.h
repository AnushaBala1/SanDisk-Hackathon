/**
 * NANDGuard - Simplified LDPC Codec (P3)
 * ldpc_codec.h
 */

#ifndef NANDGUARD_LDPC_CODEC_H
#define NANDGUARD_LDPC_CODEC_H

#include <stdint.h>

#define LDPC_K              64U
#define LDPC_PARITY_BITS    8U
#define LDPC_N              (LDPC_K + LDPC_PARITY_BITS)
#define LDPC_M              LDPC_PARITY_BITS
#define LDPC_MAX_ROW_WEIGHT 32U

#define LDPC_OK                 0
#define LDPC_ERR_NULL          (-1)
#define LDPC_ERR_UNCORRECTABLE (-2)

typedef struct {
    uint8_t  cols[LDPC_M][LDPC_MAX_ROW_WEIGHT];
    uint8_t  row_weight[LDPC_M];
} ldpc_hmatrix_t;

typedef struct {
    ldpc_hmatrix_t H;
    uint8_t        initialized;
} ldpc_context_t;

typedef struct {
    uint8_t bytes[(LDPC_N + 7U) / 8U];
} ldpc_codeword_t;

#ifdef __cplusplus
extern "C" {
#endif

int ldpc_init(ldpc_context_t *ctx);
int ldpc_encode(const ldpc_context_t *ctx, const uint8_t *data, ldpc_codeword_t *cw);
int ldpc_decode(const ldpc_context_t *ctx, ldpc_codeword_t *cw, uint8_t *corrected, uint32_t *errors_corrected);
int ldpc_syndrome(const ldpc_context_t *ctx, const ldpc_codeword_t *cw, uint8_t *syndrome);

/* Bit flip helper - declared here for use in main.c */
void bit_flip(uint8_t *buf, uint32_t pos);

#ifdef __cplusplus
}
#endif

#endif /* NANDGUARD_LDPC_CODEC_H */
