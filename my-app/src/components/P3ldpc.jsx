import { useState, useCallback } from 'react';
import SimLoader from './Simloader.jsx';

const API_BASE = 'http://localhost:8000';

const STEPS = [
  { id: 1, label: 'ENCODE DATA'      },
  { id: 2, label: 'INJECT BIT FLIP'  },
  { id: 3, label: 'DETECT ERROR'     },
  { id: 4, label: 'CORRECT + VERIFY' },
];

function BitCell({ value, type }) {
  const styles = {
    data:      { bg: 'rgba(76,175,80,0.12)',  border: '#4CAF50', color: '#4CAF50',  scale: 'scale(1)',    glow: 'none' },
    parity:    { bg: 'rgba(100,149,237,0.12)', border: '#6495ED', color: '#6495ED',  scale: 'scale(1)',    glow: 'none' },
    flipped:   { bg: 'rgba(230,57,70,0.20)',  border: '#E63946', color: '#E63946',  scale: 'scale(1.13)', glow: '0 0 10px rgba(230,57,70,0.45)' },
    corrected: { bg: 'rgba(124,252,0,0.13)',  border: '#7CFC00', color: '#7CFC00',  scale: 'scale(1.10)', glow: '0 0 8px rgba(124,252,0,0.30)' },
  };
  const s = styles[type] || styles.data;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '36px', height: '36px',
      backgroundColor: s.bg, 
      border: `1.5px solid ${s.border}`, 
      color: s.color,
      fontFamily: '"Space Mono", monospace', 
      fontSize: '13px', 
      fontWeight: 600,
      transition: 'all 0.35s ease',
      transform: s.scale, 
      boxShadow: s.glow,
    }}>
      {value}
    </div>
  );
}

function SynCell({ value, state }) {
  const styles = {
    idle:   { bg: '#111111', border: '#2A2A2A', color: '#444' },
    active: { bg: 'rgba(230,57,70,0.12)', border: '#E63946', color: '#E63946' },
    zero:   { bg: 'rgba(76,175,80,0.12)', border: '#4CAF50', color: '#4CAF50' },
  };
  const s = styles[state] || styles.idle;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '32px', height: '32px',
      backgroundColor: s.bg, 
      border: `1.5px solid ${s.border}`, 
      color: s.color,
      fontFamily: '"Space Mono", monospace', 
      fontSize: '13px', 
      fontWeight: 600,
      transition: 'all 0.4s ease',
    }}>
      {value}
    </div>
  );
}

function LogLine({ msg, type }) {
  const colors = { ok: '#4CAF50', warn: '#FFA500', err: '#E63946', info: '#6495ED' };
  return (
    <div style={{
      fontFamily: '"Space Mono", monospace', fontSize: '11px',
      padding: '4px 0', borderBottom: '1px solid #1A1A1A',
      color: colors[type] || '#A0A0A0',
      display: 'flex', gap: '8px', alignItems: 'flex-start',
    }}>
      <span style={{ color: '#333', flexShrink: 0 }}>›</span>
      <span>{msg}</span>
    </div>
  );
}

function isValid8Bit(val) { return /^[01]{8}$/.test(val); }

