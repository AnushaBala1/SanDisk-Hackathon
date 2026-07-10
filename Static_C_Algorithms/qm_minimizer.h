/**
 * qm_minimizer.h — NANDGuard Logic Minimization Engine
 *
 * Quine-McCluskey Boolean minimizer redesigned for firmware constraints:
 *   - Integer-only arithmetic, zero floats
 *   - Fixed static arrays, zero malloc / heap
 *   - Up to QM_MAX_VARS (16) input variables
 *   - Up to QM_MAX_MINTERMS (65536) minterms  (2^16)
 *   - Three firmware-aware optimisations over standard QM:
 *       1. Hash-based minterm merging   (O(1) duplicate detection)
 *       2. Greedy essential PI extraction
 *       3. Don't-care propagation with firmware-safe defaults
 *
 * Output: a minimised PI table that the caller converts to C decision logic.
 *
 * Usage pattern
 * -------------
 *   QM_Context ctx;
 *   qm_init(&ctx);
 *   qm_add_minterm(&ctx, 3);          // on-set minterms
 *   qm_add_minterm(&ctx, 5);
 *   qm_add_dont_care(&ctx, 7);        // don't-care minterms
 *   QM_Result res;
 *   qm_minimize(&ctx, &res);
 *   // res.prime_implicants[i]  holds each PI as (mask, value) pair
 *
 * Compile:  arm-none-eabi-gcc -std=c99 -O2 -Wall qm_minimizer.c
 */

#ifndef QM_MINIMIZER_H
#define QM_MINIMIZER_H

#include <stdint.h>

/* =========================================================================
 * Tuneable limits — all resolved at compile time, no heap involved
 * ========================================================================= */

/** Maximum number of Boolean input variables (≤ 16, matches uint16_t width). */
#define QM_MAX_VARS       16u

/** Maximum minterms = 2^QM_MAX_VARS */
#define QM_MAX_MINTERMS   (1u << QM_MAX_VARS)   /* 65 536 */

/**
 * Maximum prime implicants the engine will store.
 * In the worst case PIs ≈ minterms, but firmware tables need a hard ceiling.
 * 512 is generous for any real firmware Boolean with ≤ 16 inputs.
 */
#define QM_MAX_PI         512u

/**
 * Maximum literals per PI term (used for petrick / greedy cover output).
 * Equals QM_MAX_VARS (one bit per variable).
 */
#define QM_MAX_LITERALS   QM_MAX_VARS

/* =========================================================================
 * Sentinel / magic values
 * ========================================================================= */
#define QM_DC_BIT         0xFFFFu   /* "don't-care" marker in a mask word    */
#define QM_INVALID_IDX    0xFFFFu   /* used to mark empty slots              */

/* =========================================================================
 * Core data types
 * ========================================================================= */

/**
 * A single minterm or implicant.
 *
 *  value  — the bit pattern of the term (0/1 per variable)
 *  mask   — which bits are significant; a 0-bit means "don't care" for that
 *            variable in the term.  For a plain minterm, mask = (1<<n_vars)-1.
 *  used   — internal flag: has this term been merged upward in a QM round?
 *  is_dc  — is this a don't-care minterm (not required in cover)?
 */
typedef struct {
    uint16_t value;
    uint16_t mask;
    uint8_t  used;
    uint8_t  is_dc;
} QM_Term;

/**
 * A prime implicant as returned to the caller.
 *
 *  value     — bit pattern for the covered variables
 *  mask      — 1-bit = variable is significant in this PI
 *  n_covered — how many on-set minterms this PI covers
 *  is_essential — set by greedy extraction when this PI is the sole cover
 *                 of at least one minterm
 */
typedef struct {
    uint16_t value;
    uint16_t mask;
    uint16_t n_covered;
    uint8_t  is_essential;
} QM_PI;

/**
 * Working context — caller allocates one of these on the stack or as a
 * static/global; the engine writes into it.  Zero-initialise before use
 * (or call qm_init()).
 */
typedef struct {
    /* Input: minterms and don't-cares submitted by the caller */
    uint16_t minterms[QM_MAX_MINTERMS];
    uint16_t n_minterms;

    uint16_t dont_cares[QM_MAX_MINTERMS];
    uint16_t n_dont_cares;

    uint8_t  n_vars;   /* actual variable count for this invocation */

    /* Internal working storage — flat pool of QM_Term objects */
    QM_Term  terms[QM_MAX_PI * 2u];   /* double-buffered current / next */
    uint16_t n_terms;

    /* Hash table for O(1) duplicate detection during merge */
    uint16_t hash_table[QM_MAX_PI * 4u];  /* open-addressing, load < 0.5 */
    uint16_t hash_size;                   /* always a power of two        */
} QM_Context;

