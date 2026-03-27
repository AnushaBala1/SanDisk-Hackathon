import sys
import json

# ─── THE H-MATRIX ─────────────────────────────────────────────────────────────
# This is the parity-check matrix. It defines the relationship between
# data bits and parity bits. Each row is one parity equation.
# For 8 data bits we use 4 parity rows — this is a (12,8) code.
#
# How to read it: row 0 says "bits at positions 0,1,2,4 must XOR to 0"
# If they don't, we have an error. The column position that matches the
# syndrome tells us exactly which bit is wrong.

H = [
  # pos: 0  1  2  3  4  5  6  7  8  9 10 11   (8 data + 4 parity)
        [1, 1, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0],  # parity eq 0
        [1, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0],  # parity eq 1
        [0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0],  # parity eq 2
        [1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1],  # parity eq 3
]

NUM_PARITY = len(H)       # 4
NUM_DATA   = len(H[0]) - NUM_PARITY  # 8


def compute_syndrome(codeword):
    """
    Multiply H × codeword in GF(2) — that means mod 2 arithmetic.
    Each row of H is dot-producted with the codeword.
    If result is all zeros: no error (or even number of errors).
    If nonzero: single-bit error detected, syndrome = column of H.
    """
    syndrome = []
    for row in H:
        # dot product of this row with the codeword, mod 2
        val = 0
        for i, h in enumerate(row):
            if i < len(codeword):
                val ^= (h & codeword[i])  # XOR accumulation
        syndrome.append(val)
    return syndrome


def encode(data_bits):
    """
    Given data bits, compute parity bits so that H × codeword = 0.
    Parity bits are appended after the data bits.
    
    Each parity bit is computed so its equation in H evaluates to 0.
    """
    n_data = len(data_bits)
    parity = []

    for row_idx, row in enumerate(H):
        # The parity bit for this row is at position n_data + row_idx
        # Compute the XOR of all data positions this row cares about
        p = 0
        for col_idx in range(n_data):
            p ^= (row[col_idx] & data_bits[col_idx])
        parity.append(p)

    codeword = data_bits + parity

    # Verify our own encoding: syndrome must be all zeros
    syndrome = compute_syndrome(codeword)
    assert all(s == 0 for s in syndrome), "Encoding error — syndrome not zero"

    return {
        "codeword":   codeword,
        "dataBits":   data_bits,
        "parityBits": parity,
        "syndrome":   syndrome,
        "numData":    n_data,
        "numParity":  NUM_PARITY,
        "totalBits":  len(codeword)
    }


def detect(codeword, num_data):
    """
    Compute syndrome of received (possibly corrupted) codeword.
    If syndrome is nonzero, find which column of H it matches.
    That column index = position of the flipped bit.
    """
    syndrome = compute_syndrome(codeword)
    has_error = any(s != 0 for s in syndrome)
    error_pos = None

    if has_error:
        # Search every column of H for a match to the syndrome
        num_cols = len(H[0])
        for col in range(num_cols):
            col_vector = [H[row][col] for row in range(NUM_PARITY)]
            if col_vector == syndrome:
                error_pos = col
                break

    return {
        "syndrome":   syndrome,
        "hasError":   has_error,
        "errorPos":   error_pos,
        "syndromeAllZero": not has_error,
        "explanation": (
            f"Syndrome {syndrome} matches column {error_pos} of H — bit {error_pos} is flipped"
            if has_error and error_pos is not None
            else "Syndrome is all zeros — no error detected"
        )
    }


def correct(codeword, num_data):
    """
    1. Detect the error position using syndrome
    2. XOR that bit to flip it back
    3. Recompute syndrome to verify it is now all zeros
    4. Extract just the data bits (strip parity)
    """
    detection = detect(codeword, num_data)

    if not detection["hasError"]:
        return {
            "correctedCodeword": codeword,
            "recoveredData":     codeword[:num_data],
            "correctedPos":      None,
            "syndromeBefore":    detection["syndrome"],
            "syndromeAfter":     detection["syndrome"],
            "verified":          True,
            "message":           "No error found — data was already clean"
        }

    error_pos = detection["errorPos"]

    if error_pos is None:
        return {
            "error":    True,
            "verified": False,
            "message":  "Multi-bit error — beyond single-bit correction capability"
        }

    # Flip the bit at error_pos using XOR
    corrected = list(codeword)
    corrected[error_pos] = corrected[error_pos] ^ 1

    # Recompute syndrome — must be all zeros now
    syndrome_after = compute_syndrome(corrected)
    verified = all(s == 0 for s in syndrome_after)

    return {
        "correctedCodeword": corrected,
        "recoveredData":     corrected[:num_data],   # strip parity, return only data
        "correctedPos":      error_pos,
        "syndromeBefore":    detection["syndrome"],
        "syndromeAfter":     syndrome_after,
        "verified":          verified,
        "message": (
            f"Bit {error_pos} corrected via XOR. Syndrome recalculated = {syndrome_after}. "
            f"{'Data integrity verified.' if verified else 'WARNING: verification failed.'}"
        )
    }


def main():
    payload = json.loads(sys.argv[1])
    action  = payload["action"]

    if action == "encode":
        result = encode(payload["dataBits"])

    elif action == "detect":
        result = detect(payload["codeword"], payload["numData"])

    elif action == "correct":
        result = correct(payload["codeword"], payload["numData"])

    else:
        result = {"error": f"Unknown action: {action}"}

    print(json.dumps(result))


if __name__ == "__main__":
    main()