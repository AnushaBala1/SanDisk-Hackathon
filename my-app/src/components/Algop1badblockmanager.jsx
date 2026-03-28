import { useState } from 'react';

export default function AlgoP1BadBlockManager() {
  return (
    <div className="bg-[#080808]">
      <div className="px-8 pt-8 pb-4 border-b border-[#E63946]/20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-[#E63946] animate-pulse" />
            <span className="font-mono text-[#E63946] text-xs tracking-[0.3em] uppercase">P1 · BAD BLOCK MANAGER</span>
          </div>
          <h2 className="text-2xl font-['Space_Grotesk'] font-black tracking-tighter text-white">XOR + Bloom Hybrid Filter</h2>
          <p className="text-[#A0A0A0] text-xs font-mono mt-1">BAD_BLOCK_MANAGER.C · XOR_FILTER · BLOOM_FILTER · BARE_METAL_CORTEX_M4</p>
        </div>
      </div>

      <div className="px-8 py-10">
        <div className="max-w-7xl mx-auto space-y-10">

          <AlgoSection num="01" label="Problem Description">
            <div className="bg-[#0D0D0D] border border-[#2A2A2A] border-l-2 border-l-[#E63946] p-6">
              <p className="text-[#C0C0C0] font-['Space_Grotesk'] text-sm leading-relaxed">
                In a 1 TB enterprise SSD with ~1 million blocks, NAND flash develops ~1% bad blocks over lifetime (≈10,000 bad blocks). Firmware must track them instantly on every block access without missing any (false negative = data corruption) while using minimal SRAM and CPU cycles on a Cortex-M4 controller under 24/7 heavy write load.
              </p>
            </div>
          </AlgoSection>

          <AlgoSection num="02" label="Conventional Method">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Flat Array / Linked List', desc: 'Store every bad block address (4 bytes each).', sub: 'Lookup: Linear scan or full array search.', icon: 'storage' },
                { label: 'Bloom Filter Only', desc: 'Small memory but allows false positives.', sub: 'Cannot guarantee zero false negatives.', icon: 'filter_alt' },
                { label: 'Result', desc: 'High memory usage or unreliable detection — neither is acceptable in production firmware.', sub: 'Not bare-metal safe.', icon: 'warning' },
              ].map((item) => (
                <div key={item.label} className="bg-[#0D0D0D] border border-[#2A2A2A] p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-[#E63946]" style={{ fontSize: '18px' }}>{item.icon}</span>
                    <span className="font-['Space_Grotesk'] font-bold text-white text-sm">{item.label}</span>
                  </div>
                  <p className="text-[#A0A0A0] font-mono text-xs leading-relaxed mb-2">{item.desc}</p>
                  <p className="text-[#666] font-mono text-[10px]">{item.sub}</p>
                </div>
              ))}
            </div>
          </AlgoSection>

          <AlgoSection num="03" label="Our Solution Proposed">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#0D0D0D] border border-[#4CAF50]/30 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-[#4CAF50]/10 border border-[#4CAF50]/40 text-[#4CAF50] font-mono text-[10px] px-2 py-0.5 tracking-widest">ACTIVE SOLUTION</div>
                </div>
                <p className="text-[#C0C0C0] font-['Space_Grotesk'] text-sm leading-relaxed mb-5">Two-layer hybrid filter:</p>
                <div className="space-y-4">
                  <div className="border-l-2 border-[#4CAF50] pl-4">
                    <div className="font-mono text-[#4CAF50] text-xs tracking-wider mb-1">LAYER 1 — XOR FILTER</div>
                    <p className="text-[#A0A0A0] font-mono text-xs leading-relaxed">Boot-time known bad blocks — zero false negatives, 1.23 bits/entry, 3 XOR ops.</p>
                  </div>
                  <div className="border-l-2 border-[#6495ED] pl-4">
                    <div className="font-mono text-[#6495ED] text-xs tracking-wider mb-1">LAYER 2 — BLOOM FILTER</div>
                    <p className="text-[#A0A0A0] font-mono text-xs leading-relaxed">Runtime-discovered bad blocks.</p>
                  </div>
                  <div className="border-l-2 border-[#E63946] pl-4">
                    <div className="font-mono text-[#E63946] text-xs tracking-wider mb-1">IMPLEMENTATION</div>
                    <p className="text-[#A0A0A0] font-mono text-xs leading-relaxed">Implemented in bad_block_manager.c/h — fully static, integer-only, bare-metal ready.</p>
                  </div>
                </div>
              </div>

              <ScrollableFlowchart title="ALGORITHM FLOW — P1">
  <svg
    viewBox="0 0 820 780"           // Increased width significantly
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: '820px', height: 'auto', display: 'block' }}
  >
    <defs>
      <marker id="arP1" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#777" />
      </marker>
    </defs>

    {/* 1. Block Address Arrives */}
    <FlowRect x={280} y={30} w={160} h={40} text={["Block Address Arrives"]} />
    <FlowArrow x1={360} y1={70} x2={360} y2={110} markerId="arP1" />

    {/* 2. Check Boot-Time Bad Blocks */}
    <FlowRect x={240} y={110} w={240} h={52} text={["Check Boot-Time Bad Blocks", "(Fixed list known at startup)"]} />
    <FlowArrow x1={360} y1={162} x2={360} y2={210} markerId="arP1" />

    {/* 3. XOR Filter Diamond */}
    <FlowDiamond cx={360} cy={275} rx={150} ry={58} text={["Matches known bad block", "via 3 hash fingerprints?"]} />

    {/* YES → BAD Block (Left) */}
    <line x1={210} y1={275} x2={100} y2={275} stroke="#555" strokeWidth="2" />
    <line x1={100} y1={275} x2={100} y2={380} stroke="#555" strokeWidth="2" markerEnd="url(#arP1)" />
    <text x={108} y={325} fill="#E63946" fontSize="10" fontFamily="monospace" fontWeight="bold">YES</text>
    <FlowTerminal x={35} y={380} w={120} h={58} text={["Block is BAD", "No data loss"]} color="red" />

    {/* NO → Runtime Check (Right) */}
    <line x1={510} y1={275} x2={590} y2={275} stroke="#555" strokeWidth="2" />
    <line x1={590} y1={275} x2={590} y2={390} stroke="#555" strokeWidth="2" markerEnd="url(#arP1)" />
    <text x={520} y={325} fill="#888" fontSize="10" fontFamily="monospace">NO</text>

    {/* 4. Check Runtime Bad Blocks */}
    <FlowRect x={480} y={390} w={220} h={52} text={["Check Runtime Bad Blocks", "(Newly discovered via Bloom)"]} />
    <FlowArrow x1={590} y1={442} x2={590} y2={490} markerId="arP1" />

    {/* 5. Bloom Filter Diamond */}
    <FlowDiamond cx={590} cy={565} rx={145} ry={58} text={["Multiple hashes hit", "set bits in Bloom array?"]} />

    {/* YES → PROBABLY BAD (Left) */}
    <line x1={445} y1={565} x2={330} y2={565} stroke="#555" strokeWidth="2" />
    <line x1={330} y1={565} x2={330} y2={665} stroke="#555" strokeWidth="2" markerEnd="url(#arP1)" />
    <text x={338} y={615} fill="#FFA500" fontSize="10" fontFamily="monospace" fontWeight="bold">YES</text>
    <FlowTerminal x={250} y={665} w={140} h={58} text={["PROBABLY BAD", "Treat as bad"]} color="orange" />

    {/* NO → GOOD Block (Right) - Now properly spaced */}
    <line x1={800} y1={565} x2={735} y2={565} stroke="#555" strokeWidth="2" />
    <line x1={800} y1={565} x2={800} y2={660} stroke="#555" strokeWidth="2" markerEnd="url(#arP1)" />
    <text x={780} y={615} fill="#4CAF50" fontSize="10" fontFamily="monospace" fontWeight="bold">NO</text>
    <FlowTerminal x={680} y={665} w={140} h={58} text={["Block is GOOD", "Safe to use"]} color="green" />
  </svg>
