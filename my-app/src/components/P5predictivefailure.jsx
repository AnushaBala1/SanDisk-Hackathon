import { useState, useEffect, useRef, useCallback } from 'react';
import SimLoader from './Simloader.jsx';

// ── Static replay data ──
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

// ── Risk from prob ──
function riskFromProb(prob) {
  if (prob >= 70) return 'HIGH';
  if (prob >= 40) return 'MEDIUM';
  return 'LOW';
}

// ── Build a drive object ──
function makeDrive(id, driveType) {
  const replayData = driveType === 'failure' ? FAILURE_REPLAY : HEALTHY_REPLAY;
  return {
    id,
    driveType,
    replayData,
    latestSnapshot: replayData[0],
    history: [replayData[0].failure_prob],
    logs: [],
    status: 'ready',
    replayIdx: 0,
  };
}

// ── Circular gauge (original — untouched) ──
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

// ── Alert badge (original — untouched) ──
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

// ── Log line (original — untouched) ──
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

// ── Trajectory canvas chart (original — untouched) ──
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

    ctx.fillStyle = color + '18';
    ctx.lineTo(pad.l + chartW, pad.t + chartH);
    ctx.lineTo(pad.l, pad.t + chartH);
    ctx.closePath();
    ctx.fill();

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

// ── Sparkline canvas (for drive cards) ──
function Sparkline({ history, driveType }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 160;
    canvas.width = W;
    canvas.height = 28;
    ctx.clearRect(0, 0, W, 28);

    const color = driveType === 'failure' ? '#E63946' : '#4CAF50';
    const probs = history.map(p => p / 100);

    ctx.strokeStyle = color + 'cc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    probs.forEach((p, i) => {
      const x = (i / (probs.length - 1)) * W;
      const y = 28 - p * 26;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = color + '18';
    ctx.lineTo(W, 28);
    ctx.lineTo(0, 28);
    ctx.closePath();
    ctx.fill();
  }, [history, driveType]);

  return <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} height={28} />;
}

