// backend/server.js
const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
const path = require('path');
const state = require('./state');

const app = express();

app.use(cors());
app.use(express.json());

// Simple logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── ROUTES ────────────────────────────────────────────────────────────────

// Home - just to avoid 404 on root
app.get('/', (req, res) => {
  res.json({
    message: "NANDGuard Backend is running!",
    availableRoutes: [
      "GET  /status",
      "POST /inject",
      "POST /reset",
      "POST /run-algorithm"
    ]
  });
});

// Status
app.get('/status', (req, res) => {
  res.json({
    totalBlocks: state.totalBlocks,
    badBlockCount: state.badBlocks.length,
    badBlocks: state.badBlocks,           // ← Send the list
    falseNegatives: 0
  });
});

// Inject bad blocks (MUST be POST)
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
    totalBlocks: state.totalBlocks,
    badBlockCount: state.badBlocks.length,
    badBlocks: state.badBlocks,           // ← This is what frontend needs for coloring
    injected: newBad
  });
});

// Reset
app.post('/reset', (req, res) => {
  state.badBlocks = [];
  console.log('Bad block list reset');
  res.json({ success: true, badBlocks: [] });
});

// Run the Python algorithm (Bad Block Manager)
app.post('/run-algorithm', (req, res) => {
  if (state.badBlocks.length === 0) {
    return res.status(400).json({ 
      error: 'No bad blocks injected yet. Please inject some first.' 
    });
  }

  const badBlocksJson = JSON.stringify(state.badBlocks);
  const scriptPath = path.join(__dirname, 'python', 'bad_block.py');

  // Use 'python' instead of 'python3' on Windows
  execFile('python', [scriptPath, badBlocksJson], 
    { maxBuffer: 1024 * 1024 }, 
    (error, stdout, stderr) => {
      if (error) {
        console.error('Python execution error:', stderr || error.message);
        return res.status(500).json({ 
          error: 'Failed to run Python algorithm', 
          detail: stderr || error.message 
        });
      }

      try {
        const result = JSON.parse(stdout.trim());
        res.json(result);
      } catch (e) {
        console.error('Failed to parse Python output:', stdout);
        res.status(500).json({ 
          error: 'Invalid JSON from Python', 
          rawOutput: stdout 
        });
      }
    }
  );
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found', 
    message: `No route for ${req.method} ${req.url}` 
  });
});

// Start server
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ NANDGuard backend running on http://localhost:${PORT}`);
  console.log(`   Test it with: curl http://localhost:${PORT}/status`);
});