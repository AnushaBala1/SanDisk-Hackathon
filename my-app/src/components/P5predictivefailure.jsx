import { useState, useEffect, useRef, useCallback } from 'react';
import SimLoader from './Simloader.jsx';

// ── Static replay data (replace with SSE from /predict/replay/:type later) ──
const HEALTHY_REPLAY = Array.from({ length: 30 }, (_, i) => ({
  day: 142 + i * 10,
  failure_prob: Math.max(2, Math.min(18, 5 + i * 0.3 + (Math.random() - 0.5) * 3)),
  estimated_days_remaining: Math.max(800, 1050 - i * 8),
  alert_label: 'OK',
  wear_level_pct: Math.min(30, 8 + i * 0.6),
  bad_block_count: Math.floor(2 + i * 0.5),
  ldpc_fail_rate: Math.floor(1 + i * 0.2),
  temperature_c: Math.floor(33 + (Math.random() - 0.5) * 4),
}));

const FAILURE_REPLAY = Array.from({ length: 30 }, (_, i) => {
  const prob = Math.min(98, 20 + i * 2.8 + (Math.random() - 0.5) * 5);
  const alert_label =
    prob >= 90 ? 'LAST_GASP' :
    prob >= 70 ? 'CRITICAL' :
    prob >= 40 ? 'WARN' : 'OK';
  return {
    day: 387 + i * 7,
    failure_prob: Math.floor(prob),
    estimated_days_remaining: Math.max(0, 98 - i * 4),
    alert_label,
    wear_level_pct: Math.min(100, 60 + i * 1.5),
    bad_block_count: Math.floor(80 + i * 7 + (Math.random() - 0.5) * 10),
    ldpc_fail_rate: Math.floor(60 + i * 5),
    temperature_c: Math.floor(48 + i * 0.5 + (Math.random() - 0.5) * 3),
  };
});

// ── Circular gauge ──
function FailureGauge({ prob, alertLabel }) {
  const alertColors = {
    OK:        '#4CAF50',
    WARN:      '#FFA500',
    CRITICAL:  '#E63946',
    LAST_GASP: '#7c3aed',
  };
  const color = alertColors[alertLabel] || '#4CAF50';
  const r = 70;
  const circ = 2 * Math.PI * r;
  const dash = (prob / 100) * circ;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 180, height: 180 }}>
        <svg width="180" height="180" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="90" cy="90" r={r} fill="none" stroke="#1A1A1A" strokeWidth="12" />
          <circle
            cx="90" cy="90" r={r} fill="none"
            stroke={color} strokeWidth="12"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="butt"
            style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono font-bold"
            style={{ fontSize: '38px', color, lineHeight: 1, transition: 'color 0.4s ease' }}
          >
            {prob}%
          </span>
          <span className="font-mono text-[#555] text-[10px] tracking-widest mt-1">FAILURE PROB</span>
        </div>
      </div>
    </div>
  );
}

// ── Alert badge ──
function AlertBadge({ label }) {
  const styles = {
    OK:        'bg-[#4CAF50]/10 border-[#4CAF50]/40 text-[#4CAF50]',
    WARN:      'bg-[#FFA500]/10 border-[#FFA500]/40 text-[#FFA500]',
    CRITICAL:  'bg-[#E63946]/10 border-[#E63946]/40 text-[#E63946]',
    LAST_GASP: 'bg-[#7c3aed]/10 border-[#7c3aed]/40 text-[#7c3aed] animate-pulse',
  };
  return (
    <span className={`font-mono text-[10px] px-2 py-0.5 border tracking-widest ${styles[label] || styles.OK}`}>
      {label}
    </span>
  );
}

