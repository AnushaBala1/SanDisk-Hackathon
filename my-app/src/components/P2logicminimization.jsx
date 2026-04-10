import { useState, useEffect, useRef, useCallback } from 'react';
import SimLoader from './Simloader.jsx';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';;

export default function P2LogicMinimization() {
  const [activeFn, setActiveFn] = useState(0);
  const [loading, setLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [results, setResults] = useState(null);
  const [visiblePIs, setVisiblePIs] = useState([]);
  const [error, setError] = useState(null);
  const [currentFunctionData, setCurrentFunctionData] = useState(null);

  const fnIds = ['gc_trigger', 'wear_leveling', 'oob_threshold'];
  const fnNames = ['GC TRIGGER', 'WEAR LEVELING', 'OOB THRESHOLD'];
  const fnDescs = [
    'Trigger garbage collection?',
    'Force wear leveling?',
    'Trigger OOB alert?'
  ];

  const currentFnId = fnIds[activeFn];

  // Fetch current function data from backend
  const fetchCurrentFunction = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/logic/status`);
      if (!response.ok) throw new Error('Failed to fetch function status');
      
      const data = await response.json();
      setCurrentFunctionData(data);
      setError(null);
    } catch (err) {
      console.error("Status fetch failed:", err);
      setError("Could not connect to backend. Is the server running on port 3001?");
    }
  }, []);

  // Switch function
  const handleSelectFn = useCallback(async (i) => {
    setActiveFn(i);
    setMinimized(false);
    setResults(null);
    setVisiblePIs([]);
    setError(null);

    try {
      await fetch(`${API_BASE}/logic/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funcName: fnIds[i] })
      });
      await fetchCurrentFunction();
    } catch (err) {
      console.error("Switch failed:", err);
      setError("Failed to switch function. Backend may not be running.");
    }
  }, [fetchCurrentFunction]);

  // Run Quine-McCluskey via backend
  const handleSimulate = useCallback(async () => {
    setLoading(true);
    setResults(null);
    setVisiblePIs([]);
    setMinimized(false);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/logic/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (!response.ok) throw new Error('Server error');

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Minimization failed");
      }

      // Staggered Prime Implicants animation
      for (let i = 0; i < (data.prime_implicants?.length || 0); i++) {
        await new Promise(r => setTimeout(r, 220));
        setVisiblePIs(prev => [...prev, i]);
      }

      setResults({
        after: data.gates_after || data.gatesAfter || 5,
        pct: data.reduction_pct || 75,
        minimized_expression: data.minimized_expression || "A'B + CD'",
        generated_c: data.generated_c || "// Error generating C code",
        prime_implicants: data.prime_implicants || [],
        essential: data.essential || [],
        truth_table: data.truth_table || []
      });

      setMinimized(true);
    } catch (err) {
      console.error("Simulation failed:", err);
      setError(err.message || "Failed to run Quine-McCluskey. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setMinimized(false);
    setResults(null);
    setVisiblePIs([]);
    setError(null);
  }, []);

  // Load function data when active function changes
  useEffect(() => {
    fetchCurrentFunction();
  }, [activeFn, fetchCurrentFunction]);

  // Current function data for TruthTable and GateCanvas
  const fn = {
    id: currentFnId,
    name: fnNames[activeFn],
    desc: fnDescs[activeFn],
    vars: currentFunctionData?.variables || ['A', 'B', 'C', 'D'],
    gatesBefore: currentFunctionData?.originalGates || [12, 31, 14][activeFn],

    rows: results?.truth_table 
      ? results.truth_table.map(row => ({
          m: row.binary ? row.binary.split('').map(bit => Number(bit)) : [],
          o: row.output === '1' ? 1 : 
             (row.output?.toUpperCase() === 'X' || row.output === 'x') ? 2 : 0
        }))
      : (currentFunctionData?.variables 
          ? Array(1 << currentFunctionData.variables.length)
              .fill(0)
              .map((_, i) => ({
                m: i.toString(2)
                     .padStart(currentFunctionData.variables.length, '0')
                     .split('')
                     .map(Number),
                o: 0
              }))
          : []),

    piList: results?.prime_implicants 
      ? results.prime_implicants.map((label, i) => ({
          label,
          essential: results.essential?.includes(label) || false
        }))
      : []
  };

  return (
    <div className="bg-[#080808]">
      {loading && <SimLoader message="Running Quine-McCluskey..." />}

      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b border-[#E63946]/20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-[#E63946] animate-pulse" />
            <span className="font-mono text-[#E63946] text-xs tracking-[0.3em] uppercase">
              P2 · LOGIC MINIMIZATION
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-['Space_Grotesk'] font-black tracking-tighter text-white">
                Quine-McCluskey Minimizer
              </h2>
              <p className="text-[#A0A0A0] text-xs font-mono mt-1">
                BOOLEAN_FUNC_REDUCER · PRIME_IMPLICANT_EXTRACTOR · GATE_OPTIMIZER
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleReset}
                disabled={loading}
                className="border border-[#5B403F] text-[#e4bebc] hover:border-[#E63946] hover:text-[#E63946] px-5 py-2.5 font-['Space_Grotesk'] font-bold text-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-40"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>restart_alt</span>
                Reset
              </button>

              <button
                onClick={handleSimulate}
                disabled={loading}
                className="bg-[#E63946] hover:bg-[#FF4D4D] text-white px-5 py-2.5 font-['Space_Grotesk'] font-bold text-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-40"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>play_arrow</span>
                Simulate
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Function Selector */}
      <div className="px-8 py-3 border-b border-[#2A2A2A]">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#A0A0A0] font-mono text-[10px] tracking-[0.25em] uppercase pr-4 border-r border-[#2A2A2A] mr-2">
              FUNCTION
            </span>
            {fnIds.map((id, i) => (
              <button
                key={id}
                onClick={() => handleSelectFn(i)}
                className={`px-4 py-1.5 font-mono text-xs tracking-wider transition-all border ${
                  activeFn === i
                    ? 'border-[#E63946] bg-[#1A0000] text-[#E63946]'
                    : 'border-[#2A2A2A] text-[#A0A0A0] hover:border-[#E63946]/50 hover:text-[#e4bebc]'
                }`}
              >
                {fnNames[i]}
              </button>
            ))}
            <span className="ml-auto font-mono text-[#555] text-[10px] italic">
              {fn.desc}
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-8 py-2 border-b border-[#1A1A1A]">
        <div className="max-w-7xl mx-auto flex items-center gap-6">
          <span className="font-mono text-[10px] text-[#666] tracking-wider uppercase">Legend:</span>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#4CAF50]/20 border border-[#4CAF50]/40" />
            <span className="font-mono text-[#A0A0A0] text-[10px]">Minterm (output = 1)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#FFA500]/20 border border-[#FFA500]/40" />
            <span className="font-mono text-[#A0A0A0] text-[10px]">Don't-care (X)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-transparent border border-[#333]" />
            <span className="font-mono text-[#A0A0A0] text-[10px]">Output = 0</span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-8 py-4 text-red-400 font-mono text-sm bg-red-950/30 border-l-4 border-red-600">
          ⚠️ {error}
        </div>
      )}

      {/* Main Content */}
      <div className="px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Truth Table */}
            <div>
              <div className="font-mono text-[#E63946] text-[10px] tracking-[0.25em] uppercase mb-3">
                ── TRUTH TABLE
              </div>
              <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
                <TruthTable fn={fn} />
              </div>

              <div className="mt-3 flex gap-2 flex-wrap">
                {fn.vars.map(v => (
                  <span
                    key={v}
                    className="font-mono text-[10px] px-2 py-0.5 border border-[#2A2A2A] text-[#A0A0A0] bg-[#111]"
                  >
                    {v}
                  </span>
                ))}
                <span className="font-mono text-[10px] text-[#555] ml-1">
                  · {fn.vars.length} input{fn.vars.length > 1 ? 's' : ''}, {fn.rows.length} rows
                </span>
              </div>
            </div>

            {/* Gate Diagram */}
            <div>
              <div className="font-mono text-[#E63946] text-[10px] tracking-[0.25em] uppercase mb-3">
                ── GATE DIAGRAM
              </div>
              <div className="border border-[#2A2A2A] bg-[#0D0D0D] p-3">
                <GateCanvas fn={fn} minimized={minimized} afterGates={results?.after} />
              </div>

              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#E63946]/60" />
                  <span className="font-mono text-[10px] text-[#666]">
                    Before: <span className="text-[#E63946]">{fn.gatesBefore} gates</span>
                  </span>
                </div>
                {minimized && results && (
                  <>
                    <span className="text-[#333] font-mono text-xs">→</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-[#4CAF50]/60" />
                      <span className="font-mono text-[10px] text-[#666]">
                        After: <span className="text-[#4CAF50]">{results.after} gates</span>
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Simulation Results */}
      {(visiblePIs.length > 0 || results) && (
        <div className="px-8 pb-10">
          <div className="max-w-7xl mx-auto border-t border-[#E63946]/30 pt-8">
            <div className="font-mono text-[#E63946] text-xs tracking-[0.3em] uppercase mb-6">
              ── SIMULATION RESULTS ─────────────────────────────
            </div>

            {/* Prime Implicants */}
            {visiblePIs.length > 0 && fn.piList.length > 0 && (
              <div className="mb-6">
                <div className="font-mono text-[#A0A0A0] text-[10px] tracking-[0.2em] uppercase mb-3">
                  PRIME IMPLICANTS FOUND
                </div>
                <div className="bg-[#0D0D0D] border border-[#2A2A2A] p-4 font-mono space-y-2">
                  {fn.piList.map((pi, i) =>
                    visiblePIs.includes(i) && (
                      <div
                        key={i}
                        className="flex items-center gap-3 text-sm"
                        style={{ animation: 'fadeInUp 0.3s ease forwards' }}
                      >
                        <span
                          className={`text-[10px] px-2 py-0.5 border font-bold tracking-wider ${
                            pi.essential
                              ? 'bg-[#4CAF50]/10 border-[#4CAF50]/40 text-[#4CAF50]'
                              : 'bg-[#E63946]/10 border-[#E63946]/20 text-[#A0A0A0]'
                          }`}
                        >
                          {pi.essential ? 'ESSENTIAL' : 'REDUNDANT'}
                        </span>
                        <span className="text-[#e4bebc] text-xs">{pi.label}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {results && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  {[
                    { label: 'Gates Before', value: fn.gatesBefore, color: 'text-[#E63946]' },
                    { label: 'Gates After', value: results.after, color: 'text-[#4CAF50]' },
                    { label: 'Reduction', value: `${results.pct}%`, color: 'text-white' },
                  ].map(stat => (
                    <div
                      key={stat.label}
                      className="bg-[#111111] border border-[#2A2A2A] border-t-2 border-t-[#E63946] p-5"
                    >
                      <div className="text-[#e4bebc] font-mono text-xs tracking-wider mb-2 uppercase">
                        {stat.label}
                      </div>
                      <div className={`font-mono text-3xl font-bold ${stat.color}`}>
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-[#4CAF50]/5 border border-[#4CAF50]/30 p-4 mb-6 flex items-center gap-3">
                  <div className="w-1 h-full min-h-[20px] bg-[#4CAF50] self-stretch" />
                  <div>
                    <div className="font-mono text-[#4CAF50] text-[10px] tracking-[0.2em] uppercase mb-1">
                      MINIMAL EXPRESSION
                    </div>
                    <div className="font-mono text-white text-sm">
                      {results.minimized_expression}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="font-mono text-[#A0A0A0] text-[10px] tracking-[0.2em] uppercase mb-2">
                    GENERATED C FUNCTION
                  </div>
                  <div className="bg-[#0D0D0D] border border-[#2A2A2A] border-l-2 border-l-[#E63946]">
                    <div className="px-4 py-2 border-b border-[#1A1A1A] flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-[#E63946] animate-pulse" />
                      <span className="font-mono text-[#555] text-[10px] tracking-widest uppercase">output.c</span>
                    </div>
                    <pre className="px-5 py-4 font-mono text-xs text-[#e4bebc] overflow-x-auto leading-relaxed whitespace-pre">
                      {results.generated_c}
                    </pre>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ── Truth Table Component ── */
function TruthTable({ fn }) {
  if (!fn.rows || fn.rows.length === 0) {
    return (
      <div className="p-8 text-center text-[#555] font-mono text-sm">
        Loading truth table...
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        borderCollapse: 'collapse',
        fontFamily: '"Space Mono", monospace',
        fontSize: '11px',
        width: '100%',
      }}>
        <thead>
          <tr>
            {fn.vars.map(v => (
              <th key={v} style={{
                background: '#111111',
                padding: '5px 10px',
                textAlign: 'center',
                fontWeight: 500,
                fontSize: '10px',
                color: '#A0A0A0',
                borderBottom: '1px solid #2A2A2A',
                letterSpacing: '0.1em',
              }}>
                {v.toUpperCase()}
              </th>
            ))}
            <th style={{
              background: '#111111',
              padding: '5px 10px',
              textAlign: 'center',
              fontWeight: 500,
              fontSize: '10px',
              color: '#A0A0A0',
              borderBottom: '1px solid #2A2A2A',
              letterSpacing: '0.1em',
            }}>
              OUT
            </th>
          </tr>
        </thead>
        <tbody>
          {fn.rows.map((row, i) => {
            const rowBg =
              row.o === 2 ? 'rgba(255,165,0,0.08)' :
              row.o === 1 ? 'rgba(76,175,80,0.08)' :
              'transparent';

            const outColor =
              row.o === 2 ? '#FFA500' :
              row.o === 1 ? '#4CAF50' :
              '#555';

            return (
              <tr key={i} style={{ background: rowBg }}>
                {row.m.map((v, j) => (
                  <td key={j} style={{
                    padding: '4px 10px',
                    textAlign: 'center',
                    borderBottom: '1px solid #1A1A1A',
                    color: v ? '#E0E0E0' : '#555',
                  }}>
                    {v}
                  </td>
                ))}
                <td style={{
                  padding: '4px 10px',
                  textAlign: 'center',
                  borderBottom: '1px solid #1A1A1A',
                  color: outColor,
                  fontWeight: row.o > 0 ? 600 : 400,
                }}>
                  {row.o === 2 ? 'X' : row.o}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Gate Canvas Component ── */
function GateCanvas({ fn, minimized, afterGates }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.parentElement.offsetWidth || 340;
    canvas.width = W;
    canvas.height = 220;

    ctx.clearRect(0, 0, W, 220);

    const gateGood = 'rgba(76,175,80,0.15)';
    const gateBad = 'rgba(230,57,70,0.12)';
    const borderGood = '#4CAF50';
    const borderBad = '#E63946';

    ctx.font = '9px "Space Mono", monospace';
    ctx.textAlign = 'center';

    if (!minimized) {
      // Unminimized - use gatesBefore
      const count = fn.gatesBefore;
      const cols = Math.min(count, 8);
      const gw = Math.min(28, Math.floor((W - 40) / cols - 4));
      const gh = 18;
      const xStart = (W - cols * (gw + 4)) / 2;

      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = xStart + col * (gw + 4);
        const y = 28 + row * (gh + 8);

        ctx.fillStyle = gateBad;
        ctx.strokeStyle = borderBad;
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, gw, gh, 3);
        else ctx.rect(x, y, gw, gh);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#E63946';
        ctx.fillText(i % 2 === 0 ? 'AND' : 'OR', x + gw / 2, y + gh / 2 + 3);
      }

      ctx.fillStyle = '#666';
      ctx.font = '11px monospace';
      ctx.fillText(`${count} gates — unminimized`, W / 2, 210);
    } else {
      // Minimized - use real afterGates from backend
      const count = afterGates || 5;   // fallback just in case
      const cols = Math.min(count, 8);
      const gw = Math.min(36, Math.floor((W - 40) / cols - 6));
      const gh = 22;
      const xStart = (W - cols * (gw + 6)) / 2;

      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = xStart + col * (gw + 6);
        const y = 40 + row * (gh + 10);

        ctx.fillStyle = gateGood;
        ctx.strokeStyle = borderGood;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, gw, gh, 4);
        else ctx.rect(x, y, gw, gh);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#4CAF50';
        ctx.font = '10px monospace';
        ctx.fillText(i % 2 === 0 ? 'AND' : 'OR', x + gw / 2, y + gh / 2 + 3);
      }

      ctx.fillStyle = '#4CAF50';
      ctx.font = '500 11px monospace';
      ctx.fillText(`${count} gates — minimized`, W / 2, 210);
    }
  }, [fn, minimized, afterGates]);

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const W = canvas.parentElement.offsetWidth || 340;
      canvas.width = W;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', display: 'block', borderRadius: 0 }}
    />
  );
}