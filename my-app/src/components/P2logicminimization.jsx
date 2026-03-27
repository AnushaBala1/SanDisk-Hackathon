import { useState, useEffect, useRef, useCallback } from 'react';
import SimLoader from './Simloader.jsx';

const FNS = [
  {
    id: 'gc_trigger',
    name: 'GC TRIGGER',
    desc: 'Trigger garbage collection?',
    vars: ['wear', 'errs', 'free'],
    rows: [
      { m: [0,0,0], o: 0 }, { m: [0,0,1], o: 0 },
      { m: [0,1,0], o: 0 }, { m: [0,1,1], o: 1 },
      { m: [1,0,0], o: 0 }, { m: [1,0,1], o: 1 },
      { m: [1,1,0], o: 1 }, { m: [1,1,1], o: 2 },
    ],
    gatesBefore: 12,
    piList: [
      { label: 'wear·errs', essential: true },
      { label: 'wear·free', essential: true },
      { label: 'errs·free', essential: false },
    ],
    minimal: 'wear·errs + wear·free',
    cFn: `int gc_trigger(int wear, int errs, int free) {\n  return (wear & errs) | (wear & free);\n}`,
  },
  {
    id: 'wear_level',
    name: 'WEAR LEVELING',
    desc: 'Force wear leveling?',
    vars: ['age', 'writes', 'temp', 'spare'],
    rows: [
      { m: [0,0,0,0], o: 0 }, { m: [0,0,0,1], o: 0 },
      { m: [0,0,1,0], o: 0 }, { m: [0,0,1,1], o: 0 },
      { m: [0,1,0,0], o: 0 }, { m: [0,1,0,1], o: 0 },
      { m: [0,1,1,0], o: 1 }, { m: [0,1,1,1], o: 1 },
      { m: [1,0,0,0], o: 0 }, { m: [1,0,0,1], o: 0 },
      { m: [1,0,1,0], o: 1 }, { m: [1,0,1,1], o: 2 },
      { m: [1,1,0,0], o: 1 }, { m: [1,1,0,1], o: 1 },
      { m: [1,1,1,0], o: 1 }, { m: [1,1,1,1], o: 2 },
    ],
    gatesBefore: 31,
    piList: [
      { label: 'age·writes', essential: true },
      { label: 'temp·writes', essential: true },
      { label: "age·temp·spare'", essential: false },
    ],
    minimal: 'age·writes + temp·writes',
    cFn: `int wear_level(int age, int writes, int temp, int spare) {\n  return (age & writes) | (temp & writes);\n}`,
  },
  {
    id: 'oob_threshold',
    name: 'OOB THRESHOLD',
    desc: 'Trigger OOB alert?',
    vars: ['ecc', 'badrate', 'temp'],
    rows: [
      { m: [0,0,0], o: 0 }, { m: [0,0,1], o: 0 },
      { m: [0,1,0], o: 1 }, { m: [0,1,1], o: 1 },
      { m: [1,0,0], o: 1 }, { m: [1,0,1], o: 2 },
      { m: [1,1,0], o: 1 }, { m: [1,1,1], o: 2 },
    ],
    gatesBefore: 14,
    piList: [
      { label: 'ecc', essential: true },
      { label: 'badrate', essential: true },
    ],
    minimal: 'ecc + badrate',
    cFn: `int oob_threshold(int ecc, int badrate, int temp) {\n  return ecc | badrate;\n}`,
  },
];

/* ── Gate Canvas Renderer ── */
function GateCanvas({ fn, minimized }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.parentElement.offsetWidth || 340;
    canvas.width = W;
    canvas.height = 220;
    ctx.clearRect(0, 0, W, 220);

    const textColor = '#A0A0A0';
    const lineColor = '#303030';
    const gateGood   = 'rgba(76,175,80,0.15)';
    const gateBad    = 'rgba(230,57,70,0.12)';
    const borderGood = '#4CAF50';
    const borderBad  = '#E63946';

    ctx.font = '9px "Space Mono", monospace';
    ctx.textAlign = 'center';

    if (!minimized) {
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
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#E63946';
        ctx.fillText(i % 2 === 0 ? 'AND' : 'OR', x + gw / 2, y + gh / 2 + 3);
      }
      ctx.fillStyle = '#666';
      ctx.font = '11px monospace';
      ctx.fillText(`${count} gates — unminimized`, W / 2, 210);
    } else {
      const after = Math.max(Math.round(fn.gatesBefore * (1 - (fn.gatesBefore > 20 ? 0.92 : 0.75))), 2);
      const cols = Math.min(after, 8);
      const gw = Math.min(36, Math.floor((W - 40) / cols - 6));
      const gh = 22;
      const xStart = (W - cols * (gw + 6)) / 2;
      for (let i = 0; i < after; i++) {
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
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#4CAF50';
        ctx.font = '10px monospace';
        ctx.fillText(i % 2 === 0 ? 'AND' : 'OR', x + gw / 2, y + gh / 2 + 3);
      }
      ctx.fillStyle = '#4CAF50';
      ctx.font = '500 11px monospace';
      ctx.fillText(`${after} gates — minimized`, W / 2, 210);
    }
  }, [fn, minimized]);

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

