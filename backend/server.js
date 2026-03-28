/**
 * server.js — NANDGuard Unified Backend (P1–P4)
 *
 * Now includes Start/Stop control for P4 OOB Simulation
 * Run: node server.js
 */

const express          = require('express');
const http             = require('http');
const { Server }       = require('socket.io');
const { WebSocketServer } = require('ws');
const cors             = require('cors');
const { execFile, spawn } = require('child_process');
const path             = require('path');
const fs               = require('fs');
const state            = require('./state');

let oobSimProcess = null;   // Global variable to track oob_sim.py process

// ─── App + HTTP server ────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── Socket.io ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ─── OOB In-Memory State ─────────────────────────────────────────────────────
const OOB_MAX_HISTORY = 100;
const oobHistory  = [];
let   oobLatest   = null;
const oobLastGasps = [];

const ALERT_NAMES  = { 0: 'OK', 1: 'WARN', 2: 'CRITICAL', 3: 'LAST_GASP' };
const ALERT_COLORS = {
  0: '#22c55e',
  1: '#f59e0b',
  2: '#ef4444',
  3: '#7c3aed',
};

// ─── Raw WebSocket Server (Port 3002) ────────────────────────────────────────
const WS_PORT = 3002;
const wss = new WebSocketServer({ port: WS_PORT });

wss.on('listening', () => {
  console.log(`[oob-ws] Raw WebSocket listening on ws://localhost:${WS_PORT}`);
});

wss.on('connection', (ws, req) => {
  console.log(`[oob-ws] oob_sim.py connected from ${req.socket.remoteAddress}`);

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      console.error('[oob-ws] Bad JSON:', e.message);
      return;
    }

    const enriched = {
      ...msg,
      alert_color:     ALERT_COLORS[msg.alert] ?? '#6b7280',
      alert_label:     ALERT_NAMES[msg.alert]  ?? 'UNKNOWN',
      raw_hex_display: msg.raw_hex ? msg.raw_hex.match(/.{2}/g).join(' ') : '',
    };

    oobLatest = enriched;
    oobHistory.unshift(enriched);
    if (oobHistory.length > OOB_MAX_HISTORY) oobHistory.pop();

    if (msg.alert === 3) {
      oobLastGasps.push(enriched);
      io.emit('last_gasp', enriched);
    }

    io.emit('oob_packet', enriched);

    console.log(
      `[oob] t=${String(msg.tick).padStart(4, '0')} | ${enriched.alert_label.padEnd(9)} | ` +
      `fail=${msg.snapshot?.failure_prob}% | wear=${msg.snapshot?.wear_level_pct}%`
    );
  });

  ws.on('close', () => console.log('[oob-ws] oob_sim.py disconnected.'));
});

// ─── Socket.io Connection ────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[socket.io] Dashboard connected: ${socket.id}`);
  socket.emit('init', {
    latest:    oobLatest,
    history:   oobHistory.slice(0, 50),
    lastGasps: oobLastGasps,
    simulationRunning: !!oobSimProcess
  });

  socket.on('disconnect', () => {
    console.log(`[socket.io] Dashboard disconnected: ${socket.id}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/', (req, res) => {
  res.json({
    message: 'NANDGuard Unified Backend (P1–P4) is running!',
    modules: {
      P1_BadBlock: ['GET /status', 'POST /inject', 'POST /reset', 'POST /run-algorithm'],
      P2_LogicMin: ['GET /logic/status', 'POST /logic/switch', 'POST /logic/run'],
      P3_LDPC:     ['GET /ldpc/*'],
      P4_OOB:      ['GET /oob/*', 'POST /oob/start', 'POST /oob/stop', '+ Socket.io events']
    },
    ports: { http_socketio: 3001, oob_websocket: 3002 }
  });
});

// P1, P2, P3 routes remain the same (unchanged from your original code)
// ... [P1, P2, P3 routes here - copy from previous version I gave] ...

// ─── P4 : OOB Control Routes (NEW) ───────────────────────────────────────────

/** Start OOB Simulation */
/** Start OOB Simulation - Fixed for python/ subfolder */
app.post('/oob/start', (req, res) => {
  if (oobSimProcess) {
    return res.json({ success: false, message: 'OOB Simulation is already running' });
  }

  // Correct path: python/oob_sim.py
  const scriptPath = path.join(__dirname, 'python', 'oob_sim.py');

  if (!fs.existsSync(scriptPath)) {
    return res.status(404).json({ 
      success: false, 
      message: `oob_sim.py not found at: ${scriptPath}` 
    });
  }

  try {
    console.log(`[P4] Starting oob_sim.py from: ${scriptPath}`);

    oobSimProcess = spawn('python', [scriptPath], { 
      stdio: 'pipe',
      cwd: path.join(__dirname, 'python')   // Important: run from python folder
    });

    oobSimProcess.stdout.on('data', (data) => {
      console.log(`[oob_sim] ${data.toString().trim()}`);
    });

    oobSimProcess.stderr.on('data', (data) => {
      console.error(`[oob_sim ERROR] ${data.toString().trim()}`);
    });

    oobSimProcess.on('close', (code) => {
      console.log(`[oob_sim] Process exited with code ${code}`);
      oobSimProcess = null;
      io.emit('simulation_status', { running: false });
    });

    console.log('[P4] OOB Simulation started successfully');
    io.emit('simulation_status', { running: true });

    res.json({ 
      success: true, 
      message: 'OOB Simulation started successfully' 
    });
  } catch (err) {
    console.error('[P4] Failed to start oob_sim.py:', err);
    res.status(500).json({ success: false, message: 'Failed to start simulation' });
  }
});

/** Stop OOB Simulation */
app.post('/oob/stop', (req, res) => {
  if (!oobSimProcess) {
    return res.json({ success: false, message: 'OOB Simulation is not running' });
  }

  oobSimProcess.kill();
  oobSimProcess = null;
  console.log('[P4] OOB Simulation stopped');
  io.emit('simulation_status', { running: false });

  res.json({ success: true, message: 'OOB Simulation stopped' });
});

/** Get current simulation status */
app.get('/oob/status', (req, res) => {
  res.json({
    latest:    oobLatest,
    history:   oobHistory.slice(0, 50),
    lastGasps: oobLastGasps,
    simulationRunning: !!oobSimProcess,
    connected: true,
  });
});

// P4 other routes
app.get('/oob/history', (req, res) => res.json({ history: oobHistory }));
app.get('/oob/lastgasp', (req, res) => res.json({ events: oobLastGasps }));

// ─── 404 fallback ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', message: `No route for ${req.method} ${req.url}` });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const HTTP_PORT = 3001;

server.listen(HTTP_PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║         NANDGuard Unified Backend (P1–P4)            ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  REST + Socket.io →  http://localhost:${HTTP_PORT}         ║`);
  console.log(`║  OOB WebSocket    →  ws://localhost:${WS_PORT}           ║`);
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('P4 Controls: POST /oob/start and POST /oob/stop');
  console.log('');
});