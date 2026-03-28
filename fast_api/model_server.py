# model_server.py  —  Python FastAPI inference server
# Run: uvicorn model_server:app --port 8001 --reload

import os, io, json, asyncio
import pandas as pd
import joblib
from xgboost import XGBClassifier
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import json

# ── BOOT ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="SSD Failure Model Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model + feature list once at startup
model = joblib.load("nandguard_fw.joblib")          # <-- your saved model
with open("nandguard_fw_feature_cols.json") as f:
    feature_cols = json.load(f)  # <-- your saved feature list

print(f"[model_server] Model loaded. Expecting {len(feature_cols)} features.")

# ── HELPERS ───────────────────────────────────────────────────────────────────
def score_row(row: dict) -> dict:
    """Score a single row dict. Missing features filled with 0."""
    df = pd.DataFrame([row])
    for col in feature_cols:
        if col not in df.columns:
            df[col] = 0
    df = df[feature_cols]                           # enforce exact column order

    prob  = float(model.predict_proba(df)[0][1])
    label = int(model.predict(df)[0])
    risk  = "HIGH" if prob > 0.7 else "MEDIUM" if prob > 0.3 else "LOW"

    return {
        "prob" : round(prob, 4),
        "label": label,
        "risk" : risk,
    }

def parse_upload(contents: bytes) -> pd.DataFrame:
    """Read uploaded CSV bytes → DataFrame sorted by date/drive_age_days."""
    df = pd.read_csv(io.StringIO(contents.decode("utf-8", errors="replace")))

    # Sort rows chronologically if possible
    for sort_col in ["date", "drive_age_days"]:
        if sort_col in df.columns:
            df = df.sort_values(sort_col).reset_index(drop=True)
            break

    return df

# ── ROUTES ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "features": len(feature_cols)}


@app.post("/score")
async def score_latest(file: UploadFile = File(...)):
    """
    Upload a drive CSV → returns the score for the LATEST row only.
    Used to show an instant risk badge on the card after upload.
    """
    contents = await file.read()
    try:
        df = parse_upload(contents)
    except Exception as e:
        raise HTTPException(400, f"Could not parse CSV: {e}")

    if df.empty:
        raise HTTPException(400, "CSV is empty")

    latest = df.iloc[-1].to_dict()
    result = score_row(latest)

    # Pull a few SMART vitals for the UI card
    result["total_days"] = len(df)
    result["temp"]       = float(latest.get("smart_194_raw", 0))
    result["hours"]      = float(latest.get("smart_9_raw",   0))
    result["realloc"]    = float(latest.get("smart_5_raw",   0))
    result["wear"]       = float(latest.get("smart_177_raw", 0))

    return result


@app.post("/stream")
async def stream_drive(
    file: UploadFile = File(...),
    interval: float  = 0.12,       # seconds between rows; lower = faster replay
):
    """
    Upload a drive CSV → streams each row scored as SSE events.
    Frontend receives: data: { day, prob, risk, temp, hours, realloc, wear, done }
    """
    contents = await file.read()
    try:
        df = parse_upload(contents)
    except Exception as e:
        raise HTTPException(400, f"Could not parse CSV: {e}")

    if df.empty:
        raise HTTPException(400, "CSV is empty")

    total = len(df)

    async def generate():
        for i, (_, row) in enumerate(df.iterrows()):
            row_dict = row.to_dict()
            scored   = score_row(row_dict)

            event = {
                **scored,
                "day"    : int(row_dict.get("drive_age_days", i + 1)),
                "temp"   : float(row_dict.get("smart_194_raw", 0)),
                "hours"  : float(row_dict.get("smart_9_raw",   0)),
                "realloc": float(row_dict.get("smart_5_raw",   0)),
                "wear"   : float(row_dict.get("smart_177_raw", 0)),
                "index"  : i,
                "total"  : total,
                "done"   : False,
            }
            yield f"data: {json.dumps(event)}\n\n"
            await asyncio.sleep(interval)

        yield 'data: {"done": true}\n\n'

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # important for nginx proxies
        },
    )
