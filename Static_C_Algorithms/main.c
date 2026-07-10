/*
 * main.c - NANDGuard Full Firmware (P1 to P5) + Watchdog Demo
 */

#include <stdio.h>
#include "platform.h"
#include "xil_printf.h"
#include "xil_io.h"
#include "sleep.h"

// P1 - Bad Block Manager
#include "bad_block_manager.h"

// P2 - Logic Optimisation
#include "logic_functions.h"

// P3 - LDPC Codec
#include "ldpc_codec.h"

// P4 - OOB Communication
#include "oob_comms.h"

// P5 - NandGuard ML
#include "nandguard_inference.h"

// ================================================
// Helper
// ================================================
static inline void test_bit_flip(uint8_t *buf, uint32_t pos)
{
    buf[pos >> 3U] ^= (uint8_t)(1U << (pos & 7U));
}

// OOB stubs
void oob_send_alert(const char *msg)
{
    xil_printf("[P4 OOB] ALERT: %s\r\n", msg ? msg : "Unknown failure");
}

void oob_send_packet(int risk_pct, uint32_t bad_blocks, int severity)
{
    xil_printf("[P4 OOB] Packet -> Risk=%d%%, BadBlocks=%u, Severity=%d\r\n",
               risk_pct, bad_blocks, severity);
}

// Globals
static bbm_context_t     bbm_ctx;
static ldpc_context_t    ldpc_ctx;
static ng_drive_state_t  ng_state;

#define NAND_BASE     0x40000000U
#define BLOCK_SIZE    4U

// ================================================
// Safe R/W
// ================================================
int safe_write(uint32_t block, uint32_t data)
{
    if (bbm_is_bad(&bbm_ctx, block)) {
        xil_printf("[P1] WRITE BLOCKED: Bad Block %u\r\n", block);
        return -1;
    }
    Xil_Out32(NAND_BASE + block * BLOCK_SIZE, data);
    return 0;
}

int safe_read(uint32_t block, uint32_t *data)
{
    if (bbm_is_bad(&bbm_ctx, block)) {
        xil_printf("[P1] READ BLOCKED: Bad Block %u\r\n", block);
        return -1;
    }
    *data = Xil_In32(NAND_BASE + block * BLOCK_SIZE);
    return 0;
}

// ================================================
// MAIN
// ================================================
int main(void)
{
    init_platform();

    xil_printf("\r\n========================================\r\n");
    xil_printf("       NANDGuard Full System (P1-P5)\r\n");
    xil_printf("========================================\r\n\r\n");

    // P1
    uint32_t boot_bad_blocks[] = {10, 20, 30, 50};
    bbm_init(&bbm_ctx, boot_bad_blocks, 4);
    xil_printf("[P1] Bad Block Manager Initialized\r\n");

    // P3
    ldpc_init(&ldpc_ctx);
    xil_printf("[P3] LDPC Codec Initialized\r\n");

    // P5
    nandguard_init(&ng_state);
    xil_printf("[P5] NandGuard ML Engine Initialized\r\n");

    // STEP 1
    xil_printf("\r\n[STEP 1] Normal Write/Read Test\r\n");
    safe_write(5, 0xDEADBEEF);

    uint32_t data = 0;
    if (safe_read(5, &data) == 0) {
        xil_printf("[STEP 1] Block 5 read: 0x%08X\r\n", data);
    }

    // STEP 2
    xil_printf("\r\n[STEP 2] Runtime Bad Block Test\r\n");
    bbm_mark_bad(&bbm_ctx, 100);

    uint32_t boot_bad, runtime_bad;
    bbm_stats(&bbm_ctx, &boot_bad, &runtime_bad);
    xil_printf("[P1] Total bad blocks = %u\r\n", boot_bad + runtime_bad);

    // STEP 3
    xil_printf("\r\n[STEP 3] LDPC Error Correction Test\r\n");

    uint8_t test_data[8] = {0xAA,0x55,0xAA,0x55,0xAA,0x55,0xAA,0x55};
    ldpc_codeword_t cw = {0};

    ldpc_encode(&ldpc_ctx, test_data, &cw);
    test_bit_flip(cw.bytes, 5);

    uint8_t corrected[8] = {0};
    uint32_t errors_fixed = 0;

    int ldpc_ret = ldpc_decode(&ldpc_ctx, &cw, corrected, &errors_fixed);

    if (ldpc_ret == LDPC_OK) {
        xil_printf("[P3] LDPC Success: %u bit(s) corrected\r\n", errors_fixed);
    } else {
        xil_printf("[P3] LDPC Uncorrectable!\r\n");
        oob_send_alert("LDPC FAILURE");
    }

    // STEP 4/5
    xil_printf("\r\n[STEP 4/5] ML + Logic Optimisation\r\n");

    ng_smart_reading_t smart = {
        .smart_9 = 15420, .smart_12 = 167, .smart_170 = 480,
        .smart_173 = 1350, .smart_174 = 28, .smart_177 = 22,
        .smart_194 = 45, .smart_233 = 92,
        .smart_241 = 456789012, .smart_242 = 312456789
    };

    ng_status_t ml_status = nandguard_update(&ng_state, &smart);

    uint16_t logic_input = lf_pack(
        (boot_bad + runtime_bad > 500),
        0,0,
        (boot_bad + runtime_bad > 100),
        0,
        (ml_status == NG_STATUS_ALERT),
        (boot_bad + runtime_bad > 50),
        0,
        (smart.smart_194 > 65),
        0,0
    );

    uint8_t do_gc = gc_trigger(logic_input);
    uint8_t do_wear = wear_level_trigger(logic_input);
    uint8_t do_alert = oob_alert_trigger(logic_input);

    xil_printf("[P2] GC Trigger      : %s\r\n", do_gc ? "YES":"NO");
    xil_printf("[P2] Wear Level      : %s\r\n", do_wear ? "YES":"NO");
    xil_printf("[P2] OOB Alert       : %s\r\n", do_alert ? "YES":"NO");

    if (ml_status == NG_STATUS_ALERT || do_alert) {
        xil_printf("[P5+P2] *** CRITICAL ALERT - Sending OOB ***\r\n");
        oob_send_packet(88, boot_bad + runtime_bad, 2);
        oob_send_alert("DRIVE FAILURE PREDICTED");
    } else {
        xil_printf("[P5] Drive is HEALTHY\r\n");
    }

    // ============================================
    // 🔥 NEW: WATCHDOG + OS CRASH DEMO
    // ============================================

    xil_printf("\r\n[DEMO] Starting Heartbeat Monitoring...\r\n");

    int heartbeat = 0;
    int simulate_crash = 0;

    while(1)
    {
        if (!simulate_crash)
        {
            xil_printf("[HEARTBEAT] System Alive\r\n");
            sleep(1);
            heartbeat++;

            // After 5 cycles → simulate crash
            if (heartbeat == 5)
            {
                simulate_crash = 1;
                xil_printf("\r\n[DEMO] Simulating HOST OS CRASH...\r\n");
            }
        }
        else
        {
            // No heartbeat → watchdog detects
            sleep(2);

            xil_printf("[WATCHDOG] No response detected...\r\n");
            xil_printf("[ALERT] HOST OS DEAD\r\n");

            // Trigger NANDGuard safety
            oob_send_alert("HOST OS FAILURE");
            oob_send_packet(95, boot_bad + runtime_bad, 3);

            xil_printf("[NANDGuard] SAFE MODE ACTIVATED\r\n");

            while(1); // stop demo here
        }
    }

    cleanup_platform();
    return 0;
}
