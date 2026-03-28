# oob_sim.py — NANDGuard OOB FastAPI Telemetry Server

import asyncio
import random
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import List

app = FastAPI(title="NANDGuard OOB Simulator")

# ─────────────────────────────────────────────────────────────
# In-memory simulator state
# ─────────────────────────────────────────────────────────────

TOTAL_BLOCKS = 1000
running = False
clients: List[WebSocket] = []

ALERT_NAMES = {
    0: "OK",
    1: "WARN",
    2: "CRITICAL",
    3: "LAST_GASP"
}

# ─────────────────────────────────────────────────────────────
# OOB Packet Generator (mirrors firmware behavior)
# ─────────────────────────────────────────────────────────────

def generate_oob_packet():
    block = random.randint(0, TOTAL_BLOCKS - 1)

    # Weighted alert probabilities
    r = random.random()
    if r < 0.75:
        alert = 0
    elif r < 0.90:
        alert = 1
    elif r < 0.98:
        alert = 2
    else:
        alert = 3

    packet = {
        "timestamp": round(time.time(), 3),
        "block": block,
        "temperature": random.randint(30, 90),
        "voltage": round(random.uniform(2.7, 3.6), 2),
        "ecc_errors": random.randint(0, 12),
        "alert": alert,
        "alert_name": ALERT_NAMES[alert]
    }

    return packet


# ─────────────────────────────────────────────────────────────
# Background telemetry loop
# ─────────────────────────────────────────────────────────────

async def telemetry_loop():
    global running

    while running:
        packet = generate_oob_packet()

        # Broadcast to all connected clients
        for ws in clients.copy():
            try:
                await ws.send_json(packet)
            except:
                clients.remove(ws)

        await asyncio.sleep(1)  # 1 packet per second


# ─────────────────────────────────────────────────────────────
# API Controls
# ─────────────────────────────────────────────────────────────

@app.post("/start")
async def start_simulation():
    global running
    if not running:
        running = True
        asyncio.create_task(telemetry_loop())
    return {"running": running}


@app.post("/stop")
async def stop_simulation():
    global running
    running = False
    return {"running": running}


@app.get("/status")
async def status():
    return {
        "running": running,
        "connected_clients": len(clients),
        "total_blocks": TOTAL_BLOCKS
    }


# ─────────────────────────────────────────────────────────────
# WebSocket Stream Endpoint
# ─────────────────────────────────────────────────────────────

@app.websocket("/stream")
async def stream(ws: WebSocket):
    await ws.accept()
    clients.append(ws)
    print("Client connected:", len(clients))

    try:
        while True:
            await ws.receive_text()  # keep connection alive
    except WebSocketDisconnect:
        clients.remove(ws)
        print("Client disconnected:", len(clients))