// ── Log line ──
function LogLine({ day, prob, alert_label }) {
  const colors = {
    OK: '#4CAF50', WARN: '#FFA500', CRITICAL: '#E63946', LAST_GASP: '#7c3aed',
  };
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-[#1A1A1A] font-mono text-[11px]">
      <span className="text-[#444] w-14 shrink-0">Day {day}</span>
      <span className="text-[#333]">|</span>
      <span style={{ color: colors[alert_label] || '#4CAF50' }} className="font-bold w-20 shrink-0">
        {alert_label}
      </span>
      <span className="text-[#333]">|</span>
      <span className="text-[#e4bebc]">{Math.floor(prob)}% failure prob</span>
    </div>
  );
}

export default function P5PredictiveFailure() {
  const [driveType,   setDriveType]   = useState('healthy'); // 'healthy' | 'failure'
  const [isRunning,   setIsRunning]   = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [snapshot,    setSnapshot]    = useState(null);
  const [logs,        setLogs]        = useState([]);
  const [replayIdx,   setReplayIdx]   = useState(0);

  const intervalRef = useRef(null);
  const logBoxRef   = useRef(null);

  const replayData = driveType === 'failure' ? FAILURE_REPLAY : HEALTHY_REPLAY;

  // ── Scroll log to bottom ──
  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [logs]);

  // ── Cleanup on unmount ──
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const handleStart = useCallback(async () => {
    if (isRunning) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setLoading(false);
    setIsRunning(true);
    setLogs([]);
    setReplayIdx(0);
    setSnapshot(null);
  }, [isRunning]);

  // ── Advance replay tick ──
  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setReplayIdx(prev => {
        if (prev >= replayData.length - 1) {
          clearInterval(intervalRef.current);
          setIsRunning(false);
          return prev;
        }
        const frame = replayData[prev];
        setSnapshot(frame);
        setLogs(l => [...l, frame]);
        return prev + 1;
      });
    }, 800);

    return () => clearInterval(intervalRef.current);
  }, [isRunning, replayData]);

  const handleStop = useCallback(() => {
    setIsRunning(false);
    clearInterval(intervalRef.current);
  }, []);

  const handleReset = useCallback(() => {
    handleStop();
    setSnapshot(null);
    setLogs([]);
    setReplayIdx(0);
  }, [handleStop]);

  const handleDriveChange = useCallback((type) => {
    handleReset();
    setDriveType(type);
  }, [handleReset]);

  const snap = snapshot || replayData[0];

  return (
    <div className="bg-[#080808]">
      {loading && <SimLoader message="Loading prediction model..." />}

      {/* ── Header ── */}
      <div className="px-8 pt-8 pb-4 border-b border-[#E63946]/20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-[#E63946] animate-pulse" />
            <span className="font-mono text-[#E63946] text-xs tracking-[0.3em] uppercase">
              P5 · PREDICTIVE FAILURE ANALYSIS
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-['Space_Grotesk'] font-black tracking-tighter text-white">
                Failure Probability Engine
              </h2>
              <p className="text-[#e4bebc] text-xs font-mono mt-1">
                XGBOOST_MODEL · BACKBLAZE_DATASET · REAL_DRIVE_REPLAY · 30_DAY_PREDICTION_WINDOW
              </p>
            </div>

            {/* Controls */}
            <div className="flex gap-3 flex-wrap items-center">
              <button
                onClick={handleReset}
                className="border border-[#5B403F] text-[#e4bebc] hover:border-[#E63946] hover:text-[#E63946] px-5 py-2.5 font-['Space_Grotesk'] font-bold text-sm transition-all active:scale-95 flex items-center gap-2"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>restart_alt</span>
                Reset
              </button>
              <button
                onClick={handleStop}
                disabled={!isRunning}
                className="border border-[#E63946]/50 text-[#e4bebc] hover:border-[#E63946] hover:text-[#E63946] px-5 py-2.5 font-['Space_Grotesk'] font-bold text-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>stop</span>
                Stop
              </button>
              <button
                onClick={handleStart}
                disabled={isRunning}
                className="bg-[#E63946] hover:bg-[#FF4D4D] text-white px-5 py-2.5 font-['Space_Grotesk'] font-bold text-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>play_arrow</span>
                Start Replay
              </button>

              {/* Live/Stopped badge */}
              <div className={`font-mono px-4 py-2 text-xs tracking-widest border ${
                isRunning
                  ? 'bg-[#4CAF50]/10 text-[#4CAF50] border-[#4CAF50]/30'
                  : 'bg-[#E63946]/10 text-[#E63946] border-[#E63946]/20'
              }`}>
                {isRunning ? '● LIVE' : 'STOPPED'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Drive Selector ── */}
      <div className="px-8 py-3 border-b border-[#2A2A2A]">
        <div className="max-w-7xl mx-auto flex items-center gap-4 flex-wrap">
          <span className="text-[#e4bebc] font-mono text-[10px] tracking-[0.25em] uppercase pr-4 border-r border-[#2A2A2A]">
            DRIVE TYPE
          </span>
          {[
            { id: 'healthy', label: 'HEALTHY DRIVE', sub: 'Long-lived · Low failure probability', color: '#4CAF50' },
            { id: 'failure', label: 'FAILURE DRIVE', sub: 'Degrading · Rising failure probability', color: '#E63946' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => handleDriveChange(opt.id)}
              className={`flex items-center gap-3 px-4 py-2 border transition-all font-mono text-xs ${
                driveType === opt.id
                  ? 'border-[#E63946] bg-[#1A0000]'
                  : 'border-[#2A2A2A] hover:border-[#E63946]/40'
              }`}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />
              <div className="text-left">
                <div className={driveType === opt.id ? 'text-white' : 'text-[#e4bebc]'}>{opt.label}</div>
                <div className="text-[#555] text-[9px] tracking-wide">{opt.sub}</div>
              </div>
            </button>
          ))}

          {/* Progress indicator */}
          {isRunning && (
            <div className="ml-auto flex items-center gap-2">
              <span className="font-mono text-[#555] text-[10px]">REPLAY</span>
              <div className="w-32 h-1 bg-[#1A1A1A]">
                <div
                  className="h-full bg-[#E63946] transition-all duration-700"
                  style={{ width: `${(replayIdx / (replayData.length - 1)) * 100}%` }}
                />
              </div>
              <span className="font-mono text-[#e4bebc] text-[10px]">
                {replayIdx}/{replayData.length - 1}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-5">

          {/* ── Top row: Gauge + Stats ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Gauge card */}
            <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
              <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-[#E63946]" />
                  <span className="font-mono text-[#e4bebc] text-[10px] tracking-[0.25em] uppercase">
                    FAILURE PROBABILITY
                  </span>
                </div>
                <AlertBadge label={snap?.alert_label || 'OK'} />
              </div>
              <div className="p-6 flex flex-col items-center gap-4">
                <FailureGauge
                  prob={Math.floor(snap?.failure_prob ?? 0)}
                  alertLabel={snap?.alert_label || 'OK'}
                />

                {/* Days remaining */}
                <div className="w-full border border-[#2A2A2A] bg-[#111111] border-t-2 border-t-[#E63946] p-4 text-center">
                  <div className="font-mono text-[#e4bebc] text-[10px] tracking-wider uppercase mb-1">
                    Estimated Days Remaining
                  </div>
                  <div className="font-mono text-3xl font-bold text-white">
                    {snap?.estimated_days_remaining ?? '—'}
                  </div>
                </div>

                {/* Day / age */}
                <div className="w-full border border-[#2A2A2A] bg-[#111111] p-3 flex items-center justify-between">
                  <span className="font-mono text-[#e4bebc] text-[10px] tracking-wider uppercase">Drive Age</span>
                  <span className="font-mono text-white text-sm font-bold">Day {snap?.day ?? '—'}</span>
                </div>
              </div>
            </div>

            {/* SMART stats */}
            <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
              <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#E63946]" />
                <span className="font-mono text-[#e4bebc] text-[10px] tracking-[0.25em] uppercase">
                  SMART FEATURE SNAPSHOT
                </span>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                {[
                  { label: 'Wear Level',      value: `${snap?.wear_level_pct ?? '—'}%`,   color: 'text-[#FFA500]' },
                  { label: 'Bad Block Count', value: snap?.bad_block_count ?? '—',         color: 'text-[#E63946]' },
                  { label: 'LDPC Fail Rate',  value: snap?.ldpc_fail_rate ?? '—',          color: 'text-[#6495ED]' },
                  { label: 'Temperature',     value: `${snap?.temperature_c ?? '—'}°C`,   color: 'text-white'     },
                ].map(s => (
                  <div key={s.label} className="bg-[#111111] border border-[#2A2A2A] border-t-2 border-t-[#E63946] p-4">
                    <div className="font-mono text-[#e4bebc] text-[10px] tracking-wider uppercase mb-2">{s.label}</div>
                    <div className={`font-mono text-2xl font-bold ${s.color}`}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Feature importance bar — static visual */}
              <div className="px-4 pb-4">
                <div className="font-mono text-[#e4bebc] text-[10px] tracking-[0.2em] uppercase mb-3">
                  ── FEATURE IMPORTANCE (SHAP)
                </div>
                {[
                  { label: 'bad_block_count',  pct: 38, color: '#E63946' },
                  { label: 'ldpc_fail_rate',   pct: 28, color: '#6495ED' },
                  { label: 'wear_level_pct',   pct: 20, color: '#FFA500' },
                  { label: 'temperature_c',    pct: 14, color: '#4CAF50' },
                ].map(f => (
                  <div key={f.label} className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-[#555] text-[10px] w-36 shrink-0">{f.label}</span>
                    <div className="flex-1 h-1.5 bg-[#1A1A1A]">
                      <div
                        className="h-full transition-all duration-700"
                        style={{ width: `${f.pct}%`, backgroundColor: f.color }}
                      />
                    </div>
                    <span className="font-mono text-[#e4bebc] text-[10px] w-8 text-right">{f.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Trajectory chart (canvas) + Activity log ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Probability trajectory */}
            <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
              <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#E63946]" />
                <span className="font-mono text-[#e4bebc] text-[10px] tracking-[0.25em] uppercase">
                  FAILURE PROBABILITY TRAJECTORY
                </span>
              </div>
              <div className="p-4">
                {logs.length < 2 ? (
                  <div className="h-[180px] flex items-center justify-center">
                    <span className="font-mono text-[#2A2A2A] text-xs">Start replay to see trajectory</span>
                  </div>
                ) : (
                  <TrajectoryChart logs={logs} driveType={driveType} />
                )}
              </div>
            </div>

            {/* Activity log */}
            <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
              <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 bg-[#E63946]"
                  style={{ animation: isRunning ? 'pulse 1s infinite' : 'none' }}
                />
                <span className="font-mono text-[#e4bebc] text-[10px] tracking-[0.25em] uppercase">
                  PREDICTION LOG
                </span>
                <span className="font-mono text-[#333] text-[10px] ml-auto">XGBoost output</span>
              </div>
              <div
                ref={logBoxRef}
                className="px-5 py-4 min-h-[200px] max-h-[260px] overflow-y-auto"
              >
                {logs.length === 0 ? (
                  <span className="font-mono text-[#2A2A2A] text-xs">Waiting for replay...</span>
                ) : (
                  [...logs].reverse().map((l, i) => (
                    <LogLine key={i} day={l.day} prob={l.failure_prob} alert_label={l.alert_label} />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── Pipeline explanation ── */}
          <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
            <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-[#E63946]" />
              <span className="font-mono text-[#e4bebc] text-[10px] tracking-[0.25em] uppercase">
                TWO-STAGE PIPELINE
              </span>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Stage 1 */}
              <div className="border border-[#2A2A2A] bg-[#111111] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-[10px] px-2 py-0.5 border border-[#E63946]/40 text-[#E63946] bg-[#E63946]/10">
                    STAGE 1
                  </span>
                  <span className="font-mono text-[#e4bebc] text-xs font-bold">OFFLINE TRAINING</span>
                </div>
                {[
                  'XGBoost trained on Backblaze public dataset — 100,000+ real drives',
                  'Feature engineering — 7-day deltas, wear velocity, error acceleration',
                  'NANDGuard features — bad_block_count (P1) + ldpc_fail_rate (P3)',
                  'Isolation Forest detects anomalous failure modes',
                  'Outputs — failure probability 0–100, estimated days remaining, SHAP attribution',
                ].map((pt, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <span className="text-[#E63946] font-mono text-[10px] mt-0.5 shrink-0">›</span>
                    <span className="font-mono text-[#e4bebc] text-[10px] leading-relaxed">{pt}</span>
                  </div>
                ))}
              </div>
              {/* Stage 2 */}
              <div className="border border-[#4CAF50]/30 bg-[#111111] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-[10px] px-2 py-0.5 border border-[#4CAF50]/40 text-[#4CAF50] bg-[#4CAF50]/10">
                    STAGE 2
                  </span>
                  <span className="font-mono text-[#e4bebc] text-xs font-bold">FIRMWARE EXPORT</span>
                </div>
                {[
                  'Trained model distilled into pure C function predict_failure()',
                  'Integer arithmetic only — zero external libraries — zero OS dependency',
                  'Under 2KB flash footprint — ARM Cortex-M compatible',
                  'Executes in under 1 microsecond on Cortex-M4',
                  'When score ≥ 70% — automatically triggers P4 OOB alert',
                ].map((pt, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <span className="text-[#4CAF50] font-mono text-[10px] mt-0.5 shrink-0">›</span>
                    <span className="font-mono text-[#e4bebc] text-[10px] leading-relaxed">{pt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Trajectory canvas chart ──
function TrajectoryChart({ logs, driveType }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || logs.length < 2) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 400;
    canvas.width = W;
    canvas.height = 180;
    ctx.clearRect(0, 0, W, 180);

    const probs = logs.map(l => l.failure_prob);
    const maxP = 100;
    const pad = { t: 16, r: 16, b: 28, l: 36 };
    const chartW = W - pad.l - pad.r;
    const chartH = 180 - pad.t - pad.b;

    // Grid lines
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 1;
    [0, 25, 50, 75, 100].forEach(p => {
      const y = pad.t + chartH - (p / maxP) * chartH;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillStyle = '#333';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${p}%`, pad.l - 4, y + 3);
    });

    // Threshold line at 70%
    const ty = pad.t + chartH - (70 / maxP) * chartH;
    ctx.strokeStyle = '#E63946';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(pad.l, ty); ctx.lineTo(W - pad.r, ty); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#E63946';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('70% alert', pad.l + 4, ty - 3);

    // Line
    const color = driveType === 'failure' ? '#E63946' : '#4CAF50';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    probs.forEach((p, i) => {
      const x = pad.l + (i / (probs.length - 1)) * chartW;
      const y = pad.t + chartH - (p / maxP) * chartH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under
    ctx.fillStyle = color + '18';
    ctx.lineTo(pad.l + chartW, pad.t + chartH);
    ctx.lineTo(pad.l, pad.t + chartH);
    ctx.closePath();
    ctx.fill();

    // Dots
    probs.forEach((p, i) => {
      const x = pad.l + (i / (probs.length - 1)) * chartW;
      const y = pad.t + chartH - (p / maxP) * chartH;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    });

  }, [logs, driveType]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) canvas.width = canvas.offsetWidth;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} height={180} />;
}