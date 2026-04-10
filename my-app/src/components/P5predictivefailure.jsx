import { useState, useEffect, useRef, useCallback } from 'react';
import SimLoader from './Simloader.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';;

// ─────────────────────────────────────────────────────────────
// DATA HELPERS
// ─────────────────────────────────────────────────────────────

function probToAlertLabel(prob) {
  if (prob >= 90) return 'LAST_GASP';
  if (prob >= 70) return 'CRITICAL';
  if (prob >= 40) return 'WARN';
  return 'OK';
}

function estimateDaysRemaining(prob) {
  return Math.max(0, Math.round(1095 * (1 - prob / 100)));
}

function riskFromProb(prob) {
  if (prob >= 70) return 'HIGH';
  if (prob >= 40) return 'MEDIUM';
  return 'LOW';
}

// FastAPI /score returns: { prob (0–1 float), risk, total_days, temp, hours, realloc, wear }
// UI snapshot shape:      { failure_prob (0–100 int), alert_label, wear_level_pct,
//                           bad_block_count, ldpc_fail_rate, temperature_c,
//                           estimated_days_remaining, day }
function mapScoreToSnapshot(score) {
  const prob = Math.round((score.prob ?? 0) * 100);
  return {
    day:                      score.total_days ?? 1,
    failure_prob:             prob,
    alert_label:              probToAlertLabel(prob),
    wear_level_pct:           Math.round(score.wear    ?? 0),
    bad_block_count:          Math.round(score.realloc ?? 0),
    ldpc_fail_rate:           0,
    temperature_c:            Math.round(score.temp    ?? 0),
    estimated_days_remaining: estimateDaysRemaining(prob),
  };
}

// FastAPI /stream SSE frame: { day, prob (0–1), risk, temp, hours, realloc, wear, index, total, done }
function mapFrameToSnapshot(frame) {
  const prob = Math.round((frame.prob ?? 0) * 100);
  return {
    day:                      frame.day ?? frame.index ?? 0,
    failure_prob:             prob,
    alert_label:              probToAlertLabel(prob),
    wear_level_pct:           Math.round(frame.wear    ?? 0),
    bad_block_count:          Math.round(frame.realloc ?? 0),
    ldpc_fail_rate:           0,
    temperature_c:            Math.round(frame.temp    ?? 0),
    estimated_days_remaining: estimateDaysRemaining(prob),
  };
}

// ─────────────────────────────────────────────────────────────
// DRIVE FACTORY
// status: 'loading' | 'ready' | 'streaming' | 'done' | 'error'
// ─────────────────────────────────────────────────────────────
function makeDrive(id, file) {
  return {
    id,
    file,               // File object kept so we can re-send it for streaming later
    latestSnapshot: null,
    history:        [],
    logs:           [],
    status:         'loading',
    error:          null,
    streamTotal:    0,
    streamIndex:    0,
  };
}

// ─────────────────────────────────────────────────────────────
// API CALLS
// ─────────────────────────────────────────────────────────────

async function scoreFile(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API}/model/score`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

async function openStream(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API}/model/stream`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res;
}

// ─────────────────────────────────────────────────────────────
// SSE READER  — returns { abort() }
// ─────────────────────────────────────────────────────────────
function readSSEStream(response, onFrame, onDone, onError) {
  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = '';
  let   stopped = false;

  const ctrl = {
    abort() { stopped = true; reader.cancel(); },
  };

  (async () => {
    try {
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are delimited by double newline
        const parts = buffer.split('\n\n');
        buffer = parts.pop(); // keep any incomplete trailing chunk

        for (const part of parts) {
          if (!part.trim()) continue;
          const line = part.startsWith('data:') ? part.slice(5).trim() : part.trim();
          try {
            const frame = JSON.parse(line);
            if (frame.done) { onDone(); return; }
            onFrame(frame);
          } catch { /* malformed chunk — skip */ }
        }
      }
      onDone();
    } catch (err) {
      if (!stopped) onError(err);
    }
  })();

  return ctrl;
}

// ─────────────────────────────────────────────────────────────
// VISUAL COMPONENTS
// ─────────────────────────────────────────────────────────────

