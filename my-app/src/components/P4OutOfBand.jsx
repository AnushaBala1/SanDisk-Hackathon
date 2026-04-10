import { useState, useEffect, useRef } from 'react';
import SimLoader from './Simloader.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function P4OutOfBand() {
  const [isRunning, setIsRunning]   = useState(false);
  const [livePacket, setLivePacket] = useState(null);
  const [history, setHistory]       = useState([]);
  const [tick, setTick]             = useState(0);

  const intervalRef = useRef(null);
  const smartGenRef = useRef({
    t: 0,
    power_on_hours: 8760,
    reallocated: 0,
    uncorrectable: 0,
  });

  const generatePacket = () => {
    const gen = smartGenRef.current;
    gen.t += 1;
    const t = gen.t;

    const rawProb     = 100 / (1 + Math.exp(-0.025 * (t - 280)));
    const failure_prob = Math.max(0, Math.min(100, Math.floor(rawProb + (Math.random() - 0.5) * 4)));
    const wear_level_pct = Math.min(100, Math.floor(t * 0.22 + (Math.random() - 0.5) * 2));

    let bad_block_count;
    if (t < 200)      bad_block_count = Math.floor(t * 0.1  + (Math.random() - 0.5) * 4);
    else if (t < 300) bad_block_count = Math.floor(20 + (t - 200) * 1.5 + (Math.random() - 0.5) * 10);
    else              bad_block_count = Math.floor(170 + (t - 300) * 3.0 + (Math.random() - 0.5) * 16);
    bad_block_count = Math.max(0, bad_block_count);

    const ldpc_fail_rate = Math.max(0, Math.min(255, Math.floor(bad_block_count * 0.8 + (Math.random() - 0.5) * 10)));
    const temperature_c  = Math.max(20, Math.min(85, Math.floor(35 + wear_level_pct * 0.25 + (Math.random() - 0.5) * 3)));

    if (failure_prob >= 80 && Math.random() < 0.15) {
      gen.uncorrectable = Math.min(255, gen.uncorrectable + 1);
    }
    gen.power_on_hours += 1;
    gen.reallocated = Math.min(0xFFFFFFFF, bad_block_count * 2);

    let alert_label = 'OK';
    let alert_color = '#22c55e';

    if (failure_prob >= 90) {
      alert_label = 'LAST_GASP';
      alert_color = '#7c3aed';
    } else if (
      gen.uncorrectable > 0 ||
      failure_prob >= 70 ||
      (failure_prob >= 40 && bad_block_count >= 200) ||
      (bad_block_count >= 200 && wear_level_pct >= 80)
    ) {
      alert_label = 'CRITICAL';
      alert_color = '#ef4444';
    } else if (failure_prob >= 40 || wear_level_pct >= 80 || bad_block_count >= 50) {
      alert_label = 'WARN';
      alert_color = '#f59e0b';
    }

    const raw_hex_display = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()
    ).join(' ');

    const packet = {
      tick: gen.t,
      raw_hex_display,
      alert_label,
      alert_color,
      snapshot: {
        failure_prob,
        wear_level_pct,
        bad_block_count,
        temperature_c,
        ldpc_fail_rate,
        uncorrectable_errors: gen.uncorrectable,
      },
    };

    setLivePacket(packet);
    setTick(gen.t);
    setHistory(prev => [packet, ...prev].slice(0, 8));

    if (alert_label === 'LAST_GASP') {
      setTimeout(() => {
        alert(`🚨 LAST GASP DETECTED!\nFailure Probability: ${failure_prob}%\nTick: ${gen.t}`);
      }, 150);
    }
  };

  const handleStart = async () => {
    // Notify backend — fire and forget, frontend works even if backend is down
    try { await fetch(`${API}/oob/start`, { method: 'POST' }); } catch {}

    setIsRunning(true);
    smartGenRef.current.t = Math.max(smartGenRef.current.t, tick);
    intervalRef.current = setInterval(generatePacket, 900);
  };

  const handleStop = async () => {
    try { await fetch(`${API}/oob/stop`, { method: 'POST' }); } catch {}

    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleReset = async () => {
    await handleStop();
    setLivePacket(null);
    setHistory([]);
    setTick(0);
    smartGenRef.current = {
      t: 0,
      power_on_hours: 8760,
      reallocated: 0,
      uncorrectable: 0,
    };
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Best-effort stop on unmount
      fetch(`${API}/oob/stop`, { method: 'POST' }).catch(() => {});
    };
  }, []);

  return (
    <div className="bg-[#080808]">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b border-[#E63946]/20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-[#E63946] animate-pulse" />
            <span className="font-mono text-[#E63946] text-xs tracking-[0.3em] uppercase">
              P4 · OUT-OF-BAND BLE
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-['Space_Grotesk'] font-black tracking-tighter text-white">
                Out-of-Band BLE Alert System
              </h2>
              <p className="text-[#A0A0A0] text-xs font-mono mt-1">
                INDEPENDENT BLE BROADCAST • SURVIVES HOST CRASH • LAST GASP PROTOCOL
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleStart}
                disabled={isRunning}
                className="border border-[#E63946] text-[#E63946] hover:bg-[#E63946]/10 px-6 py-3 font-['Space_Grotesk'] font-bold text-sm tracking-wider flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                ▶ START OOB SIMULATION
              </button>

              <button
                onClick={handleStop}
                disabled={!isRunning}
                className="bg-[#ef4444] hover:bg-[#f87171] text-white px-6 py-3 font-['Space_Grotesk'] font-bold text-sm tracking-wider flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                ⏹ STOP SIMULATION
              </button>

              <button
                onClick={handleReset}
                className="border border-[#5B403F] text-[#e4bebc] hover:border-[#E63946] hover:text-[#E63946] px-5 py-3 font-['Space_Grotesk'] font-bold text-sm transition-all active:scale-95 flex items-center gap-2"
              >
                RESET
              </button>

              <div className={`font-mono px-5 py-3 rounded-lg text-sm font-bold tracking-widest ${
                isRunning
                  ? 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30'
                  : 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30'
              }`}>
                {isRunning ? '● LIVE' : 'STOPPED'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 pt-6 pb-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* LIVE BLE PACKET */}
          <div className="border border-[#2A2A2A] bg-[#0D0D0D] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1A1A1A] flex items-center justify-between bg-[#111]">
              <span className="font-mono text-[#E63946] text-xs tracking-[0.25em] uppercase">LIVE BLE PACKET</span>
              {livePacket && (
                <div className={`px-5 py-1 text-xs font-mono font-bold tracking-widest rounded-lg ${
                  livePacket.alert_label === 'OK'        ? 'bg-[#22c55e]/10 text-[#22c55e]' :
                  livePacket.alert_label === 'WARN'      ? 'bg-[#f59e0b]/10 text-[#f59e0b]' :
                  livePacket.alert_label === 'CRITICAL'  ? 'bg-[#ef4444]/10 text-[#ef4444]' :
                                                           'bg-[#7c3aed]/10 text-[#7c3aed] animate-pulse'
                }`}>
                  {livePacket.alert_label}
                </div>
              )}
            </div>

            <div className="p-6">
              <div className="bg-[#080808] border border-[#333] p-5 font-mono text-[#e63946] text-[15px] leading-relaxed break-all min-h-[92px] rounded-xl mb-6">
                {livePacket ? livePacket.raw_hex_display : 'Waiting for simulation to start...'}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'FAILURE PROBABILITY', value: `${livePacket?.snapshot?.failure_prob ?? 0}%` },
                  { label: 'WEAR LEVEL',           value: `${livePacket?.snapshot?.wear_level_pct ?? 0}%` },
                  { label: 'BAD BLOCKS',           value: livePacket?.snapshot?.bad_block_count ?? 0 },
                  { label: 'TEMPERATURE',          value: `${livePacket?.snapshot?.temperature_c ?? '—'}°C` },
                ].map((m, i) => (
                  <div key={i} className="bg-[#111111] border border-[#2A2A2A] p-4 rounded-xl">
                    <div className="font-mono text-[#888] text-xs tracking-widest uppercase">{m.label}</div>
                    <div className="text-3xl font-bold text-white mt-2">{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PHONE BLE SCANNER */}
          <div className="border border-[#2A2A2A] bg-[#0D0D0D] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1A1A1A] font-mono text-[#E63946] text-xs tracking-[0.25em] uppercase">
              PHONE BLE SCANNER (LIVE VIEW)
            </div>
            <div className="relative bg-black min-h-[360px] flex flex-col items-center justify-center p-8">
              <div className="relative w-40 h-40">
                {isRunning && (
                  <>
                    <div className="scan-ring absolute top-1/2 left-1/2 w-[130px] h-[130px] border-2 border-[#22c55e]/40 rounded-full -translate-x-1/2 -translate-y-1/2" />
                    <div className="scan-ring absolute top-1/2 left-1/2 w-[130px] h-[130px] border-2 border-[#22c55e]/40 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ animationDelay: '0.8s' }} />
                  </>
                )}
              </div>

              <h2
                className="mt-20 text-2xl font-['Space_Grotesk'] font-black tracking-tighter"
                style={{ color: isRunning ? '#22c55e' : '#555' }}
              >
                {isRunning ? 'BLE SIGNAL ACQUIRED' : 'Waiting for signal...'}
              </h2>
              <p className="mt-6 font-mono text-xl">
                Risk Level:{' '}
                <span style={{ color: livePacket?.alert_color || '#666' }} className="font-bold">
                  {livePacket?.alert_label || '—'}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* PACKET HISTORY */}
        <div className="mt-6 border border-[#2A2A2A] bg-[#0D0D0D] rounded-xl">
          <div className="px-6 py-4 border-b border-[#1A1A1A] font-mono text-[#E63946] text-xs tracking-[0.25em] uppercase">
            PACKET HISTORY (LATEST FIRST)
          </div>
          <div
            className="max-h-[300px] overflow-y-auto divide-y divide-[#1A1A1A] scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {history.length === 0 ? (
              <div className="py-12 text-center text-[#555] font-mono text-sm">
                Start the simulation to see OOB packets
              </div>
            ) : (
              history.map((pkt, i) => (
                <div
                  key={i}
                  className="px-6 py-3 flex justify-between items-center font-mono text-sm hover:bg-[#111]"
                >
                  <span>
                    t={pkt.tick} &nbsp;|&nbsp;
                    <span className="text-[#e4bebc]">{pkt.alert_label}</span>
                    &nbsp;|&nbsp;
                    <span className="text-[#555] text-xs">
                      wear={pkt.snapshot.wear_level_pct}% &nbsp; bad_blk={pkt.snapshot.bad_block_count} &nbsp; ldpc={pkt.snapshot.ldpc_fail_rate}
                    </span>
                  </span>
                  <span style={{ color: pkt.alert_color }} className="font-bold">
                    {pkt.snapshot.failure_prob}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Scan ring animation */}
      <style>{`
        .scan-ring {
          animation: ringPulse 2.5s infinite ease-out;
        }
        @keyframes ringPulse {
          0%   { transform: translate(-50%, -50%) scale(0.7); opacity: 0.9; }
          100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