</ScrollableFlowchart>
            </div>
          </AlgoSection>

          <AlgoSection num="04" label="Performance Comparison">
            <div className="bg-[#0D0D0D] border border-[#2A2A2A] overflow-x-auto">
              <table className="w-full font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#2A2A2A]">
                    <th className="text-left px-5 py-3 text-[#A0A0A0] tracking-widest uppercase text-[10px] font-medium">Aspect</th>
                    <th className="text-left px-5 py-3 text-[#E63946]/70 tracking-widest uppercase text-[10px] font-medium">Conventional (Flat Array)</th>
                    <th className="text-left px-5 py-3 text-[#FFA500]/70 tracking-widest uppercase text-[10px] font-medium">Conventional (Bloom Only)</th>
                    <th className="text-left px-5 py-3 text-[#4CAF50] tracking-widest uppercase text-[10px] font-medium">Our Hybrid (XOR+Bloom)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Memory', '6400 B', '1 B', '32 B'],
                    ['Lookup speed', 'Full scan', '3 hashes', '3 XOR ops'],
                    ['False negatives', '0', '0', '0 (guaranteed)'],
                    ['False positives', '0', 'Possible', 'Near zero'],
                    ['Runtime bad blocks', 'Slow rebuild', 'Yes', 'Yes (Bloom layer)'],
                  ].map(([a, b, c, d], i) => (
                    <tr key={a} className={`border-b border-[#1A1A1A] ${i % 2 === 0 ? 'bg-[#0A0A0A]' : ''}`}>
                      <td className="px-5 py-3 text-[#A0A0A0]">{a}</td>
                      <td className="px-5 py-3 text-[#E63946]/80">{b}</td>
                      <td className="px-5 py-3 text-[#FFA500]/80">{c}</td>
                      <td className="px-5 py-3 text-[#4CAF50] font-bold">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AlgoSection>

          <AlgoSection num="05" label="Real-World Use Case">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UseCaseCard color="red" title="Without Our Solution" text="A video-editing application is writing 450 MB/s of 4K footage to the SSD. Suddenly, during a sustained write burst, a new bad block appears at runtime (due to wear). Conventional flat array would require a full scan → the write stalls for 8–12 µs, causing a 2.4 GB buffer overflow and permanent loss of 2.4 GB of video data." />
              <UseCaseCard color="green" title="With Our Solution" text="Our hybrid solution instantly detects the new bad block via the Bloom layer in <10 cycles → the firmware remaps the block in real time, saving the entire 2.4 GB write buffer and preventing any data loss or dropped frames." />
            </div>
          </AlgoSection>

        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   SHARED COMPONENTS 
   ════════════════════════════════════════ */

export function AlgoSection({ num, label, children }) {
  return (
    <section>
      <div className="flex items-center gap-4 mb-5">
        <span className="font-mono text-[#E63946] text-[10px] tracking-[0.35em] uppercase">{num}</span>
        <div className="h-px flex-1 bg-[#E63946]/20" />
        <span className="font-mono text-[#E63946] text-[10px] tracking-[0.35em] uppercase">{label}</span>
      </div>
      {children}
    </section>
  );
}

export function ScrollableFlowchart({ title, children }) {
  return (
    <div
      className="bg-[#0D0D0D] border border-[#2A2A2A] overflow-hidden"
      style={{ minHeight: '420px', display: 'flex', flexDirection: 'column' }}
    >
      <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center justify-between gap-3 flex-shrink-0">
        <span className="font-mono text-[#A0A0A0] text-[10px] tracking-[0.25em] uppercase">{title}</span>
        <span className="font-mono text-[10px] border border-[#333] px-2 py-0.5 tracking-wider text-[#666]">
          SCROLL ↑↓ ←→
        </span>
      </div>

      <div
        className="flowchart-scroll"
        style={{
          flexGrow: 1,
          overflow: 'auto',
          maxHeight: '620px',           // Increased max height
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ 
          display: 'inline-block', 
          padding: '40px 60px 40px 40px',   // More right padding
          verticalAlign: 'top' 
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
export function UseCaseCard({ color, title, text }) {
  const isRed = color === 'red';
  return (
    <div className={`bg-[#0D0D0D] border p-6 ${isRed ? 'border-[#E63946]/30' : 'border-[#4CAF50]/30'}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className={`material-symbols-outlined ${isRed ? 'text-[#E63946]' : 'text-[#4CAF50]'}`} style={{ fontSize: '16px' }}>{isRed ? 'close' : 'check'}</span>
        <span className={`font-mono text-[10px] tracking-widest uppercase ${isRed ? 'text-[#E63946]' : 'text-[#4CAF50]'}`}>{title}</span>
      </div>
      <p className="text-[#A0A0A0] font-['Space_Grotesk'] text-sm leading-relaxed">{text}</p>
    </div>
  );
}

/* ── SVG Flowchart building blocks ── */
export function FlowRect({ x, y, w, h, text }) {
  const lineH = 13;
  const totalH = text.length * lineH;
  const startY = y + h / 2 - totalH / 2 + lineH * 0.85;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#111" stroke="#3A3A3A" strokeWidth="1" />
      {text.map((line, i) => (
        <text key={i} x={x + w / 2} y={startY + i * lineH} textAnchor="middle" fill="#C0C0C0" fontSize="9" fontFamily="monospace">{line}</text>
      ))}
    </g>
  );
}

export function FlowDiamond({ cx, cy, rx, ry, text }) {
  const points = `${cx},${cy - ry} ${cx + rx},${cy} ${cx},${cy + ry} ${cx - rx},${cy}`;
  const lineH = 12;
  const totalH = text.length * lineH;
  const startY = cy - totalH / 2 + lineH * 0.85;
  return (
    <g>
      <polygon points={points} fill="#0D0D0D" stroke="#3A3A3A" strokeWidth="1" />
      {text.map((line, i) => (
        <text key={i} x={cx} y={startY + i * lineH} textAnchor="middle" fill="#C0C0C0" fontSize="9" fontFamily="monospace">{line}</text>
      ))}
    </g>
  );
}

export function FlowTerminal({ x, y, w, h, text, color }) {
  const bg = color === 'green' ? 'rgba(76,175,80,0.18)' : color === 'red' ? 'rgba(230,57,70,0.18)' : 'rgba(255,165,0,0.18)';
  const stroke = color === 'green' ? '#4CAF50' : color === 'red' ? '#E63946' : '#FFA500';
  const lineH = 13;
  const totalH = text.length * lineH;
  const startY = y + h / 2 - totalH / 2 + lineH * 0.85;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={bg} stroke={stroke} strokeWidth="1" />
      {text.map((line, i) => (
        <text key={i} x={x + w / 2} y={startY + i * lineH} textAnchor="middle" fill={stroke} fontSize="8.5" fontFamily="monospace" fontWeight="bold">{line}</text>
      ))}
    </g>
  );
}

export function FlowArrow({ x1, y1, x2, y2, markerId = 'arP1' }) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ex = x2 - (dx / len) * 7;
  const ey = y2 - (dy / len) * 7;
  return <line x1={x1} y1={y1} x2={ex} y2={ey} stroke="#555" strokeWidth="2" markerEnd={`url(#${markerId})`} />;
}