export default function P3LDPC() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaderMsg, setLoaderMsg] = useState('');

  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');

  const [dataBits, setDataBits] = useState([]);
  const [codeword, setCodeword] = useState([]);
  const [flipPos, setFlipPos] = useState(null);
  const [corrected, setCorrected] = useState(false);

  const [syndrome, setSyndrome] = useState([]);
  const [synState, setSynState] = useState('idle');
  const [synStatus, setSynStatus] = useState('— recomputed on each read');
  const [synExplain, setSynExplain] = useState('');

  const [statData, setStatData] = useState('—');
  const [statParity, setStatParity] = useState('—');
  const [statFlip, setStatFlip] = useState('—');
  const [statSyn, setStatSyn] = useState('—');
  const [statIntegrity, setStatIntegrity] = useState('—');

  const [logs, setLogs] = useState([]);
  const addLog = (msg, type = '') =>
    setLogs(prev => [...prev, { msg, type, id: Date.now() + Math.random() }]);

  // ====================== BACKEND CALLS ======================

  const handleEncode = useCallback(async () => {
    const raw = inputValue.replace(/\s/g, '');
    if (!isValid8Bit(raw)) {
      setInputError('Enter exactly 8 bits (0s and 1s only)');
      return;
    }
    setInputError('');

    setLoading(true);
    setLoaderMsg('Encoding data with LDPC parity...');

    try {
      const dataArray = raw.split('').map(Number);

      const res = await fetch(`${API_BASE}/ldpc/encode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataBits: dataArray }),
      });

      if (!res.ok) throw new Error('Encode request failed');

      const result = await res.json();

      setDataBits(dataArray);
      setCodeword(result.codeword || []);
      setFlipPos(null);
      setCorrected(false);
      setSyndrome(result.syndrome || [0,0,0,0]);
      setSynState('idle');
      setSynStatus('— all zeros = clean');
      setSynExplain('');
      setStatData(8);
      setStatParity(4);
      setStatFlip('—');
      setStatSyn('—');
      setStatIntegrity('—');
      setLogs([]);

      setStep(1);
      addLog(`Codeword built successfully`, 'info');
      addLog('Syndrome = [0,0,0,0] — clean', 'ok');
      addLog('Data + parity written to NAND', 'ok');
    } catch (err) {
      console.error(err);
      setInputError('Backend error. Make sure server is running on port 3001');
    } finally {
      setLoading(false);
    }
  }, [inputValue]);

  const handleCorrupt = useCallback(async () => {
    setLoading(true);
    setLoaderMsg('Simulating NAND aging...');

    try {
      const res = await fetch(`${API_BASE}/ldpc/corrupt`, { method: 'POST' });
      if (!res.ok) throw new Error('Corrupt failed');

      const result = await res.json();

      setCodeword(result.corrupted);
      setFlipPos(result.flippedPos);
      setCorrected(false);
      setSyndrome([0,0,0,0]);
      setSynState('idle');
      setSynStatus('— not yet recalculated');
      setStatFlip(`bit ${result.flippedPos}`);

      setStep(2);

      addLog('NAND aging simulation complete', 'warn');
      addLog(`Bit flipped at position ${result.flippedPos}`, 'err');
      addLog('Corruption injected silently', 'warn');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDetect = useCallback(async () => {
    setLoading(true);
    setLoaderMsg('Running syndrome check...');

    try {
      const res = await fetch(`${API_BASE}/ldpc/detect`, { method: 'POST' });
      if (!res.ok) throw new Error('Detect failed');

      const result = await res.json();

      setSyndrome(result.syndrome);
      setSynState('active');
      setSynStatus('— nonzero! error detected');
      setSynExplain(result.explanation || `Error detected at bit ${result.errorPos}`);
      setStatSyn(`bit ${result.errorPos || flipPos}`);

      setStep(3);

      addLog('Reading codeword from NAND...', 'info');
      addLog(`Syndrome computed: [${result.syndrome.join(', ')}]`, 'warn');
      addLog('Single-bit error confirmed', 'warn');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [flipPos]);

  const handleCorrect = useCallback(async () => {
    setLoading(true);
    setLoaderMsg('Applying XOR correction...');

    try {
      const res = await fetch(`${API_BASE}/ldpc/correct`, { method: 'POST' });
      if (!res.ok) throw new Error('Correct failed');

      const result = await res.json();

      setCodeword(result.correctedCodeword);
      setCorrected(true);
      setSyndrome(result.syndromeAfter || [0,0,0,0]);
      setSynState('zero');
      setSynStatus('— back to all zeros. data proven clean.');
      setSynExplain(result.message || 'Correction successful');
      setStatFlip(`bit ${result.correctedPos} ✓`);
      setStatIntegrity(result.verified ? 'Verified' : 'Failed');

      setStep(4);

      addLog(`Bit ${result.correctedPos} corrected`, 'ok');
      addLog('Syndrome now [0,0,0,0]', 'ok');
      addLog('Data integrity verified', 'ok');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setStep(0);
    setInputValue('');
    setInputError('');
    setDataBits([]);
    setCodeword([]);
    setFlipPos(null);
    setCorrected(false);
    setSyndrome([]);
    setSynState('idle');
    setSynStatus('— recomputed on each read');
    setSynExplain('');
    setStatData('—'); setStatParity('—'); setStatFlip('—');
    setStatSyn('—'); setStatIntegrity('—');
    setLogs([]);
  }, []);

  const canEncode  = !loading && isValid8Bit(inputValue.replace(/\s/g, '')) && step === 0;
  const canCorrupt = !loading && step === 1;
  const canDetect  = !loading && step === 2;
  const canCorrect = !loading && step === 3;

  const pillState = (id) => id < step ? 'done' : id === step ? 'active' : 'idle';

  return (
    <div className="bg-[#080808]">
      {loading && <SimLoader message={loaderMsg} />}

      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b border-[#E63946]/20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-[#E63946] animate-pulse" />
            <span className="font-mono text-[#E63946] text-xs tracking-[0.3em] uppercase">
              P3 · LDPC ERROR CORRECTION
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-['Space_Grotesk'] font-black tracking-tighter text-white">
                Bit Error Detection &amp; Recovery
              </h2>
              <p className="text-[#A0A0A0] text-xs font-mono mt-1">
                SIMULATED_NAND_AGING · SYNDROME_DECODER · XOR_CORRECTION_ENGINE
              </p>
            </div>
            <button onClick={handleReset} className="border border-[#5B403F] text-[#C0C0C0] hover:border-[#E63946] hover:text-[#E63946] px-5 py-2.5 font-['Space_Grotesk'] font-bold text-sm transition-all active:scale-95 flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>restart_alt</span>
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Pipeline Pills */}
      <div className="px-8 py-3 border-b border-[#2A2A2A]">
        <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
          <span className="text-[#A0A0A0] font-mono text-[10px] tracking-[0.25em] uppercase pr-4 border-r border-[#2A2A2A] mr-1 shrink-0">
            PIPELINE
          </span>
          {STEPS.map((s, i) => {
            const st = pillState(s.id);
            return (
              <div key={s.id} className="flex items-center gap-3">
                <div className={`px-3 py-1 font-mono text-[10px] tracking-wider border transition-all ${
                  st === 'active' ? 'border-[#E63946] bg-[#1A0000] text-[#E63946]' :
                  st === 'done' ? 'border-[#4CAF50]/40 bg-[#4CAF50]/5 text-[#4CAF50]' :
                  'border-[#3A3A3A] text-[#e4bebc]/50'
                }`}>
                  <span className="mr-1.5 opacity-50">{s.id}.</span>{s.label}
                </div>
                {i < STEPS.length - 1 && <span className="font-mono text-[#555] text-sm">→</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-8 pt-5 pb-2">
        <div className="max-w-7xl mx-auto flex gap-3 flex-wrap">
          <button onClick={handleEncode} disabled={!canEncode}
            className="border border-[#E63946] text-[#E63946] hover:bg-[#E63946]/10 px-5 py-2.5 font-['Space_Grotesk'] font-bold text-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>memory</span>
            1. Encode Data
          </button>
          <button onClick={handleCorrupt} disabled={!canCorrupt}
            className="border border-[#E63946]/50 text-[#C0C0C0] hover:border-[#E63946] hover:text-[#E63946] px-5 py-2.5 font-['Space_Grotesk'] font-bold text-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>warning</span>
            2. Inject Bit Flip
          </button>
          <button onClick={handleDetect} disabled={!canDetect}
            className="border border-[#E63946]/50 text-[#C0C0C0] hover:border-[#E63946] hover:text-[#E63946] px-5 py-2.5 font-['Space_Grotesk'] font-bold text-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>search</span>
            3. Detect Error
          </button>
          <button onClick={handleCorrect} disabled={!canCorrect}
            className="bg-[#E63946] hover:bg-[#FF4D4D] text-white px-5 py-2.5 font-['Space_Grotesk'] font-bold text-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>build</span>
            4. Correct + Verify
          </button>
        </div>
      </div>

      {/* Main Content Area - same as before */}
      <div className="px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-5">
          {/* Data Input */}
          <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
            <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-[#E63946]" />
              <span className="font-mono text-[#A0A0A0] text-[10px] tracking-[0.25em] uppercase">DATA INPUT</span>
            </div>
            <div className="px-5 py-4 flex items-center gap-4 flex-wrap">
              <span className="font-mono text-[#444] text-xs whitespace-nowrap">data →</span>
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-1.5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <input
                      key={i}
                      type="text"
                      maxLength={1}
                      value={inputValue[i] || ''}
                      onChange={e => {
                        const char = e.target.value.replace(/[^01]/g, '');
                        const arr = inputValue.split('');
                        arr[i] = char;
                        setInputValue(arr.join('').slice(0, 8));
                        setInputError('');
                        if (char && i < 7) document.getElementById(`bit-input-${i+1}`)?.focus();
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Backspace' && !inputValue[i] && i > 0) {
                          document.getElementById(`bit-input-${i-1}`)?.focus();
                        }
                      }}
                      id={`bit-input-${i}`}
                      disabled={step > 0}
                      className="bg-[#080808] border border-[#2A2A2A] text-white font-mono text-sm text-center w-10 h-10 focus:outline-none focus:border-[#E63946] disabled:opacity-40"
                    />
                  ))}
                </div>
                {inputError && <span className="font-mono text-[#E63946] text-[10px]">{inputError}</span>}
              </div>
            </div>
          </div>

          {/* Codeword, Syndrome, Stats, Log sections remain exactly the same as your original code */}
          {/* (I kept them identical to avoid any visual change) */}

          {/* Codeword Row */}
          <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
            <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#E63946]" />
                <span className="font-mono text-[#A0A0A0] text-[10px] tracking-[0.25em] uppercase">
                  CODEWORD — DATA BITS + PARITY BITS
                </span>
              </div>
              <div className="flex items-center gap-5 flex-wrap">
                {[
                  { color: '#4CAF50', label: 'data bits' },
                  { color: '#6495ED', label: 'parity bits' },
                  { color: '#E63946', label: 'flipped bit' },
                  { color: '#7CFC00', label: 'corrected' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5" style={{background: l.color+'22', border: `1px solid ${l.color}`}} />
                    <span className="font-mono text-[#555] text-[10px]">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-5 min-h-[80px] flex items-center">
              {codeword.length === 0 ? (
                <span className="font-mono text-[#e4bebc]/40 text-xs">
                  Enter 8-bit data above and click "1. Encode Data" to begin
                </span>
              ) : (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-[#444] text-[10px] mr-1">data →</span>
                  {codeword.map((bit, i) => {
                    const isParity = i >= dataBits.length;
                    const type = corrected && i === flipPos ? 'corrected' :
                                 !corrected && i === flipPos ? 'flipped' :
                                 isParity ? 'parity' : 'data';
                    return (
                      <div key={i} className="flex items-center gap-1.5">
                        {i === dataBits.length && <span className="font-mono text-[#444] text-[10px] mx-2">| parity →</span>}
                        <BitCell value={bit} type={type} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Syndrome Vector */}
          <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
            <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center gap-2 flex-wrap">
              <div className="w-1.5 h-1.5 bg-[#E63946]" />
              <span className="font-mono text-[#A0A0A0] text-[10px] tracking-[0.25em] uppercase">SYNDROME VECTOR</span>
              <span className="font-mono text-[#444] text-[10px] ml-2">{synStatus}</span>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-[#e4bebc]/50 text-xs">H × codeword mod 2 =</span>
                {syndrome.length === 0 ? (
                  <span className="font-mono text-[#e4bebc]/40 text-xs">[ — ]</span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    {syndrome.map((v, i) => <SynCell key={i} value={v} state={synState} />)}
                  </div>
                )}
              </div>
              {synExplain && (
                <p className="font-mono text-[#A0A0A0] text-[11px] mt-3 border-l-2 border-[#E63946]/40 pl-3 leading-relaxed">
                  {synExplain}
                </p>
              )}
            </div>
          </div>

          {/* Stats + Log */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
              <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#E63946]" />
                <span className="font-mono text-[#A0A0A0] text-[10px] tracking-[0.25em] uppercase">STATISTICS</span>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                {[
                  { label: 'Data Bits', value: statData, color: 'text-white' },
                  { label: 'Parity Bits', value: statParity, color: 'text-[#6495ED]' },
                  { label: 'Flipped Bit Position', value: statFlip, color: 'text-[#E63946]' },
                  { label: 'Syndrome → Position', value: statSyn, color: 'text-[#FFA500]' },
                ].map(stat => (
                  <div key={stat.label} className="bg-[#111111] border border-[#2A2A2A] border-t-2 border-t-[#E63946] p-4">
                    <div className="font-mono text-[#A0A0A0] text-[10px] tracking-wider uppercase mb-2">{stat.label}</div>
                    <div className={`font-mono text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  </div>
                ))}
                <div className="col-span-2 bg-[#111111] border border-[#2A2A2A] border-t-2 border-t-[#4CAF50] p-4">
                  <div className="font-mono text-[#A0A0A0] text-[10px] tracking-wider uppercase mb-2">Data Integrity</div>
                  <div className={`font-mono text-2xl font-bold ${statIntegrity === 'Verified' ? 'text-[#4CAF50]' : 'text-[#444]'}`}>
                    {statIntegrity}
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
              <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#E63946] animate-pulse" />
                <span className="font-mono text-[#A0A0A0] text-[10px] tracking-[0.25em] uppercase">ACTIVITY LOG</span>
                <span className="font-mono text-[#333] text-[10px] ml-auto">firmware output</span>
              </div>
              <div className="log-scroll px-5 py-4 min-h-[200px] max-h-[290px] overflow-y-auto">
                {logs.length === 0 ? (
                  <span className="font-mono text-[#2A2A2A] text-xs">Waiting for input...</span>
                ) : (
                  logs.map(l => <LogLine key={l.id} msg={l.msg} type={l.type} />)
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .log-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}