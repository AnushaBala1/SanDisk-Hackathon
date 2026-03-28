// server.js — NANDGuard Unified Backend (P1–P4)

const express = require('express');
const http = require('http');
const cors = require('cors');
const { execFile} = require('child_process');
const path = require('path');
const state = require('./state');
const multer  = require('multer');
const FormData = require('form-data');
const upload  = multer({ storage: multer.memoryStorage() });
const app = express();
const server = http.createServer(app);


app.use(cors());
app.use(express.json());

// Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});


// ─────────────────────────────────────────────────────────────
// P1 — BAD BLOCK MANAGER
// ─────────────────────────────────────────────────────────────

app.get('/status', (req, res) => {
  res.json({
    totalBlocks: state.totalBlocks,
    badBlockCount: state.badBlocks.length,
    badBlocks: state.badBlocks,
    falseNegatives: 0
  });
});

app.post('/inject', (req, res) => {
  const count = Math.min(req.body.count || 20, 100);
  const newBad = [];

  while (newBad.length < count) {
    const idx = Math.floor(Math.random() * state.totalBlocks);
    if (!state.badBlocks.includes(idx) && !newBad.includes(idx)) {
      newBad.push(idx);
    }
  }

  state.badBlocks = [...state.badBlocks, ...newBad].sort((a, b) => a - b);

  res.json({
    success: true,
    badBlocks: state.badBlocks,
    injected: newBad
  });
});

app.post('/reset', (req, res) => {
  state.badBlocks = [];
  res.json({ success: true });
});

app.post('/run-algorithm', (req, res) => {
  const scriptPath = path.join(__dirname, 'python', 'bad_block.py');
  const arg = JSON.stringify(state.badBlocks);

  execFile('python', [scriptPath, arg], (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(JSON.parse(stdout.trim()));
  });
});


// ─────────────────────────────────────────────────────────────
// P2 — LOGIC MINIMIZER
// ─────────────────────────────────────────────────────────────

app.get('/logic/status', (req, res) => {
  const func = state.functions[state.currentFunction];
  res.json(func);
});

app.post('/logic/switch', (req, res) => {
  const { funcName } = req.body;
  state.currentFunction = funcName;
  res.json({ success: true });
});

app.post('/logic/run', (req, res) => {
  const func = state.functions[state.currentFunction];
  const scriptPath = path.join(__dirname, 'python', 'logic_minimizer.py');

  execFile('python', [scriptPath, JSON.stringify(func)], (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(JSON.parse(stdout.trim()));
  });
});


// ─────────────────────────────────────────────────────────────
// P3 — LDPC (FIXED STATE SYNC)
// ─────────────────────────────────────────────────────────────

app.get('/ldpc/status', (req, res) => {
  res.json(state.ldpc);
});

app.post('/ldpc/encode', (req, res) => {
  const { dataBits } = req.body;
  const scriptPath = path.join(__dirname, 'python', 'ldpc.py');

  execFile('python', [scriptPath, JSON.stringify({
    action: 'encode',
    dataBits
  })], (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });

    const result = JSON.parse(stdout.trim());

    state.ldpc = {
      dataBits,
      codeword: result.codeword,
      corrupted: [],
      flippedPos: null,
      corrupted_flag: false,
      encoded: true
    };

    res.json(result);
  });
});

app.post('/ldpc/corrupt', (req, res) => {
  if (!state.ldpc.encoded)
    return res.status(400).json({ error: 'Encode first' });

  const cw = [...state.ldpc.codeword];
  const pos = Math.floor(Math.random() * cw.length);

  cw[pos] ^= 1;

  state.ldpc.corrupted = cw;
  state.ldpc.flippedPos = pos;
  state.ldpc.corrupted_flag = true;

  res.json({ corrupted: cw, flippedPos: pos });
});

app.post('/ldpc/detect', (req, res) => {
  const scriptPath = path.join(__dirname, 'python', 'ldpc.py');

  execFile('python', [scriptPath, JSON.stringify({
    action: 'detect',
    codeword: state.ldpc.corrupted,
    numData: state.ldpc.dataBits.length
  })], (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(JSON.parse(stdout.trim()));
  });
});

app.post('/ldpc/correct', (req, res) => {
  const scriptPath = path.join(__dirname, 'python', 'ldpc.py');

  execFile('python', [scriptPath, JSON.stringify({
    action: 'correct',
    codeword: state.ldpc.corrupted,
    numData: state.ldpc.dataBits.length
  })], (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message });

    const result = JSON.parse(stdout.trim());

    if (result.verified) {
      state.ldpc.corrupted = [];
      state.ldpc.flippedPos = null;
      state.ldpc.corrupted_flag = false;
    }

    res.json(result);
  });
});


/// ─────────────────────────────────────────────────────────────
// P4 — OOB FASTAPI BRIDGE
// ─────────────────────────────────────────────────────────────



// Control FastAPI from Node (so React buttons still work)



app.post('/model/score', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Send field name "file".' });
  }

  const form = new FormData();
  form.append('file', req.file.buffer, {
    filename: req.file.originalname || 'upload.csv',
    contentType: req.file.mimetype || 'text/csv',
  });

  try {
    // ✅ Use pipe() instead of fetch — lets form-data control the boundary
    await new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 8000,
        path: '/score',
        method: 'POST',
        headers: form.getHeaders(),  // boundary is correctly set here
      };

      const request = http.request(options, (fastapiRes) => {
        let body = '';
        fastapiRes.on('data', chunk => body += chunk);
        fastapiRes.on('end', () => {
          try {
            const data = JSON.parse(body);
            res.status(fastapiRes.statusCode).json(data);
          } catch (e) {
            res.status(500).json({ error: 'Invalid JSON from model server', detail: body });
          }
          resolve();
        });
      });

      request.on('error', reject);
      form.pipe(request);
    });
  } catch (err) {
    res.status(502).json({ error: 'Model server unreachable', detail: err.message });
  }
});

app.post('/model/stream', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Send field name "file".' });
  }

  const form = new FormData();
  form.append('file', req.file.buffer, {
    filename: req.file.originalname || 'upload.csv',
    contentType: req.file.mimetype || 'text/csv',
  });

  try {
    await new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 8000,
        path: '/stream',
        method: 'POST',
        headers: form.getHeaders(),
      };

      const request = http.request(options, (fastapiRes) => {
        if (fastapiRes.statusCode !== 200) {
          let body = '';
          fastapiRes.on('data', chunk => body += chunk);
          fastapiRes.on('end', () => {
            try { res.status(fastapiRes.statusCode).json(JSON.parse(body)); }
            catch { res.status(fastapiRes.statusCode).send(body); }
            resolve();
          });
          return;
        }

        // ── SSE headers ──────────────────────────────────────────
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // Pipe FastAPI SSE stream directly to browser
        fastapiRes.pipe(res);
        fastapiRes.on('end', resolve);
        fastapiRes.on('error', reject);
      });

      request.on('error', (err) => {
        if (!res.headersSent) {
          res.status(502).json({ error: 'Model server unreachable', detail: err.message });
        } else {
          res.write(`data: ${JSON.stringify({ error: err.message, done: true })}\n\n`);
          res.end();
        }
        reject(err);
      });

      form.pipe(request);
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ error: 'Model server unreachable', detail: err.message });
    }
  }
});

// ─────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`✅ NANDGuard Unified Backend running on http://localhost:${PORT}`);
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});