function FailureGauge({ prob, alertLabel }) {
  const colors = { OK: '#4CAF50', WARN: '#FFA500', CRITICAL: '#E63946', LAST_GASP: '#7c3aed' };
  const color  = colors[alertLabel] || '#4CAF50';
  const r = 70, circ = 2 * Math.PI * r, dash = (prob / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 180, height: 180 }}>
        <svg width="180" height="180" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="90" cy="90" r={r} fill="none" stroke="#1A1A1A" strokeWidth="12" />
          <circle cx="90" cy="90" r={r} fill="none" stroke={color} strokeWidth="12"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="butt"
            style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono font-bold"
            style={{ fontSize: '38px', color, lineHeight: 1, transition: 'color 0.4s ease' }}>
            {prob}%
          </span>
          <span className="font-mono text-[#555] text-[10px] tracking-widest mt-1">FAILURE PROB</span>
        </div>
      </div>
    </div>
  );
}

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

function LogLine({ day, prob, alert_label }) {
  const colors = { OK: '#4CAF50', WARN: '#FFA500', CRITICAL: '#E63946', LAST_GASP: '#7c3aed' };
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

function TrajectoryChart({ logs, driveType }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || logs.length < 2) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 400;
    canvas.width = W; canvas.height = 180;
    ctx.clearRect(0, 0, W, 180);
    const probs = logs.map(l => l.failure_prob);
    const pad = { t: 16, r: 16, b: 28, l: 36 };
    const chartW = W - pad.l - pad.r, chartH = 180 - pad.t - pad.b;
    ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 1;
    [0, 25, 50, 75, 100].forEach(p => {
      const y = pad.t + chartH - (p / 100) * chartH;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillStyle = '#333'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
      ctx.fillText(`${p}%`, pad.l - 4, y + 3);
    });
    const ty = pad.t + chartH - 0.7 * chartH;
    ctx.strokeStyle = '#E63946'; ctx.lineWidth = 0.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(pad.l, ty); ctx.lineTo(W - pad.r, ty); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = '#E63946'; ctx.font = '9px monospace';
    ctx.textAlign = 'left'; ctx.fillText('70% alert', pad.l + 4, ty - 3);
    const color = driveType === 'failure' ? '#E63946' : '#4CAF50';
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    probs.forEach((p, i) => {
      const x = pad.l + (i / (probs.length - 1)) * chartW;
      const y = pad.t + chartH - (p / 100) * chartH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = color + '18';
    ctx.lineTo(pad.l + chartW, pad.t + chartH); ctx.lineTo(pad.l, pad.t + chartH);
    ctx.closePath(); ctx.fill();
    probs.forEach((p, i) => {
      const x = pad.l + (i / (probs.length - 1)) * chartW;
      const y = pad.t + chartH - (p / 100) * chartH;
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    });
  }, [logs, driveType]);
  useEffect(() => {
    const h = () => { const c = canvasRef.current; if (c) c.width = c.offsetWidth; };
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} height={180} />;
}

function Sparkline({ history, driveType }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 160;
    canvas.width = W; canvas.height = 28;
    ctx.clearRect(0, 0, W, 28);
    const color = driveType === 'failure' ? '#E63946' : '#4CAF50';
    const probs = history.map(p => p / 100);
    ctx.strokeStyle = color + 'cc'; ctx.lineWidth = 1.5; ctx.beginPath();
    probs.forEach((p, i) => {
      const x = (i / (probs.length - 1)) * W, y = 28 - p * 26;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = color + '18';
    ctx.lineTo(W, 28); ctx.lineTo(0, 28); ctx.closePath(); ctx.fill();
  }, [history, driveType]);
  return <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} height={28} />;
}