/**
 * Result handed back to the caller after qm_minimize().
 */
typedef struct {
    QM_PI    prime_implicants[QM_MAX_PI];
    uint16_t n_pi;           /* total PIs found                     */
    uint16_t n_essential;    /* subset flagged is_essential == 1     */
    uint8_t  cover_complete; /* 1 = essential PIs cover all minterms */
    uint8_t  overflow;       /* 1 = PI table was full; result is partial */
} QM_Result;

/* =========================================================================
 * Public API
 * ========================================================================= */

/**
 * qm_init — zero-initialise a context and set default variable count.
 *
 * @param ctx     Pointer to caller-allocated QM_Context.
 * @param n_vars  Number of input variables (1 … QM_MAX_VARS).
 */
void qm_init(QM_Context *ctx, uint8_t n_vars);

/**
 * qm_add_minterm — add an on-set minterm index.
 *
 * @param ctx     Initialised context.
 * @param minterm Index (0 … 2^n_vars − 1).
 * @return 0 on success, -1 if table is full or index out of range.
 */
int  qm_add_minterm(QM_Context *ctx, uint16_t minterm);

/**
 * qm_add_dont_care — add a don't-care minterm index.
 *
 * @param ctx     Initialised context.
 * @param minterm Index (0 … 2^n_vars − 1).
 * @return 0 on success, -1 if table is full or index out of range.
 */
int  qm_add_dont_care(QM_Context *ctx, uint16_t minterm);

/**
 * qm_minimize — run the full QM + greedy cover algorithm.
 *
 * Populates *res with the prime-implicant cover.
 * The function is pure (no global state) and re-entrant.
 *
 * @param ctx  Populated context (minterms + don't-cares added).
 * @param res  Output result struct (written by this call).
 * @return 0 on success, -1 on internal overflow (res->overflow set).
 */
int  qm_minimize(QM_Context *ctx, QM_Result *res);

/**
 * qm_pi_to_c_expr — render a single PI as a C boolean sub-expression.
 *
 * Writes a null-terminated string like:
 *   "(!wear_level && gc_pending && !oob_flag)"
 *
 * Variable names are taken from the var_names array (length must be n_vars).
 *
 * @param pi        Prime implicant to render.
 * @param n_vars    Number of variables.
 * @param var_names Array of n_vars C identifier strings.
 * @param buf       Output buffer.
 * @param buf_len   Size of output buffer in bytes.
 * @return Number of characters written (excluding NUL), or -1 on overflow.
 */
int  qm_pi_to_c_expr(const QM_PI   *pi,
                      uint8_t        n_vars,
                      const char    *var_names[],
                      char          *buf,
                      uint16_t       buf_len);

/**
 * qm_result_to_c_function — emit a complete C function body (as a string)
 * implementing the minimised Boolean expression.
 *
 * The emitted function has signature:
 *   uint8_t <func_name>(uint16_t input_word);
 * where input_word packs all variables into bits [0..n_vars-1].
 *
 * @param res       Minimisation result.
 * @param n_vars    Variable count.
 * @param var_names Variable name array (for comments).
 * @param func_name C function name to emit.
 * @param buf       Output character buffer.
 * @param buf_len   Buffer size.
 * @return Characters written, or -1 on overflow.
 */
int  qm_result_to_c_function(const QM_Result *res,
                              uint8_t          n_vars,
                              const char      *var_names[],
                              const char      *func_name,
                              char            *buf,
                              uint32_t         buf_len);

/* =========================================================================
 * Utility / diagnostic helpers (compile out with -DQMDBG=0)
 * ========================================================================= */
#ifndef QMDBG
#  define QMDBG 0
#endif

#if QMDBG
/**
 * qm_dump_result — print all PIs to stdout (requires stdio — do NOT link
 * in bare-metal builds; gate with QMDBG).
 */
void qm_dump_result(const QM_Result *res, uint8_t n_vars,
                    const char *var_names[]);
#endif /* QMDBG */

#endif /* QM_MINIMIZER_H */