/* ── Truth Table ── */
function TruthTable({ fn }) {
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
              }}>{v.toUpperCase()}</th>
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
            }}>OUT</th>
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
                  }}>{v}</td>
                ))}
                <td style={{
                  padding: '4px 10px',
                  textAlign: 'center',
                  borderBottom: '1px solid #1A1A1A',
                  color: outColor,
                  fontWeight: row.o > 0 ? 600 : 400,
                }}>{row.o === 2 ? 'X' : row.o}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Main Component ── */
export default function P2LogicMinimization() {
  const [activeFn, setActiveFn] = useState(0);
  const [loading, setLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [results, setResults] = useState(null);
  const [visiblePIs, setVisiblePIs] = useState([]);

  const fn = FNS[activeFn];

  const handleSelectFn = useCallback((i) => {
    setActiveFn(i);
    setMinimized(false);
    setResults(null);
    setVisiblePIs([]);
  }, []);

  const handleSimulate = useCallback(async () => {
    setLoading(true);
    setResults(null);
    setVisiblePIs([]);
    setMinimized(false);

    // Simulate loader duration
    await new Promise(r => setTimeout(r, 1800));
    setLoading(false);

    // Stagger PI list reveals
    const currentFn = FNS[activeFn];
    for (let i = 0; i < currentFn.piList.length; i++) {
      await new Promise(r => setTimeout(r, 220));
      setVisiblePIs(prev => [...prev, i]);
    }

    const after = Math.max(
      Math.round(currentFn.gatesBefore * (1 - (currentFn.gatesBefore > 20 ? 0.92 : 0.75))),
      2
    );
    const pct = Math.round((1 - after / currentFn.gatesBefore) * 100);

    setResults({ after, pct, fn: currentFn });
    setMinimized(true);
  }, [activeFn]);

  const handleReset = useCallback(() => {
    setMinimized(false);
    setResults(null);
    setVisiblePIs([]);
  }, []);

  return (
    <div className="bg-[#080808]">
      {loading && <SimLoader message="Running Quine-McCluskey..." />}

      {/* ── Header ── */}
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

            {/* Buttons */}
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleReset}
                disabled={loading}
                className="border border-[#5B403F] text-[#C0C0C0] hover:border-[#E63946] hover:text-[#E63946] px-5 py-2.5 font-['Space_Grotesk'] font-bold text-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-40"
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

      {/* ── Function Selector ── */}
      <div className="px-8 py-3 border-b border-[#2A2A2A]">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#A0A0A0] font-mono text-[10px] tracking-[0.25em] uppercase pr-4 border-r border-[#2A2A2A] mr-2">
              FUNCTION
            </span>
            {FNS.map((f, i) => (
              <button
                key={f.id}
                onClick={() => handleSelectFn(i)}
                className={`px-4 py-1.5 font-mono text-xs tracking-wider transition-all border ${
                  activeFn === i
                    ? 'border-[#E63946] bg-[#1A0000] text-[#E63946]'
                    : 'border-[#2A2A2A] text-[#A0A0A0] hover:border-[#E63946]/50 hover:text-[#C0C0C0]'
                }`}
              >
                {f.name}
              </button>
            ))}

            {/* Function description */}
            <span className="ml-auto font-mono text-[#555] text-[10px] italic">
              {fn.desc}
            </span>
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
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

      {/* ── Main Content ── */}
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

              {/* Variable info */}
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
                <GateCanvas fn={fn} minimized={minimized} />
              </div>

              {/* Gate count badge */}
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

      {/* ── Simulation Results ── */}
      {(visiblePIs.length > 0 || results) && (
        <div className="px-8 pb-10">
          <div className="max-w-7xl mx-auto border-t border-[#E63946]/30 pt-8">

            <div className="font-mono text-[#E63946] text-xs tracking-[0.3em] uppercase mb-6">
              ── SIMULATION RESULTS ─────────────────────────────
            </div>

            {/* Prime Implicants */}
            {visiblePIs.length > 0 && (
              <div className="mb-6">
                <div className="font-mono text-[#A0A0A0] text-[10px] tracking-[0.2em] uppercase mb-3">
                  PRIME IMPLICANTS FOUND
                </div>
                <div className="bg-[#0D0D0D] border border-[#2A2A2A] p-4 font-mono space-y-2">
                  {fn.piList.map((pi, i) => (
                    visiblePIs.includes(i) && (
                      <div
                        key={i}
                        className="flex items-center gap-3 text-sm"
                        style={{
                          animation: 'fadeInUp 0.3s ease forwards',
                        }}
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
                        <span className="text-[#C0C0C0] text-xs">{pi.label}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Stats + expression + C fn */}
            {results && (
              <>
                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  {[
                    { label: 'Gates Before', value: fn.gatesBefore, color: 'text-[#E63946]' },
                    { label: 'Gates After',  value: results.after,  color: 'text-[#4CAF50]' },
                    { label: 'Reduction',    value: results.pct + '%', color: 'text-white' },
                  ].map(stat => (
                    <div
                      key={stat.label}
                      className="bg-[#111111] border border-[#2A2A2A] border-t-2 border-t-[#E63946] p-5"
                    >
                      <div className="text-[#C0C0C0] font-mono text-xs tracking-wider mb-2 uppercase">
                        {stat.label}
                      </div>
                      <div className={`font-mono text-3xl font-bold ${stat.color}`}>
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Minimal expression */}
                <div className="bg-[#4CAF50]/5 border border-[#4CAF50]/30 p-4 mb-6 flex items-center gap-3">
                  <div className="w-1 h-full min-h-[20px] bg-[#4CAF50] self-stretch" />
                  <div>
                    <div className="font-mono text-[#4CAF50] text-[10px] tracking-[0.2em] uppercase mb-1">
                      MINIMAL EXPRESSION
                    </div>
                    <div className="font-mono text-white text-sm">
                      {results.fn.minimal}
                    </div>
                  </div>
                </div>

                {/* Method comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* SOP (unminimized) */}
                  <div className="bg-[#111111] border border-[#2A2A2A] p-5">
                    <div className="text-[#C0C0C0] font-mono text-xs tracking-wider mb-1">
                      SOP — UNMINIMIZED
                    </div>
                    <div className="text-[#E63946] font-mono text-3xl font-bold mb-1">
                      {fn.gatesBefore} gates
                    </div>
                    <div className="text-[#A0A0A0] font-mono text-xs mb-3">
                      Full canonical form, no reduction
                    </div>
                    <div className="h-1.5 bg-[#1A0000] w-full">
                      <div className="h-full bg-[#E63946]" style={{ width: '100%' }} />
                    </div>
                  </div>

                  {/* QM minimized */}
                  <div className="bg-[#111111] border border-[#4CAF50]/40 p-5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[#C0C0C0] font-mono text-xs tracking-wider">
                        QUINE-McCLUSKEY MINIMIZED
                      </div>
                      <div className="bg-[#4CAF50]/10 border border-[#4CAF50]/40 text-[#4CAF50] font-mono text-[10px] px-2 py-0.5">
                        ACTIVE
                      </div>
                    </div>
                    <div className="text-[#4CAF50] font-mono text-3xl font-bold mb-1">
                      {results.after} gates
                    </div>
                    <div className="text-[#A0A0A0] font-mono text-xs mb-3">
                      Prime implicant extraction, {results.pct}% reduction
                    </div>
                    <div className="h-1.5 bg-[#0A1A0A] w-full">
                      <div
                        className="h-full bg-[#4CAF50]"
                        style={{ width: `${100 - results.pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Generated C function */}
                <div>
                  <div className="font-mono text-[#A0A0A0] text-[10px] tracking-[0.2em] uppercase mb-2">
                    GENERATED C FUNCTION
                  </div>
                  <div className="bg-[#0D0D0D] border border-[#2A2A2A] border-l-2 border-l-[#E63946]">
                    <div className="px-4 py-2 border-b border-[#1A1A1A] flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-[#E63946] animate-pulse" />
                      <span className="font-mono text-[#555] text-[10px] tracking-widest uppercase">
                        output.c
                      </span>
                    </div>
                    <pre className="px-5 py-4 font-mono text-xs text-[#C0C0C0] overflow-x-auto leading-relaxed whitespace-pre">
                      {results.fn.cFn}
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
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}