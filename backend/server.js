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


// === LOGIC MINIMIZER ROUTES ===

// Get current function data (truth table + original gates)
app.get('/logic/status', (req, res) => {
  const func = state.functions[state.currentFunction];
  res.json({
    currentFunction: state.currentFunction,
    name: func.name,
    variables: func.variables,
    minterms: func.minterms,
    dontcares: func.dontcares,
    originalGates: func.originalGates,
    description: func.description
  });
});

// Switch function
app.post('/logic/switch', (req, res) => {
  const { funcName } = req.body;
  if (state.functions[funcName]) {
    state.currentFunction = funcName;
    res.json({ success: true, current: funcName });
  } else {
    res.status(400).json({ error: 'Invalid function name' });
  }
});

// Run Quine-McCluskey + generate steps + C code
app.post('/logic/run', (req, res) => {
  const func = state.functions[state.currentFunction];
  
  const scriptPath = path.join(__dirname, 'python', 'logic_minimizer.py');

  const inputData = JSON.stringify({
    minterms: func.minterms,
    dontcares: func.dontcares,
    variables: func.variables,
    originalGates: func.originalGates,
    function_key: state.currentFunction     // ← This is what was missing!
  });

  execFile('python', [scriptPath, inputData], { maxBuffer: 1024 * 1024 }, 
    (error, stdout, stderr) => {
      if (error) {
        console.error('Python error:', stderr);
        return res.status(500).json({ error: 'Python failed', detail: stderr });
      }
      try {
        const result = JSON.parse(stdout.trim());
        res.json(result);
      } catch (e) {
        res.status(500).json({ error: 'Parse error', raw: stdout });
      }
    }
  );
});

// ─── P3 LDPC ROUTES ────────────────────────────────────────────────────────

// LDPC home
app.get('/ldpc', (req, res) => {
  res.json({
    message: "LDPC module ready",
    availableRoutes: [
      "GET  /ldpc/status",
      "POST /ldpc/encode",
      "POST /ldpc/corrupt",
      "POST /ldpc/detect",
      "POST /ldpc/correct"
    ]
  });
});

// LDPC status
app.get('/ldpc/status', (req, res) => {
  res.json({
    encoded:        state.ldpc.encoded,
    corrupted:      state.ldpc.corrupted_flag,
    flippedPos:     state.ldpc.flippedPos,
    codewordLength: state.ldpc.codeword.length,
    dataBits:       state.ldpc.dataBits,
    codeword:       state.ldpc.codeword
  });
});

// POST /ldpc/encode
// Body: { "dataBits": [1,0,1,1,0,1,0,1] }
app.post('/ldpc/encode', (req, res) => {
  const { dataBits } = req.body;

  if (!dataBits || !Array.isArray(dataBits) || dataBits.length === 0) {
    return res.status(400).json({ error: 'dataBits array is required' });
  }

  if (dataBits.some(b => b !== 0 && b !== 1)) {
    return res.status(400).json({ error: 'dataBits must only contain 0s and 1s' });
  }

  const scriptPath = path.join(__dirname, 'python', 'ldpc.py');
  const arg = JSON.stringify({ action: 'encode', dataBits });

  execFile('python', [scriptPath, arg],
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

        // Save to state
        state.ldpc.dataBits       = dataBits;
        state.ldpc.codeword       = result.codeword;
        state.ldpc.corrupted      = [];
        state.ldpc.flippedPos     = null;
        state.ldpc.encoded        = true;
        state.ldpc.corrupted_flag = false;

        res.json({ success: true, ...result });
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

// POST /ldpc/corrupt
// No body needed — Node picks a random bit and flips it
app.post('/ldpc/corrupt', (req, res) => {
  if (!state.ldpc.encoded) {
    return res.status(400).json({ error: 'Encode data first before corrupting' });
  }

  if (state.ldpc.corrupted_flag) {
    return res.status(400).json({ error: 'Already corrupted — detect or reset first' });
  }

  const codeword = [...state.ldpc.codeword];
  const flipPos  = Math.floor(Math.random() * state.ldpc.dataBits.length);

  const originalBit = codeword[flipPos];
  codeword[flipPos]  = codeword[flipPos] ^ 1;

  state.ldpc.corrupted      = codeword;
  state.ldpc.flippedPos     = flipPos;
  state.ldpc.corrupted_flag = true;

  console.log(`Bit flipped at position ${flipPos}: ${originalBit} → ${codeword[flipPos]}`);

  res.json({
    success:     true,
    corrupted:   codeword,
    flippedPos:  flipPos,
    originalBit: originalBit,
    newBit:      codeword[flipPos]
  });
});

// POST /ldpc/detect
// No body needed — reads corrupted codeword from state
app.post('/ldpc/detect', (req, res) => {
  if (!state.ldpc.corrupted_flag) {
    return res.status(400).json({ error: 'No corruption injected yet' });
  }

  const scriptPath = path.join(__dirname, 'python', 'ldpc.py');
  const arg = JSON.stringify({
    action:   'detect',
    codeword: state.ldpc.corrupted,
    numData:  state.ldpc.dataBits.length
  });

  execFile('python', [scriptPath, arg],
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
        res.json({ success: true, ...result });
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

// POST /ldpc/correct
// No body needed — reads corrupted codeword from state, corrects and verifies
app.post('/ldpc/correct', (req, res) => {
  if (!state.ldpc.corrupted_flag) {
    return res.status(400).json({ error: 'Nothing to correct — corrupt first' });
  }

  const scriptPath = path.join(__dirname, 'python', 'ldpc.py');
  const arg = JSON.stringify({
    action:   'correct',
    codeword: state.ldpc.corrupted,
    numData:  state.ldpc.dataBits.length
  });

  execFile('python', [scriptPath, arg],
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

        // If verified clean, reset corruption state
        if (result.verified) {
          state.ldpc.corrupted      = [];
          state.ldpc.corrupted_flag = false;
          state.ldpc.flippedPos     = null;
          console.log('Correction verified — state reset to clean');
        }

        res.json({ success: true, ...result });
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

// Start server
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ NANDGuard backend running on http://localhost:${PORT}`);
  console.log(`   Test it with: curl http://localhost:${PORT}/status`);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found', 
    message: `No route for ${req.method} ${req.url}` 
  });
});