// ── Drive card ──
function DriveCard({ drive, isSelected, onClick }) {
  const { id, driveType, latestSnapshot, history, status } = drive;
  const prob = latestSnapshot ? Math.floor(latestSnapshot.failure_prob) : 0;
  const risk = latestSnapshot ? riskFromProb(prob) : 'PENDING';

  const topColor =
    risk === 'HIGH'   ? '#E63946' :
    risk === 'MEDIUM' ? '#FFA500' :
    risk === 'LOW'    ? '#4CAF50' : '#5B403F';

  const fillColor =
    risk === 'HIGH'   ? '#E63946' :
    risk === 'MEDIUM' ? '#FFA500' : '#4CAF50';

  const badgeStyle =
    risk === 'LOW'    ? 'bg-[#4CAF50]/10 border-[#4CAF50]/40 text-[#4CAF50]' :
    risk === 'MEDIUM' ? 'bg-[#FFA500]/10 border-[#FFA500]/40 text-[#FFA500]' :
    risk === 'HIGH'   ? 'bg-[#E63946]/10 border-[#E63946]/40 text-[#E63946] animate-pulse' :
                        'bg-[#E63946]/10 border-[#E63946]/20 text-[#e4bebc]';

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden border cursor-pointer transition-all duration-200
        ${isSelected
          ? 'border-[#E63946] bg-[#1A0000]'
          : 'border-[#2A2A2A] bg-[#0D0D0D] hover:border-[#E63946]/40 hover:-translate-y-px'
        }`}
    >
      {/* top colour strip */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: topColor }} />

      <div className="p-3 pt-3.5">
        {/* header */}
        <div className="flex justify-between items-start mb-2">
          <span className="font-mono text-[11px] text-[#e4bebc] tracking-wide">{id}</span>
          <span className={`font-mono text-[8px] px-1.5 py-0.5 border tracking-widest font-bold ${badgeStyle}`}>
            {risk}
          </span>
        </div>

        {/* prob bar */}
        <div className="mb-2">
          <div className="flex justify-between font-mono text-[8px] text-[#555] mb-1">
            <span>FAILURE PROB</span>
            <span className="text-[#e4bebc]">{prob.toFixed(1)}%</span>
          </div>
          <div className="h-[3px] bg-[#1A1A1A]">
            <div
              className="h-full transition-all duration-700"
              style={{ width: `${prob}%`, background: fillColor }}
            />
          </div>
        </div>

        {/* sparkline */}
        <div style={{ height: 28 }}>
          {history.length >= 2
            ? <Sparkline history={history} driveType={driveType} />
            : <div className="w-full h-full flex items-center"><div className="w-full h-px bg-[#1A1A1A]" /></div>
          }
        </div>

        {/* status line */}
        <div className={`font-mono text-[8px] mt-1.5 tracking-wide
          ${status === 'replaying' ? 'text-[#E63946]' :
            driveType === 'failure' ? 'text-[#E63946]/60' : 'text-[#4CAF50]/60'}`}>
          {status === 'replaying'
            ? `● REPLAYING · DAY ${latestSnapshot?.day ?? '—'}`
            : latestSnapshot
              ? `DAYS REM: ${latestSnapshot.estimated_days_remaining}`
              : 'PROCESSING…'}
        </div>
      </div>
    </div>
  );
}

// ── Detail panel (right column) ──
function DetailPanel({ drive, isReplaying, logBoxRef }) {
  if (!drive) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center gap-3 py-20">
        <div className="text-4xl" style={{ opacity: 0.15 }}>📡</div>
        <p className="font-mono text-[#333] text-[10px] tracking-[0.2em] leading-relaxed uppercase">
          Upload drive CSVs<br />then click a card<br />to view details
        </p>
      </div>
    );
  }

  const snap = drive.latestSnapshot || drive.replayData[0];
  const prob = Math.floor(snap?.failure_prob ?? 0);
  const alertLabel = snap?.alert_label || 'OK';

  return (
    <div className="space-y-5" style={{ animation: 'slideIn 0.25s ease' }}>

      {/* Drive age / live indicator */}
      <div className="border border-[#2A2A2A] bg-[#111111] p-3 flex items-center justify-between">
        <span className="font-mono text-[#e4bebc] text-[10px] tracking-wider uppercase">Drive Age</span>
        <span className="font-mono text-white text-sm font-bold">Day {snap?.day ?? '—'}</span>
        {isReplaying && (
          <span className="font-mono text-xs tracking-widest border px-3 py-1 bg-[#4CAF50]/10 text-[#4CAF50] border-[#4CAF50]/30">
            ● LIVE
          </span>
        )}
      </div>

      {/* Gauge card (original inner styling) */}
      <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
        <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-[#E63946]" />
            <span className="font-mono text-[#e4bebc] text-[10px] tracking-[0.25em] uppercase">
              FAILURE PROBABILITY
            </span>
          </div>
          <AlertBadge label={alertLabel} />
        </div>
        <div className="p-6 flex flex-col items-center gap-4">
          <FailureGauge prob={prob} alertLabel={alertLabel} />

          {/* Days remaining */}
          <div className="w-full border border-[#2A2A2A] bg-[#111111] border-t-2 border-t-[#E63946] p-4 text-center">
            <div className="font-mono text-[#e4bebc] text-[10px] tracking-wider uppercase mb-1">
              Estimated Days Remaining
            </div>
            <div className="font-mono text-3xl font-bold text-white">
              {snap?.estimated_days_remaining ?? '—'}
            </div>
          </div>
        </div>
      </div>

      {/* SMART stats (original inner styling) */}
      <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
        <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-[#E63946]" />
          <span className="font-mono text-[#e4bebc] text-[10px] tracking-[0.25em] uppercase">
            SMART FEATURE SNAPSHOT
          </span>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {[
            { label: 'Wear Level',      value: `${snap?.wear_level_pct ?? '—'}%`,  color: 'text-[#FFA500]' },
            { label: 'Bad Block Count', value: snap?.bad_block_count ?? '—',        color: 'text-[#E63946]' },
            { label: 'LDPC Fail Rate',  value: snap?.ldpc_fail_rate ?? '—',         color: 'text-[#6495ED]' },
            { label: 'Temperature',     value: `${snap?.temperature_c ?? '—'}°C`,  color: 'text-white'     },
          ].map(s => (
            <div key={s.label} className="bg-[#111111] border border-[#2A2A2A] border-t-2 border-t-[#E63946] p-4">
              <div className="font-mono text-[#e4bebc] text-[10px] tracking-wider uppercase mb-2">{s.label}</div>
              <div className={`font-mono text-2xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Feature importance (original) */}
        <div className="px-4 pb-4">
          <div className="font-mono text-[#e4bebc] text-[10px] tracking-[0.2em] uppercase mb-3">
            ── FEATURE IMPORTANCE (SHAP)
          </div>
          {[
            { label: 'bad_block_count', pct: 38, color: '#E63946' },
            { label: 'ldpc_fail_rate',  pct: 28, color: '#6495ED' },
            { label: 'wear_level_pct',  pct: 20, color: '#FFA500' },
            { label: 'temperature_c',   pct: 14, color: '#4CAF50' },
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

      {/* Trajectory chart (original inner styling) */}
      <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
        <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-[#E63946]" />
          <span className="font-mono text-[#e4bebc] text-[10px] tracking-[0.25em] uppercase">
            FAILURE PROBABILITY TRAJECTORY
          </span>
        </div>
        <div className="p-4">
          {drive.logs.length < 2 ? (
            <div className="h-[180px] flex items-center justify-center">
              <span className="font-mono text-[#2A2A2A] text-xs">Start replay to see trajectory</span>
            </div>
          ) : (
            <TrajectoryChart logs={drive.logs} driveType={drive.driveType} />
          )}
        </div>
      </div>

      {/* Activity log (original inner styling) */}
      <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
        <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 bg-[#E63946]"
            style={{ animation: isReplaying ? 'pulse 1s infinite' : 'none' }}
          />
          <span className="font-mono text-[#e4bebc] text-[10px] tracking-[0.25em] uppercase">
            PREDICTION LOG
          </span>
          <span className="font-mono text-[#333] text-[10px] ml-auto">XGBoost output</span>
        </div>
        <div
          ref={logBoxRef}
          className="px-5 py-4 min-h-[160px] max-h-[220px] overflow-y-auto"
        >
          {drive.logs.length === 0 ? (
            <span className="font-mono text-[#2A2A2A] text-xs">Waiting for replay...</span>
          ) : (
            [...drive.logs].reverse().map((l, i) => (
              <LogLine key={i} day={l.day} prob={l.failure_prob} alert_label={l.alert_label} />
            ))
          )}
        </div>
      </div>

    </div>
  );
}

// ── MAIN COMPONENT ──
export default function P5PredictiveFailure() {
  const [drives, setDrives] = useState(() => ({
    'ST4000DM004-A':   makeDrive('ST4000DM004-A',   'healthy'),
    'WDC-WD40EZRZ-B':  makeDrive('WDC-WD40EZRZ-B',  'healthy'),
    'TOSHIBA-HDWD130': makeDrive('TOSHIBA-HDWD130',  'failure'),
  }));

  const [selectedId,  setSelectedId]  = useState('ST4000DM004-A');
  const [isReplaying, setIsReplaying] = useState(false);
  const [loading,     setLoading]     = useState(false);

  const intervalsRef = useRef({});
  const logBoxRef    = useRef(null);

  // Scroll log to bottom when selected drive's logs update
  const selectedLogs = drives[selectedId]?.logs;
  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [selectedLogs?.length]);

  // Cleanup on unmount
  useEffect(() => () => Object.values(intervalsRef.current).forEach(clearInterval), []);

  // ── Summary counts ──
  const driveList    = Object.values(drives);
  const totalDrives  = driveList.length;
  const healthyCount = driveList.filter(d => riskFromProb(Math.floor(d.latestSnapshot?.failure_prob ?? 0)) === 'LOW').length;
  const atRiskCount  = driveList.filter(d => riskFromProb(Math.floor(d.latestSnapshot?.failure_prob ?? 0)) === 'MEDIUM').length;
  const criticalCount= driveList.filter(d => riskFromProb(Math.floor(d.latestSnapshot?.failure_prob ?? 0)) === 'HIGH').length;

  // ── REPLAY ALL ──
  const handleReplayAll = useCallback(async () => {
    if (isReplaying) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setLoading(false);
    setIsReplaying(true);

    setDrives(prev => {
      const next = {};
      Object.values(prev).forEach(d => {
        next[d.id] = { ...d, latestSnapshot: d.replayData[0], history: [d.replayData[0].failure_prob], logs: [], status: 'replaying', replayIdx: 0 };
      });
      return next;
    });

    // Capture snapshot of current drive ids to start tickers
    const driveIds = Object.keys(drives);
    driveIds.forEach(dId => {
      let idx = 0;
      const replayData = drives[dId].replayData;
      intervalsRef.current[dId] = setInterval(() => {
        idx++;
        setDrives(prev => {
          if (!prev[dId]) return prev;
          const drive = prev[dId];
          if (idx >= replayData.length) {
            clearInterval(intervalsRef.current[dId]);
            return { ...prev, [dId]: { ...drive, status: 'done' } };
          }
          const frame = replayData[idx];
          return {
            ...prev,
            [dId]: {
              ...drive,
              latestSnapshot: frame,
              history: [...drive.history.slice(-59), frame.failure_prob],
              logs: [...drive.logs, frame],
              replayIdx: idx,
              status: 'replaying',
            },
          };
        });
      }, 800);
    });
  }, [drives, isReplaying]);

  const handleStop = useCallback(() => {
    Object.values(intervalsRef.current).forEach(clearInterval);
    intervalsRef.current = {};
    setIsReplaying(false);
    setDrives(prev => {
      const next = {};
      Object.values(prev).forEach(d => { next[d.id] = { ...d, status: 'ready' }; });
      return next;
    });
  }, []);

  const handleClear = useCallback(() => {
    handleStop();
    setDrives({});
    setSelectedId(null);
  }, [handleStop]);

  const handleAddFiles = useCallback(() => {
    const models  = ['ST8000DM', 'WDC-WD80', 'HGST-HUH', 'SEA-IronW', 'TOK-MG07'];
    const suffixes= ['AAA', 'BBZ', 'CXK', 'DQM', 'ELP'];
    const types   = ['healthy', 'healthy', 'failure'];
    const id      = `${models[Math.floor(Math.random() * models.length)]}-${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
    const dtype   = types[Math.floor(Math.random() * types.length)];
    if (drives[id]) return;
    setDrives(prev => ({ ...prev, [id]: makeDrive(id, dtype) }));
  }, [drives]);

  const healthyDrives    = driveList.filter(d => d.driveType === 'healthy');
  const failureDrives    = driveList.filter(d => d.driveType === 'failure');
  const processingDrives = driveList.filter(d => !d.driveType);
  const selectedDrive    = selectedId ? drives[selectedId] : null;

  const replayProgress = driveList.length
    ? Math.max(...driveList.map(d => (d.replayIdx / Math.max(d.replayData.length - 1, 1)) * 100))
    : 0;

  return (
    <div className="bg-[#080808] min-h-screen">
      {loading && <SimLoader message="Loading prediction model..." />}

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>

      {/* ── Header (original styling) ── */}
      <div className="px-8 pt-6 pb-4 border-b border-[#E63946]/20">
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
              onClick={handleStop}
              className="border border-[#5B403F] text-[#e4bebc] hover:border-[#E63946] hover:text-[#E63946] px-5 py-2.5 font-['Space_Grotesk'] font-bold text-sm transition-all active:scale-95 flex items-center gap-2"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>restart_alt</span>
              Reset
            </button>
            <button
              onClick={handleStop}
              disabled={!isReplaying}
              className="border border-[#E63946]/50 text-[#e4bebc] hover:border-[#E63946] hover:text-[#E63946] px-5 py-2.5 font-['Space_Grotesk'] font-bold text-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>stop</span>
              Stop
            </button>
            <button
              onClick={handleReplayAll}
              disabled={isReplaying || totalDrives === 0}
              className="bg-[#E63946] hover:bg-[#FF4D4D] text-white px-5 py-2.5 font-['Space_Grotesk'] font-bold text-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>play_arrow</span>
              Replay All
            </button>

            {/* Live/Stopped badge */}
            <div className={`font-mono px-4 py-2 text-xs tracking-widest border ${
              isReplaying
                ? 'bg-[#4CAF50]/10 text-[#4CAF50] border-[#4CAF50]/30'
                : 'bg-[#E63946]/10 text-[#E63946] border-[#E63946]/20'
            }`}>
              {isReplaying ? '● LIVE' : 'STOPPED'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary bar — original card style ── */}
      <div className="grid grid-cols-4 border-b border-[#2A2A2A]" style={{ gap: '1px', background: '#2A2A2A' }}>
        {[
          { label: 'TOTAL DRIVES', value: totalDrives,   color: 'text-[#e4bebc]' },
          { label: 'HEALTHY',      value: healthyCount,  color: 'text-[#4CAF50]' },
          { label: 'AT RISK',      value: atRiskCount,   color: 'text-[#FFA500]' },
          { label: 'CRITICAL',     value: criticalCount, color: 'text-[#E63946]' },
        ].map(s => (
          <div key={s.label} className="bg-[#0D0D0D] px-6 py-4">
            <div className="font-mono text-[9px] tracking-[0.25em] text-[#555] uppercase mb-1">{s.label}</div>
            <div className={`font-mono text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Two-panel main layout ── */}
      <div className="flex" style={{ minHeight: 'calc(100vh - 160px)' }}>

        {/* ── LEFT: Fleet panel ── */}
        <div className="border-r border-[#2A2A2A] overflow-y-auto" style={{ width: '55%', padding: '24px 32px' }}>

          {/* Panel title */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1.5 h-1.5 bg-[#E63946]" />
            <span className="font-mono text-[#e4bebc] text-[10px] tracking-[0.3em] uppercase">Drive Fleet</span>
            <div className="flex-1 h-px bg-[#2A2A2A]" />
          </div>

          {/* ── Upload zone ── */}
          <div className="border border-dashed border-[#5B403F] bg-[#0D0D0D] p-4 mb-5 transition-all hover:border-[#E63946]/40">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <span className="font-mono text-[10px] text-[#e4bebc] tracking-wide">
                Upload one CSV per drive &nbsp;·&nbsp;
                <span className="text-[#E63946]">{totalDrives}</span> / 10 loaded
              </span>
              <div className="flex gap-2 flex-wrap items-center">
                <button
                  onClick={handleAddFiles}
                  className="border border-[#5B403F] text-[#e4bebc] hover:border-[#E63946] hover:text-[#E63946] px-3 py-1.5 font-['Space_Grotesk'] font-bold text-xs transition-all active:scale-95"
                >
                  ＋ ADD FILES
                </button>
                <button
                  onClick={isReplaying ? handleStop : handleReplayAll}
                  disabled={totalDrives === 0}
                  className={`px-3 py-1.5 font-['Space_Grotesk'] font-bold text-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
                    ${isReplaying
                      ? 'border border-[#4CAF50]/50 text-[#4CAF50] hover:border-[#4CAF50]'
                      : 'bg-[#E63946] hover:bg-[#FF4D4D] text-white border border-transparent'
                    }`}
                >
                  {isReplaying ? '■ STOP' : '▶ REPLAY ALL'}
                </button>
                <button
                  onClick={handleClear}
                  className="border border-[#E63946]/30 text-[#e4bebc] hover:border-[#E63946] hover:text-[#E63946] px-3 py-1.5 font-['Space_Grotesk'] font-bold text-xs transition-all active:scale-95"
                >
                  ✕ CLEAR
                </button>
              </div>
            </div>

            {/* File chips */}
            {driveList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {driveList.map(d => {
                  const risk = riskFromProb(Math.floor(d.latestSnapshot?.failure_prob ?? 0));
                  const chipCls =
                    risk === 'LOW'   ? 'border-[#4CAF50]/40 text-[#4CAF50]' :
                    risk === 'HIGH'  ? 'border-[#E63946]/40 text-[#E63946]' :
                                      'border-[#FFA500]/40 text-[#FFA500]';
                  return (
                    <div key={d.id} className={`flex items-center gap-1.5 font-mono text-[9px] tracking-wide px-2 py-0.5 border bg-black/30 ${chipCls}`}>
                      <div className="w-[4px] h-[4px] rounded-full bg-current" />
                      {d.id}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Replay progress bar */}
            {isReplaying && (
              <div className="h-[2px] bg-[#1A1A1A] mt-3 overflow-hidden">
                <div
                  className="h-full bg-[#E63946] transition-all duration-700"
                  style={{ width: `${replayProgress}%` }}
                />
              </div>
            )}
          </div>

          {/* No drives placeholder */}
          {driveList.length === 0 && (
            <div className="text-center py-12 font-mono text-[10px] tracking-[0.25em] text-[#333] uppercase">
              Upload CSV files above to begin
            </div>
          )}

          {/* Healthy drives */}
          {healthyDrives.length > 0 && (
            <div className="mb-7">
              <h3 className="font-mono text-[9px] tracking-[0.3em] px-3 py-1.5 mb-3 inline-block text-[#4CAF50] bg-[#4CAF50]/08 border-l-2 border-[#4CAF50]">
                ● HEALTHY DRIVES ({healthyDrives.length})
              </h3>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))' }}>
                {healthyDrives.map(d => (
                  <DriveCard key={d.id} drive={d} isSelected={selectedId === d.id} onClick={() => setSelectedId(d.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Failure drives */}
          {failureDrives.length > 0 && (
            <div className="mb-7">
              <h3 className="font-mono text-[9px] tracking-[0.3em] px-3 py-1.5 mb-3 inline-block text-[#E63946] bg-[#E63946]/08 border-l-2 border-[#E63946]">
                ● FAILURE DRIVES ({failureDrives.length})
              </h3>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))' }}>
                {failureDrives.map(d => (
                  <DriveCard key={d.id} drive={d} isSelected={selectedId === d.id} onClick={() => setSelectedId(d.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Processing drives */}
          {processingDrives.length > 0 && (
            <div className="mb-7">
              <h3 className="font-mono text-[9px] tracking-[0.3em] px-3 py-1.5 mb-3 inline-block text-[#e4bebc] bg-[#E63946]/05 border-l-2 border-[#5B403F]">
                ● PROCESSING ({processingDrives.length})
              </h3>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))' }}>
                {processingDrives.map(d => (
                  <DriveCard key={d.id} drive={d} isSelected={selectedId === d.id} onClick={() => setSelectedId(d.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Two-stage pipeline (original) */}
          {driveList.length > 0 && (
            <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
              <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#E63946]" />
                <span className="font-mono text-[#e4bebc] text-[10px] tracking-[0.25em] uppercase">
                  TWO-STAGE PIPELINE
                </span>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
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
          )}
        </div>

        {/* ── RIGHT: Detail panel ── */}
        <div className="bg-[#080808] overflow-y-auto" style={{ width: '45%', padding: '24px 32px' }}>
          <DetailPanel drive={selectedDrive} isReplaying={isReplaying} logBoxRef={logBoxRef} />
        </div>

      </div>
    </div>
  );
}