import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

export default function P4OutOfBand() {
  const [isRunning, setIsRunning] = useState(false);
  const [livePacket, setLivePacket] = useState(null);
  const [history, setHistory] = useState([]);
  const [lastGaspEvents, setLastGaspEvents] = useState([]);

  const socketRef = useRef(null);

  // Connect to Socket.io backend
  useEffect(() => {
    const socket = io('http://localhost:3001'); // Change if your backend port differs
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to NANDGuard P4 Backend');
    });

    // Initial state from backend
    socket.on('init', (data) => {
      setIsRunning(data.simulationRunning || false);
      if (data.latest) {
        setLivePacket(data.latest);
      }
      if (data.history && data.history.length > 0) {
        setHistory(data.history.slice(0, 8));
      }
      if (data.lastGasps) {
        setLastGaspEvents(data.lastGasps);
      }
    });

    // Live packet updates from oob_sim.py
    socket.on('oob_packet', (packet) => {
      setLivePacket(packet);
      
      setHistory(prev => {
        const updated = [packet, ...prev].slice(0, 8);
        return updated;
      });
    });

    // Last Gasp special event
    socket.on('last_gasp', (packet) => {
      setLastGaspEvents(prev => [packet, ...prev].slice(0, 5));
      
      // Show alert as in your original design
      setTimeout(() => {
        alert(`🚨 LAST GASP DETECTED!\nFailure Probability: ${packet.snapshot?.failure_prob}% \nTick: ${packet.tick}`);
      }, 100);
    });

    // Simulation status updates
    socket.on('simulation_status', (data) => {
      setIsRunning(data.running);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleStart = async () => {
    try {
      const res = await fetch('http://localhost:3001/oob/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || 'Failed to start simulation');
      }
    } catch (err) {
      alert('Backend not reachable. Make sure server.js is running.');
    }
  };

  const handleStop = async () => {
    try {
      const res = await fetch('http://localhost:3001/oob/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      await res.json();
    } catch (err) {
      console.error('Failed to stop simulation', err);
    }
  };

  const handleReset = () => {
    handleStop();
    setLivePacket(null);
    setHistory([]);
    setLastGaspEvents([]);
  };

  return (
    <div className="bg-[#080808]">
      {/* Header - Unchanged */}
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

          {/* LIVE BLE PACKET + PHONE BLE SCANNER - Design unchanged */}
          <div className="border border-[#2A2A2A] bg-[#0D0D0D] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1A1A1A] flex items-center justify-between bg-[#111]">
              <span className="font-mono text-[#E63946] text-xs tracking-[0.25em] uppercase">LIVE BLE PACKET</span>
              {livePacket && (
                <div className={`px-5 py-1 text-xs font-mono font-bold tracking-widest rounded-lg ${
                  livePacket.alert_label === 'OK' ? 'bg-[#22c55e]/10 text-[#22c55e]' :
                  livePacket.alert_label === 'WARN' ? 'bg-[#f59e0b]/10 text-[#f59e0b]' :
                  livePacket.alert_label === 'CRITICAL' ? 'bg-[#ef4444]/10 text-[#ef4444]' :
                  'bg-[#7c3aed]/10 text-[#7c3aed] animate-pulse'
                }`}>
                  {livePacket.alert_label}
                </div>
              )}
            </div>

            <div className="p-6">
              <div className="bg-[#080808] border border-[#333] p-5 font-mono text-[#e63946] text-[15px] leading-relaxed break-all min-h-[92px] rounded-xl mb-6">
                {livePacket ? livePacket.raw_hex_display : "Waiting for simulation to start..."}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "FAILURE PROBABILITY", value: `${livePacket?.snapshot?.failure_prob ?? 0}%` },
                  { label: "WEAR LEVEL", value: `${livePacket?.snapshot?.wear_level_pct ?? 0}%` },
                  { label: "BAD BLOCKS", value: livePacket?.snapshot?.bad_block_count ?? 0 },
                  { label: "TEMPERATURE", value: `${livePacket?.snapshot?.temperature_c ?? '—'}°C` },
                ].map((m, i) => (
                  <div key={i} className="bg-[#111111] border border-[#2A2A2A] p-4 rounded-xl">
                    <div className="font-mono text-[#888] text-xs tracking-widest uppercase">{m.label}</div>
                    <div className="text-3xl font-bold text-white mt-2">{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PHONE BLE SCANNER - Design unchanged */}
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

              <h2 className="mt-20 text-2xl font-['Space_Grotesk'] font-black tracking-tighter" 
                  style={{ color: isRunning ? '#22c55e' : '#555' }}>
                {isRunning ? 'BLE SIGNAL ACQUIRED' : 'Waiting for signal...'}
              </h2>
              <p className="mt-6 font-mono text-xl">
                Risk Level: <span style={{ color: livePacket?.alert_color || '#666' }} className="font-bold">
                  {livePacket?.alert_label || '—'}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* PACKET HISTORY - Design unchanged */}
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
                    t={pkt.tick} &nbsp; | &nbsp; 
                    <span className="text-[#e4bebc]">{pkt.alert_label}</span>
                  </span>
                  <span style={{ color: pkt.alert_color }} className="font-bold">
                    {pkt.snapshot?.failure_prob}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Scan ring animation */}
      <style jsx>{`
        .scan-ring {
          animation: ringPulse 2.5s infinite ease-out;
        }
        @keyframes ringPulse {
          0%   { transform: translate(-50%, -50%) scale(0.7); opacity: 0.9; }
          100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}