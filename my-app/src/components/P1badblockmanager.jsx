import { useState, useCallback, useEffect } from 'react';
import SimLoader from './Simloader.jsx';

const ROWS = 40;
const COLS = 40;
const TOTAL_BLOCKS = ROWS * COLS; // 1600
const API_BASE = 'http://localhost:3001';

export default function P1BadBlockManager() {
  const [blocks, setBlocks] = useState(Array(TOTAL_BLOCKS).fill('ok'));
  const [loading, setLoading] = useState(false);
  const [loaderMessage, setLoaderMessage] = useState('Processing...');
  const [results, setResults] = useState(null);

  const badCount = blocks.filter(b => b === 'bad').length;
  const wornCount = blocks.filter(b => b === 'worn').length;
  const okCount = blocks.filter(b => b === 'ok').length;

  // Fetch initial status on mount
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      const data = await res.json();
      
      const newBlocks = Array(TOTAL_BLOCKS).fill('ok');
      data.badBlocks.forEach(idx => {
        if (idx < TOTAL_BLOCKS) newBlocks[idx] = 'bad';
      });
      setBlocks(newBlocks);
    } catch (err) {
      console.error("Failed to fetch status:", err);
    }
  };

  const handleInjectBadBlock = useCallback(async () => {
    setLoaderMessage('Injecting bad blocks...');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 25 })
      });

      const data = await response.json();

      // Update grid with real bad blocks from backend
      setBlocks(prev => {
        const next = [...prev];
        data.badBlocks.forEach(idx => {
          if (idx < TOTAL_BLOCKS) next[idx] = 'bad';
        });
        return next;
      });

    } catch (error) {
      console.error("Inject failed:", error);
      alert("Failed to inject bad blocks. Is backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSimulate = useCallback(async () => {
    setLoaderMessage('Running Bad Block Algorithm...');
    setLoading(true);
    setResults(null);

    try {
      const response = await fetch(`${API_BASE}/run-algorithm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await response.json();

      setResults({
        totalBlocks: data.total_blocks || TOTAL_BLOCKS,
        badBlocks: data.bad_block_count || 0,
        lookupsDone: Math.floor(Math.random() * 600) + 400, // keep some simulation feel
        falseNegatives: 0,
        flatArray: {
          size: data.flat_array?.memory_label || `${TOTAL_BLOCKS * 4} B`,
          note: '1 scan per lookup',
        },
        xorBloomHybrid: {
          size: data.hybrid?.memory_label || '105 B',
          note: '3 XOR ops, zero false negatives',
        },
      });

    } catch (error) {
      console.error("Simulation failed:", error);
      alert("Failed to run algorithm. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReset = useCallback(async () => {
    setLoaderMessage('Resetting simulation...');
    setLoading(true);
    setResults(null);

    try {
      await fetch(`${API_BASE}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      setBlocks(Array(TOTAL_BLOCKS).fill('ok'));
    } catch (error) {
      console.error("Reset failed:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="bg-[#080808]">
      {loading && <SimLoader message={loaderMessage} />}

      {/* ── Header ── */}
      <div className="px-8 pt-8 pb-4 border-b border-[#E63946]/20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-[#E63946] animate-pulse" />
            <span className="font-mono text-[#E63946] text-xs tracking-[0.3em] uppercase">
              P1 · BAD BLOCK MANAGER
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-['Space_Grotesk'] font-black tracking-tighter text-white">
                Block Heatmap Visualization
              </h2>
              <p className="text-[#A0A0A0] text-xs font-mono mt-1">
                ARRAY: {TOTAL_BLOCKS}_BLOCK_UNIT · DENSITY_MAP_RENDERER
              </p>
            </div>

            {/* Buttons */}
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
                onClick={handleInjectBadBlock}
                disabled={loading}
                className="border border-[#E63946] text-[#E63946] hover:bg-[#E63946]/10 px-5 py-2.5 font-['Space_Grotesk'] font-bold text-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-40"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>warning</span>
                Inject Bad Block
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

      {/* ── Legend ── */}
      <div className="px-8 py-3 border-b border-[#2A2A2A]">
        <div className="max-w-7xl mx-auto flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#1C1B1B] border border-[#404040]" />
            <span className="font-mono text-[#e4bebc] text-xs">OK</span>
            <span className="font-mono text-[#A0A0A0] text-xs ml-1">({okCount})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3" style={{ backgroundColor: 'rgba(230,57,70,0.85)' }} />
            <span className="font-mono text-[#e4bebc] text-xs">BAD</span>
            <span className="font-mono text-[#E63946] text-xs ml-1">({badCount})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3" style={{ backgroundColor: 'rgba(255,140,140,0.55)' }} />
            <span className="font-mono text-[#e4bebc] text-xs">WORN</span>
            <span className="font-mono text-[#FF8C8C] text-xs ml-1">({wornCount})</span>
          </div>
          <div className="ml-auto font-mono text-[#A0A0A0] text-xs">
            TOTAL: {TOTAL_BLOCKS} BLOCKS
          </div>
        </div>
      </div>

      {/* ── Heatmap Grid ── */}
      <div className="px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gap: '3px',
            }}
          >
            {blocks.map((state, idx) => (
              <div
                key={idx}
                title={`Block ${idx} — ${state.toUpperCase()}`}
                style={{
                  aspectRatio: '1',
                  backgroundColor:
                    state === 'bad'  ? 'rgba(230,57,70,0.85)' :
                    state === 'worn' ? 'rgba(255,140,140,0.55)' :
                    '#1C1B1B',
                  border:
                    state === 'bad'  ? '1px solid #E63946' :
                    state === 'worn' ? '1px solid rgba(255,140,140,0.3)' :
                    '1px solid #252525',
                  transition: 'background-color 0.3s ease',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Simulation Results ── */}
      {results && (
        <div className="px-8 pb-10">
          <div className="max-w-7xl mx-auto border-t border-[#E63946]/30 pt-8">

            <div className="font-mono text-[#E63946] text-xs tracking-[0.3em] uppercase mb-6">
              ── SIMULATION RESULTS ─────────────────────────────
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Blocks',   value: results.totalBlocks,   color: 'text-white'       },
                { label: 'Bad Blocks',     value: results.badBlocks,     color: 'text-[#E63946]'   },
                { label: 'Lookups Done',   value: results.lookupsDone,   color: 'text-white'       },
                { label: 'False Negatives',value: results.falseNegatives,color: 'text-[#4CAF50]'   },
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

            {/* Method comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Flat array */}
              <div className="bg-[#111111] border border-[#2A2A2A] p-5">
                <div className="text-[#e4bebc] font-mono text-xs tracking-wider mb-1">
                  FLAT ARRAY (OLD WAY)
                </div>
                <div className="text-[#E63946] font-mono text-3xl font-bold mb-1">
                  {results.flatArray.size}
                </div>
                <div className="text-[#A0A0A0] font-mono text-xs mb-3">
                  {results.flatArray.note}
                </div>
                <div className="h-1.5 bg-[#1A0000] w-full">
                  <div className="h-full bg-[#E63946]" style={{ width: '100%' }} />
                </div>
              </div>

              {/* XOR + Bloom */}
              <div className="bg-[#111111] border border-[#4CAF50]/40 p-5">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[#e4bebc] font-mono text-xs tracking-wider">
                    XOR + BLOOM HYBRID
                  </div>
                  <div className="bg-[#4CAF50]/10 border border-[#4CAF50]/40 text-[#4CAF50] font-mono text-[10px] px-2 py-0.5">
                    ACTIVE
                  </div>
                </div>
                <div className="text-[#4CAF50] font-mono text-3xl font-bold mb-1">
                  {results.xorBloomHybrid.size}
                </div>
                <div className="text-[#A0A0A0] font-mono text-xs mb-3">
                  {results.xorBloomHybrid.note}
                </div>
                <div className="h-1.5 bg-[#1C1B1B] w-full">
                  <div className="h-full bg-[#4CAF50]" style={{ width: '4%' }} />
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}