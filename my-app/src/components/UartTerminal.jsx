import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const BACKEND_URL  = "https://sandisk-hackathon.onrender.com";
const POLL_MS      = 1000;   // fetch new logs every 1 second
const MAX_DISPLAY  = 300;    // max lines to keep in React state (memory cap)

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — log line colorization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a CSS color class based on the content of the UART line.
 * We scan for common embedded log keywords:
 *   ERROR / FAULT / FAIL  → red
 *   WARN                  → amber
 *   OK / PASS / SUCCESS   → green
 *   INFO / LOG / INIT     → cyan (default terminal color)
 *   everything else       → dim white
 *
 * This runs on every incoming line. It's a simple string scan — O(n)
 * where n = line length. Fast enough at 115200 baud typical output rates.
 */
function classifyLine(text) {
  const upper = text.toUpperCase();
  if (/ERROR|FAULT|FAIL|CRITICAL|PANIC/.test(upper)) return "error";
  if (/WARN|WARNING/.test(upper))                     return "warn";
  if (/\bOK\b|PASS|SUCCESS|DONE|READY/.test(upper))  return "ok";
  if (/INFO|INIT|BOOT|START|LOAD/.test(upper))        return "info";
  return "default";
}

const LINE_COLORS = {
  error:   "#ff4d4d",
  warn:    "#ffb347",
  ok:      "#39ff14",
  info:    "#00e5ff",
  default: "#c8d0d8",
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function UartTerminal() {
  const [logs, setLogs]           = useState([]);       // array of log entry objects
  const [connected, setConnected] = useState(false);    // is backend reachable?
  const [paused, setPaused]       = useState(false);    // user paused auto-scroll
  const [filter, setFilter]       = useState("");       // text filter
  const [stats, setStats]         = useState({ total: 0, errors: 0, warns: 0 });

  // lastIdRef tracks the highest log id we've received.
  // We send this as ?since=<id> so the backend only returns new lines.
  // Using a ref (not state) because it must NOT trigger a re-render when updated.
  const lastIdRef    = useRef(-1);
  const bottomRef    = useRef(null);   // DOM ref for auto-scroll anchor
  const pausedRef    = useRef(false);  // mirror of paused state for use inside setInterval callback
  const intervalRef  = useRef(null);   // setInterval handle for cleanup

  // Keep pausedRef in sync with paused state.
  // We need this because the polling callback closes over pausedRef (not paused)
  // to avoid stale closure issues — the interval callback captures the ref's
  // .current value at call-time, not at creation-time.
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // ── fetch new logs from backend ──────────────────────────────────────────

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/uart/logs?since=${lastIdRef.current}`,
        { signal: AbortSignal.timeout(2500) }   // 2.5s timeout — don't pile up
      );

      if (!res.ok) {
        setConnected(false);
        return;
      }

      setConnected(true);
      const data = await res.json();

      if (!data.logs || data.logs.length === 0) return;

      // Update the "last seen" id cursor to the highest id in this batch
      const maxId = Math.max(...data.logs.map(l => l.id));
      lastIdRef.current = maxId;

      setLogs(prev => {
        // Merge new logs onto the end, then trim to MAX_DISPLAY from the bottom.
        // Trimming from the front (oldest) keeps memory bounded without
        // disrupting the user's current scroll position too badly.
        const merged = [...prev, ...data.logs];
        return merged.length > MAX_DISPLAY
          ? merged.slice(merged.length - MAX_DISPLAY)
          : merged;
      });

      // Update stats counters
      setStats(prev => {
        const newErrors = data.logs.filter(l => classifyLine(l.line) === "error").length;
        const newWarns  = data.logs.filter(l => classifyLine(l.line) === "warn").length;
        return {
          total:  data.total,
          errors: prev.errors + newErrors,
          warns:  prev.warns  + newWarns,
        };
      });
    } catch {
      // Network error or timeout — just mark as disconnected, keep retrying
      setConnected(false);
    }
  }, []);

  // ── polling setup ────────────────────────────────────────────────────────

  useEffect(() => {
    // Fetch immediately on mount, then every POLL_MS
    fetchLogs();
    intervalRef.current = setInterval(fetchLogs, POLL_MS);

    return () => {
      // Cleanup: cancel the interval when component unmounts.
      // Without this, the interval keeps firing after navigation away,
      // causing setState on unmounted component warnings.
      clearInterval(intervalRef.current);
    };
  }, [fetchLogs]);

  // ── auto-scroll ──────────────────────────────────────────────────────────

  useEffect(() => {
    // When new logs arrive AND user hasn't paused, scroll to bottom.
    // We check pausedRef.current (not paused) to avoid this effect re-running
    // every time paused toggles.
    if (!pausedRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // ── filtered view ────────────────────────────────────────────────────────

  // Filter is applied on render — we don't store filtered logs in state.
  // This keeps state simple: one source of truth (logs), derived view (filtered).
  const filteredLogs = filter.trim()
    ? logs.filter(l => l.line.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  // ── handlers ─────────────────────────────────────────────────────────────

  const handleClear = () => {
    setLogs([]);
    lastIdRef.current = -1;
    setStats({ total: 0, errors: 0, warns: 0 });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={styles.wrapper}>
      {/* ── Header bar ── */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>◈ NAND<span style={styles.logoAccent}>GUARD</span></span>
          <span style={styles.headerSub}>UART MONITOR</span>
        </div>

        {/* Status pill */}
        <div style={{
          ...styles.statusPill,
          background: connected ? "rgba(57,255,20,0.12)" : "rgba(255,77,77,0.12)",
          border: `1px solid ${connected ? "#39ff14" : "#ff4d4d"}`,
          color:  connected ? "#39ff14" : "#ff4d4d",
        }}>
          <span style={{
            ...styles.statusDot,
            background: connected ? "#39ff14" : "#ff4d4d",
            boxShadow: connected ? "0 0 6px #39ff14" : "0 0 6px #ff4d4d",
            animation: connected ? "pulse 1.5s infinite" : "none",
          }} />
          {connected ? "LIVE" : "OFFLINE"}
        </div>

        {/* Stats */}
        <div style={styles.statsRow}>
          <StatBadge label="LINES" value={stats.total}  color="#00e5ff" />
          <StatBadge label="ERR"   value={stats.errors} color="#ff4d4d" />
          <StatBadge label="WARN"  value={stats.warns}  color="#ffb347" />
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={styles.toolbar}>
        <input
          style={styles.filterInput}
          placeholder="filter logs..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <ToolbarBtn onClick={() => setPaused(p => !p)} active={paused}>
          {paused ? "▶ RESUME" : "⏸ PAUSE"}
        </ToolbarBtn>
        <ToolbarBtn onClick={handleClear}>⬜ CLEAR</ToolbarBtn>
      </div>

      {/* ── Terminal body ── */}
      <div style={styles.terminal}>
        {filteredLogs.length === 0 && (
          <div style={styles.emptyState}>
            {connected
              ? "Waiting for data from ZedBoard..."
              : "Cannot reach backend. Is uart_reader.py running?"}
          </div>
        )}

        {filteredLogs.map((entry, i) => {
          const kind  = classifyLine(entry.line);
          const color = LINE_COLORS[kind];
          // Format the timestamp to just HH:MM:SS.mmm — compact for a terminal
          const ts = entry.ts
            ? entry.ts.replace("T", " ").replace("Z", "").slice(11, 23)
            : "";

          return (
            <div key={entry.id ?? i} style={styles.logLine}>
              {/* Line number gutter */}
              <span style={styles.lineNum}>{String(entry.id ?? i).padStart(4, "0")}</span>

              {/* Timestamp */}
              <span style={styles.timestamp}>{ts}</span>

              {/* Log text — colored by classification */}
              <span style={{ ...styles.lineText, color }}>{entry.line}</span>
            </div>
          );
        })}

        {/* Invisible div at bottom — scrollIntoView target */}
        <div ref={bottomRef} />
      </div>

      {/* ── Footer ── */}
      <div style={styles.footer}>
        <span>115200 baud · UTF-8 · polling {POLL_MS}ms</span>
        <span>showing last {MAX_DISPLAY} lines</span>
      </div>

      {/* CSS keyframes injected inline */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600&display=swap');
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0a0d11; }
        ::-webkit-scrollbar-thumb { background: #2a3040; border-radius: 3px; }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function StatBadge({ label, value, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 44 }}>
      <span style={{ fontSize: 15, fontWeight: 600, color, fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
      </span>
      <span style={{ fontSize: 9, color: "#4a5568", letterSpacing: "0.1em" }}>{label}</span>
    </div>
  );
}

function ToolbarBtn({ onClick, children, active }) {
  return (
    <button
      onClick={onClick}
      style={{
        background:  active ? "rgba(57,255,20,0.1)" : "transparent",
        border:      `1px solid ${active ? "#39ff14" : "#2a3040"}`,
        color:       active ? "#39ff14" : "#5a6478",
        fontFamily:  "'JetBrains Mono', monospace",
        fontSize:    11,
        padding:     "4px 12px",
        borderRadius: 3,
        cursor:      "pointer",
        letterSpacing: "0.05em",
        transition:  "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = {
  wrapper: {
    display:       "flex",
    flexDirection: "column",
    height:        "100vh",
    background:    "#080b10",
    fontFamily:    "'JetBrains Mono', monospace",
    color:         "#c8d0d8",
    overflow:      "hidden",
  },
  header: {
    display:        "flex",
    alignItems:     "center",
    gap:            24,
    padding:        "12px 20px",
    background:     "#0d1117",
    borderBottom:   "1px solid #1a2030",
    flexShrink:     0,
  },
  headerLeft: {
    display:    "flex",
    flexDirection: "column",
    marginRight: "auto",
  },
  logo: {
    fontSize:    18,
    fontWeight:  600,
    color:       "#e2e8f0",
    letterSpacing: "0.08em",
  },
  logoAccent: {
    color: "#00e5ff",
  },
  headerSub: {
    fontSize:    9,
    color:       "#3a4455",
    letterSpacing: "0.2em",
    marginTop:   2,
  },
  statusPill: {
    display:      "flex",
    alignItems:   "center",
    gap:          6,
    padding:      "4px 12px",
    borderRadius: 20,
    fontSize:     11,
    fontWeight:   600,
    letterSpacing: "0.1em",
  },
  statusDot: {
    width:        7,
    height:       7,
    borderRadius: "50%",
    display:      "inline-block",
    flexShrink:   0,
  },
  statsRow: {
    display: "flex",
    gap:     16,
  },
  toolbar: {
    display:      "flex",
    alignItems:   "center",
    gap:          8,
    padding:      "8px 20px",
    background:   "#0a0d12",
    borderBottom: "1px solid #141a24",
    flexShrink:   0,
  },
  filterInput: {
    flex:         1,
    maxWidth:     280,
    background:   "#0d1117",
    border:       "1px solid #1e2736",
    borderRadius: 3,
    padding:      "4px 10px",
    color:        "#a0aec0",
    fontFamily:   "'JetBrains Mono', monospace",
    fontSize:     12,
    outline:      "none",
  },
  terminal: {
    flex:       1,
    overflowY:  "auto",
    padding:    "12px 0",
    lineHeight: 1.6,
  },
  logLine: {
    display:    "flex",
    gap:        12,
    padding:    "1px 20px",
    fontSize:   12.5,
    transition: "background 0.1s",
  },
  lineNum: {
    color:      "#2a3545",
    flexShrink: 0,
    userSelect: "none",
    minWidth:   32,
    textAlign:  "right",
  },
  timestamp: {
    color:      "#3a4a60",
    flexShrink: 0,
    minWidth:   90,
  },
  lineText: {
    wordBreak: "break-all",
    flexGrow:  1,
  },
  emptyState: {
    padding:   "40px 20px",
    color:     "#2a3545",
    textAlign: "center",
    fontSize:  13,
  },
  footer: {
    display:        "flex",
    justifyContent: "space-between",
    padding:        "6px 20px",
    background:     "#0a0d12",
    borderTop:      "1px solid #141a24",
    fontSize:       10,
    color:          "#2a3545",
    letterSpacing:  "0.05em",
    flexShrink:     0,
  },
};