// ─────────────────────────────────────────────────────────────
// DRIVE CARD
// ─────────────────────────────────────────────────────────────
function DriveCard({ drive, isSelected, onClick }) {
  const { id, latestSnapshot, history, status, error } = drive;
  const prob      = latestSnapshot ? Math.floor(latestSnapshot.failure_prob) : 0;
  const risk      = latestSnapshot ? riskFromProb(prob) : 'PENDING';
  const driveType = risk === 'HIGH' ? 'failure' : 'healthy';

  const topColor  = risk === 'HIGH' ? '#E63946' : risk === 'MEDIUM' ? '#FFA500' : risk === 'LOW' ? '#4CAF50' : '#5B403F';
  const fillColor = risk === 'HIGH' ? '#E63946' : risk === 'MEDIUM' ? '#FFA500' : '#4CAF50';
  const badgeStyle =
    risk === 'LOW'    ? 'bg-[#4CAF50]/10 border-[#4CAF50]/40 text-[#4CAF50]' :
    risk === 'MEDIUM' ? 'bg-[#FFA500]/10 border-[#FFA500]/40 text-[#FFA500]' :
    risk === 'HIGH'   ? 'bg-[#E63946]/10 border-[#E63946]/40 text-[#E63946] animate-pulse' :
                        'bg-[#E63946]/10 border-[#E63946]/20 text-[#e4bebc]';

  return (
    <div onClick={onClick}
      className={`relative overflow-hidden border cursor-pointer transition-all duration-200
        ${isSelected
          ? 'border-[#E63946] bg-[#1A0000]'
          : 'border-[#2A2A2A] bg-[#0D0D0D] hover:border-[#E63946]/40 hover:-translate-y-px'
        }`}>
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: topColor }} />
      <div className="p-3 pt-3.5">
        <div className="flex justify-between items-start mb-2">
          <span className="font-mono text-[11px] text-[#e4bebc] tracking-wide truncate max-w-[100px]">{id}</span>
          <span className={`font-mono text-[8px] px-1.5 py-0.5 border tracking-widest font-bold ${badgeStyle}`}>
            {risk}
          </span>
        </div>

        {status === 'loading' && (
          <div className="font-mono text-[9px] text-[#555] tracking-widest py-4 text-center animate-pulse">SCORING…</div>
        )}
        {status === 'error' && (
          <div className="font-mono text-[9px] text-[#E63946] tracking-wide py-2 truncate" title={error}>
            ✕ {error}
          </div>
        )}

        {latestSnapshot && (
          <>
            <div className="mb-2">
              <div className="flex justify-between font-mono text-[8px] text-[#555] mb-1">
                <span>FAILURE PROB</span>
                <span className="text-[#e4bebc]">{prob}%</span>
              </div>
              <div className="h-[3px] bg-[#1A1A1A]">
                <div className="h-full transition-all duration-700"
                  style={{ width: `${prob}%`, background: fillColor }} />
              </div>
            </div>
            <div style={{ height: 28 }}>
              {history.length >= 2
                ? <Sparkline history={history} driveType={driveType} />
                : <div className="w-full h-full flex items-center"><div className="w-full h-px bg-[#1A1A1A]" /></div>
              }
            </div>
            <div className={`font-mono text-[8px] mt-1.5 tracking-wide
              ${status === 'streaming' ? 'text-[#E63946]'
                : driveType === 'failure' ? 'text-[#E63946]/60' : 'text-[#4CAF50]/60'}`}>
              {status === 'streaming'
                ? `● STREAMING · DAY ${latestSnapshot.day ?? '—'}`
                : `DAYS REM: ${latestSnapshot.estimated_days_remaining}`}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DETAIL PANEL
// ─────────────────────────────────────────────────────────────
function DetailPanel({ drive, isStreaming, logBoxRef }) {
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

  const snap = drive.latestSnapshot;
  if (!snap) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center gap-3 py-20">
        <div className="font-mono text-[#555] text-xs animate-pulse">Scoring drive…</div>
      </div>
    );
  }

  const prob       = Math.floor(snap.failure_prob ?? 0);
  const alertLabel = snap.alert_label || 'OK';
  const driveType  = riskFromProb(prob) === 'HIGH' ? 'failure' : 'healthy';

  return (
    <div className="space-y-5" style={{ animation: 'slideIn 0.25s ease' }}>
      <div className="border border-[#2A2A2A] bg-[#111111] p-3 flex items-center justify-between">
        <span className="font-mono text-[#e4bebc] text-[10px] tracking-wider uppercase">Drive Age</span>
        <span className="font-mono text-white text-sm font-bold">Day {snap.day ?? '—'}</span>
        {isStreaming && (
          <span className="font-mono text-xs tracking-widest border px-3 py-1 bg-[#4CAF50]/10 text-[#4CAF50] border-[#4CAF50]/30">
            ● LIVE
          </span>
        )}
      </div>

      <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
        <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-[#E63946]" />
            <span className="font-mono text-[#e4bebc] text-[10px] tracking-[0.25em] uppercase">FAILURE PROBABILITY</span>
          </div>
          <AlertBadge label={alertLabel} />
        </div>
        <div className="p-6 flex flex-col items-center gap-4">
          <FailureGauge prob={prob} alertLabel={alertLabel} />
          <div className="w-full border border-[#2A2A2A] bg-[#111111] border-t-2 border-t-[#E63946] p-4 text-center">
            <div className="font-mono text-[#e4bebc] text-[10px] tracking-wider uppercase mb-1">Estimated Days Remaining</div>
            <div className="font-mono text-3xl font-bold text-white">{snap.estimated_days_remaining ?? '—'}</div>
          </div>
        </div>
      </div>

      <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
        <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-[#E63946]" />
          <span className="font-mono text-[#e4bebc] text-[10px] tracking-[0.25em] uppercase">SMART FEATURE SNAPSHOT</span>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {[
            { label: 'Wear Level',      value: `${snap.wear_level_pct ?? '—'}%`, color: 'text-[#FFA500]' },
            { label: 'Bad Block Count', value: snap.bad_block_count ?? '—',       color: 'text-[#E63946]' },
            { label: 'LDPC Fail Rate',  value: snap.ldpc_fail_rate  ?? '—',       color: 'text-[#6495ED]' },
            { label: 'Temperature',     value: `${snap.temperature_c ?? '—'}°C`, color: 'text-white'     },
          ].map(s => (
            <div key={s.label} className="bg-[#111111] border border-[#2A2A2A] border-t-2 border-t-[#E63946] p-4">
              <div className="font-mono text-[#e4bebc] text-[10px] tracking-wider uppercase mb-2">{s.label}</div>
              <div className={`font-mono text-2xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
        <div className="px-4 pb-4">
          <div className="font-mono text-[#e4bebc] text-[10px] tracking-[0.2em] uppercase mb-3">── FEATURE IMPORTANCE (SHAP)</div>
          {[
            { label: 'bad_block_count', pct: 38, color: '#E63946' },
            { label: 'ldpc_fail_rate',  pct: 28, color: '#6495ED' },
            { label: 'wear_level_pct',  pct: 20, color: '#FFA500' },
            { label: 'temperature_c',   pct: 14, color: '#4CAF50' },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-3 mb-2">
              <span className="font-mono text-[#555] text-[10px] w-36 shrink-0">{f.label}</span>
              <div className="flex-1 h-1.5 bg-[#1A1A1A]">
                <div className="h-full transition-all duration-700" style={{ width: `${f.pct}%`, backgroundColor: f.color }} />
              </div>
              <span className="font-mono text-[#e4bebc] text-[10px] w-8 text-right">{f.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
        <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-[#E63946]" />
          <span className="font-mono text-[#e4bebc] text-[10px] tracking-[0.25em] uppercase">FAILURE PROBABILITY TRAJECTORY</span>
        </div>
        <div className="p-4">
          {drive.logs.length < 2 ? (
            <div className="h-[180px] flex items-center justify-center">
              <span className="font-mono text-[#2A2A2A] text-xs">Start replay to see trajectory</span>
            </div>
          ) : (
            <TrajectoryChart logs={drive.logs} driveType={driveType} />
          )}
        </div>
      </div>

      <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
        <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-[#E63946]"
            style={{ animation: isStreaming ? 'pulse 1s infinite' : 'none' }} />
          <span className="font-mono text-[#e4bebc] text-[10px] tracking-[0.25em] uppercase">PREDICTION LOG</span>
          <span className="font-mono text-[#333] text-[10px] ml-auto">XGBoost output</span>
        </div>
        <div ref={logBoxRef} className="px-5 py-4 min-h-[160px] max-h-[220px] overflow-y-auto">
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

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function P5PredictiveFailure() {
  const [drives,      setDrives]     = useState({});
  const [selectedId,  setSelectedId] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading,     setLoading]    = useState(false);
  const [dragOver,    setDragOver]   = useState(false);

  const streamCtrlsRef = useRef({});
  const logBoxRef      = useRef(null);
  const fileInputRef   = useRef(null);

  // ── Mirror state into refs so callbacks never capture stale closures ──
  // The core problem: useCallback with `drives` in deps recreates the
  // function on every drive state change, causing drag handlers to go
  // stale mid-drop. Reading from a ref instead gives us always-current
  // data without listing drives as a dep.
  const drivesRef    = useRef(drives);
  const selectedRef  = useRef(selectedId);
  useEffect(() => { drivesRef.current   = drives;     }, [drives]);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);

  // Auto-scroll prediction log
  const selectedLogs = drives[selectedId]?.logs;
  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [selectedLogs?.length]);

  // Abort streams on unmount
  useEffect(() => () => {
    Object.values(streamCtrlsRef.current).forEach(c => c.abort());
  }, []);

  // ── Derived counts ──
  const driveList     = Object.values(drives);
  const totalDrives   = driveList.length;
  const healthyCount  = driveList.filter(d => riskFromProb(Math.floor(d.latestSnapshot?.failure_prob ?? 0)) === 'LOW').length;
  const atRiskCount   = driveList.filter(d => riskFromProb(Math.floor(d.latestSnapshot?.failure_prob ?? 0)) === 'MEDIUM').length;
  const criticalCount = driveList.filter(d => riskFromProb(Math.floor(d.latestSnapshot?.failure_prob ?? 0)) === 'HIGH').length;

  // ── processFiles ─────────────────────────────────────────────
  // Central handler for all file input paths: button click, drag-drop,
  // onChange. Has NO deps in useCallback because it reads live state
  // from drivesRef / selectedRef instead of closing over them.
  const processFiles = useCallback(async (fileList) => {
    // Filter to CSV only — user might accidentally drag other files
    const files = Array.from(fileList).filter(f =>
      f.name.toLowerCase().endsWith('.csv')
    );
    if (!files.length) return;

    const currentIds = Object.keys(drivesRef.current);
    const slots      = 10 - currentIds.length;
    if (slots <= 0) return;

    // Deduplicate: skip files whose derived ID already exists
    const toLoad = files
      .slice(0, slots)
      .map(f => ({ file: f, id: f.name.replace(/\.csv$/i, '').slice(0, 20) }))
      .filter(({ id }) => !drivesRef.current[id]);

    if (!toLoad.length) return;

    // Add placeholder cards immediately so the UI is responsive
    setDrives(prev => {
      const next = { ...prev };
      toLoad.forEach(({ id, file }) => { next[id] = makeDrive(id, file); });
      return next;
    });

    // Auto-select first new drive if nothing selected yet
    if (!selectedRef.current) {
      setSelectedId(toLoad[0].id);
    }

    // Score all files in parallel — failures are isolated per-drive
    await Promise.all(
      toLoad.map(async ({ id, file }) => {
        try {
          const score    = await scoreFile(file);
          const snapshot = mapScoreToSnapshot(score);
          setDrives(prev => ({
            ...prev,
            [id]: { ...prev[id], latestSnapshot: snapshot, history: [snapshot.failure_prob], status: 'ready' },
          }));
        } catch (err) {
          setDrives(prev => ({
            ...prev,
            [id]: { ...prev[id], status: 'error', error: err.message },
          }));
        }
      })
    );
  }, []); // stable — no deps needed

  // ── Drag-and-drop ────────────────────────────────────────────
  const handleDragOver  = useCallback((e) => { e.preventDefault(); setDragOver(true);  }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); setDragOver(false); }, []);
  const handleDrop      = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  // ── Replay All ───────────────────────────────────────────────
  const handleReplayAll = useCallback(async () => {
    if (isStreaming) return;
    const streamable = Object.values(drivesRef.current)
      .filter(d => d.file && d.status !== 'loading');
    if (!streamable.length) return;

    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    setIsStreaming(true);

    setDrives(prev => {
      const next = {};
      Object.values(prev).forEach(d => {
        next[d.id] = { ...d, logs: [], history: d.latestSnapshot ? [d.latestSnapshot.failure_prob] : [], status: 'streaming', streamIndex: 0 };
      });
      return next;
    });

    let active = streamable.length;

    streamable.forEach(async (drive) => {
      try {
        const response = await openStream(drive.file);
        const ctrl = readSSEStream(
          response,
          (frame) => {
            const snapshot = mapFrameToSnapshot(frame);
            setDrives(prev => {
              if (!prev[drive.id]) return prev;
              const d = prev[drive.id];
              return {
                ...prev,
                [drive.id]: {
                  ...d,
                  latestSnapshot: snapshot,
                  history:        [...d.history.slice(-59), snapshot.failure_prob],
                  logs:           [...d.logs, snapshot],
                  streamIndex:    frame.index ?? d.streamIndex + 1,
                  streamTotal:    frame.total ?? d.streamTotal,
                  status:         'streaming',
                },
              };
            });
          },
          () => {
            setDrives(prev => prev[drive.id]
              ? { ...prev, [drive.id]: { ...prev[drive.id], status: 'done' } } : prev);
            if (--active <= 0) setIsStreaming(false);
          },
          (err) => {
            setDrives(prev => prev[drive.id]
              ? { ...prev, [drive.id]: { ...prev[drive.id], status: 'error', error: err.message } } : prev);
            if (--active <= 0) setIsStreaming(false);
          }
        );
        streamCtrlsRef.current[drive.id] = ctrl;
      } catch (err) {
        setDrives(prev => ({
          ...prev,
          [drive.id]: { ...prev[drive.id], status: 'error', error: err.message },
        }));
        if (--active <= 0) setIsStreaming(false);
      }
    });
  }, [isStreaming]);

  const handleStop = useCallback(() => {
    Object.values(streamCtrlsRef.current).forEach(c => c.abort());
    streamCtrlsRef.current = {};
    setIsStreaming(false);
    setDrives(prev => {
      const next = {};
      Object.values(prev).forEach(d => {
        next[d.id] = { ...d, status: d.latestSnapshot ? 'ready' : d.status };
      });
      return next;
    });
  }, []);

  const handleClear = useCallback(() => {
    handleStop();
    setDrives({});
    setSelectedId(null);
  }, [handleStop]);

  const readyDrives   = driveList.filter(d => ['ready','streaming','done'].includes(d.status));
  const loadingDrives = driveList.filter(d => ['loading','error'].includes(d.status));
  const selectedDrive = selectedId ? drives[selectedId] : null;

  const replayProgress = driveList.length
    ? Math.max(...driveList.map(d => d.streamTotal > 0 ? (d.streamIndex / d.streamTotal) * 100 : 0))
    : 0;

  return (
    <div className="bg-[#080808] min-h-screen">
      {loading && <SimLoader message="Opening stream connection…" />}

      {/* Hidden file input — the actual browser file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        multiple
        style={{ display: 'none' }}
        onChange={e => {
          if (e.target.files.length) processFiles(e.target.files);
          e.target.value = ''; // reset so same file can be re-selected
        }}
      />

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Header */}
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
          <div className="flex gap-3 flex-wrap items-center">
            <button onClick={handleStop}
              className="border border-[#5B403F] text-[#e4bebc] hover:border-[#E63946] hover:text-[#E63946] px-5 py-2.5 font-['Space_Grotesk'] font-bold text-sm transition-all active:scale-95 flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>restart_alt</span>
              Reset
            </button>
            <button onClick={handleStop} disabled={!isStreaming}
              className="border border-[#E63946]/50 text-[#e4bebc] hover:border-[#E63946] hover:text-[#E63946] px-5 py-2.5 font-['Space_Grotesk'] font-bold text-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>stop</span>
              Stop
            </button>
            <button onClick={handleReplayAll} disabled={isStreaming || totalDrives === 0}
              className="bg-[#E63946] hover:bg-[#FF4D4D] text-white px-5 py-2.5 font-['Space_Grotesk'] font-bold text-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>play_arrow</span>
              Replay All
            </button>
            <div className={`font-mono px-4 py-2 text-xs tracking-widest border ${
              isStreaming ? 'bg-[#4CAF50]/10 text-[#4CAF50] border-[#4CAF50]/30'
                         : 'bg-[#E63946]/10 text-[#E63946] border-[#E63946]/20'
            }`}>
              {isStreaming ? '● LIVE' : 'STOPPED'}
            </div>
          </div>
        </div>
      </div>

      {/* Summary bar */}
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

      {/* Two-panel layout */}
      <div className="flex" style={{ minHeight: 'calc(100vh - 160px)' }}>

        {/* LEFT */}
        <div className="border-r border-[#2A2A2A] overflow-y-auto" style={{ width: '55%', padding: '24px 32px' }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1.5 h-1.5 bg-[#E63946]" />
            <span className="font-mono text-[#e4bebc] text-[10px] tracking-[0.3em] uppercase">Drive Fleet</span>
            <div className="flex-1 h-px bg-[#2A2A2A]" />
          </div>

          {/* Upload zone — drag target + button trigger */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border border-dashed p-4 mb-5 transition-all duration-150
              ${dragOver
                ? 'border-[#E63946] bg-[#1A0000] scale-[1.01]'
                : 'border-[#5B403F] bg-[#0D0D0D] hover:border-[#E63946]/40'
              }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <span className="font-mono text-[10px] text-[#e4bebc] tracking-wide">
                  Upload one CSV per drive &nbsp;·&nbsp;
                  <span className="text-[#E63946]">{totalDrives}</span> / 10 loaded
                </span>
                <div className="font-mono text-[9px] text-[#444] mt-0.5">
                  {dragOver ? '⬇ Drop to upload' : 'drag & drop here, or click ＋ ADD FILES'}
                </div>
              </div>

              <div className="flex gap-2 flex-wrap items-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={totalDrives >= 10}
                  className="border border-[#5B403F] text-[#e4bebc] hover:border-[#E63946] hover:text-[#E63946] px-3 py-1.5 font-['Space_Grotesk'] font-bold text-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ＋ ADD FILES
                </button>
                <button
                  onClick={isStreaming ? handleStop : handleReplayAll}
                  disabled={totalDrives === 0}
                  className={`px-3 py-1.5 font-['Space_Grotesk'] font-bold text-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
                    ${isStreaming
                      ? 'border border-[#4CAF50]/50 text-[#4CAF50] hover:border-[#4CAF50]'
                      : 'bg-[#E63946] hover:bg-[#FF4D4D] text-white border border-transparent'
                    }`}
                >
                  {isStreaming ? '■ STOP' : '▶ REPLAY ALL'}
                </button>
                <button onClick={handleClear}
                  className="border border-[#E63946]/30 text-[#e4bebc] hover:border-[#E63946] hover:text-[#E63946] px-3 py-1.5 font-['Space_Grotesk'] font-bold text-xs transition-all active:scale-95">
                  ✕ CLEAR
                </button>
              </div>
            </div>

            {/* File chips */}
            {driveList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {driveList.map(d => {
                  const risk = d.latestSnapshot
                    ? riskFromProb(Math.floor(d.latestSnapshot.failure_prob))
                    : 'PENDING';
                  const chipCls =
                    risk === 'LOW'    ? 'border-[#4CAF50]/40 text-[#4CAF50]' :
                    risk === 'HIGH'   ? 'border-[#E63946]/40 text-[#E63946]' :
                    risk === 'MEDIUM' ? 'border-[#FFA500]/40 text-[#FFA500]' :
                                        'border-[#555]/40 text-[#555]';
                  return (
                    <div key={d.id}
                      className={`flex items-center gap-1.5 font-mono text-[9px] tracking-wide px-2 py-0.5 border bg-black/30 ${chipCls}`}>
                      <div className="w-[4px] h-[4px] rounded-full bg-current" />
                      {d.id}
                      {d.status === 'loading' && <span className="animate-pulse ml-1">…</span>}
                      {d.status === 'error'   && <span className="text-[#E63946] ml-1" title={d.error}>✕</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Progress bar during stream */}
            {isStreaming && (
              <div className="h-[2px] bg-[#1A1A1A] mt-3 overflow-hidden">
                <div className="h-full bg-[#E63946] transition-all duration-700"
                  style={{ width: `${replayProgress}%` }} />
              </div>
            )}
          </div>

          {driveList.length === 0 && (
            <div className="text-center py-12 font-mono text-[10px] tracking-[0.25em] text-[#333] uppercase">
              Upload CSV files above to begin
            </div>
          )}

          {readyDrives.length > 0 && (
            <div className="mb-7">
              <h3 className="font-mono text-[9px] tracking-[0.3em] px-3 py-1.5 mb-3 inline-block text-[#e4bebc] bg-[#E63946]/05 border-l-2 border-[#E63946]">
                ● DRIVES ({readyDrives.length})
              </h3>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))' }}>
                {readyDrives.map(d => (
                  <DriveCard key={d.id} drive={d}
                    isSelected={selectedId === d.id}
                    onClick={() => setSelectedId(d.id)} />
                ))}
              </div>
            </div>
          )}

          {loadingDrives.length > 0 && (
            <div className="mb-7">
              <h3 className="font-mono text-[9px] tracking-[0.3em] px-3 py-1.5 mb-3 inline-block text-[#555] bg-[#1A1A1A] border-l-2 border-[#5B403F]">
                ● PROCESSING ({loadingDrives.length})
              </h3>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))' }}>
                {loadingDrives.map(d => (
                  <DriveCard key={d.id} drive={d}
                    isSelected={selectedId === d.id}
                    onClick={() => setSelectedId(d.id)} />
                ))}
              </div>
            </div>
          )}

          {driveList.length > 0 && (
            <div className="border border-[#2A2A2A] bg-[#0D0D0D]">
              <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#E63946]" />
                <span className="font-mono text-[#e4bebc] text-[10px] tracking-[0.25em] uppercase">TWO-STAGE PIPELINE</span>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    stage: 'STAGE 1', label: 'OFFLINE TRAINING',
                    border: 'border-[#2A2A2A]', tag: 'border-[#E63946]/40 text-[#E63946] bg-[#E63946]/10', bullet: 'text-[#E63946]',
                    points: ['XGBoost trained on Backblaze public dataset — 100,000+ real drives','Feature engineering — 7-day deltas, wear velocity, error acceleration','NANDGuard features — bad_block_count (P1) + ldpc_fail_rate (P3)','Isolation Forest detects anomalous failure modes','Outputs — failure probability 0–100, estimated days remaining, SHAP attribution'],
                  },
                  {
                    stage: 'STAGE 2', label: 'FIRMWARE EXPORT',
                    border: 'border-[#4CAF50]/30', tag: 'border-[#4CAF50]/40 text-[#4CAF50] bg-[#4CAF50]/10', bullet: 'text-[#4CAF50]',
                    points: ['Trained model distilled into pure C function predict_failure()','Integer arithmetic only — zero external libraries — zero OS dependency','Under 2KB flash footprint — ARM Cortex-M compatible','Executes in under 1 microsecond on Cortex-M4','When score ≥ 70% — automatically triggers P4 OOB alert'],
                  },
                ].map(col => (
                  <div key={col.stage} className={`border ${col.border} bg-[#111111] p-4`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`font-mono text-[10px] px-2 py-0.5 border ${col.tag}`}>{col.stage}</span>
                      <span className="font-mono text-[#e4bebc] text-xs font-bold">{col.label}</span>
                    </div>
                    {col.points.map((pt, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <span className={`${col.bullet} font-mono text-[10px] mt-0.5 shrink-0`}>›</span>
                        <span className="font-mono text-[#e4bebc] text-[10px] leading-relaxed">{pt}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="bg-[#080808] overflow-y-auto" style={{ width: '45%', padding: '24px 32px' }}>
          <DetailPanel drive={selectedDrive} isStreaming={isStreaming} logBoxRef={logBoxRef} />
        </div>
      </div>
    </div>
  );
}