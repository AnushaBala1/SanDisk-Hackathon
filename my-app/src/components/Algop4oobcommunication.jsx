import { AlgoSection, ScrollableFlowchart, UseCaseCard, FlowRect, FlowDiamond, FlowTerminal, FlowArrow } from './Algop1badblockmanager.jsx';

export default function AlgoP4OOBCommunication() {
  return (
    <div className="bg-[#080808]">
      <div className="px-8 pt-8 pb-4 border-b border-[#E63946]/20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-[#E63946] animate-pulse" />
            <span className="font-mono text-[#E63946] text-xs tracking-[0.3em] uppercase">P4 · OOB COMMUNICATION</span>
          </div>
          <h2 className="text-2xl font-['Space_Grotesk'] font-black tracking-tighter text-white">BLE Telemetry + Last Gasp Protocol</h2>
          <p className="text-[#A0A0A0] text-xs font-mono mt-1">OOB_COMMS.C · BLE_BROADCAST · LAST_GASP_PROTOCOL · INTERRUPT_SAFE · BARE_METAL_CORTEX_M4</p>
        </div>
      </div>

      <div className="px-8 py-10">
        <div className="max-w-7xl mx-auto space-y-10">

          <AlgoSection num="01" label="Problem Description">
            <div className="bg-[#0D0D0D] border border-[#2A2A2A] border-l-2 border-l-[#E63946] p-6">
              <p className="text-[#C0C0C0] font-['Space_Grotesk'] text-sm leading-relaxed">
                SSD failures often happen silently. When the host system crashes or power is lost, critical health data — failure probability, bad blocks, wear level, and error counts — is lost before it can be logged. Firmware must broadcast real-time health status externally with near-zero latency, minimal memory, and no OS support, ensuring data survives even during sudden failure or complete power loss.
              </p>
            </div>
          </AlgoSection>

          <AlgoSection num="02" label="Conventional Method">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#0D0D0D] border border-[#2A2A2A] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[#E63946]" style={{ fontSize: '18px' }}>polling</span>
                  <span className="font-['Space_Grotesk'] font-bold text-white text-sm">SMART Polling + Disk Logging</span>
                </div>
                <ul className="text-[#A0A0A0] font-mono text-xs leading-relaxed space-y-1.5">
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>SMART polling is host-driven — requires OS + periodic reads</li>
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>Fails completely if host system crashes</li>
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>Disk logging is useless during power loss or firmware failure</li>
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>No real-time external visibility during failure events</li>
                </ul>
              </div>
              <div className="bg-[#0D0D0D] border border-[#2A2A2A] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[#E63946]" style={{ fontSize: '18px' }}>cable</span>
                  <span className="font-['Space_Grotesk'] font-bold text-white text-sm">UART / Debug Interfaces</span>
                </div>
                <ul className="text-[#A0A0A0] font-mono text-xs leading-relaxed space-y-1.5">
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>Not scalable in production environments</li>
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>Requires physical cable connection</li>
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>High overhead — not bare-metal safe</li>
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>No wireless reach during power loss scenarios</li>
                </ul>
              </div>
            </div>
          </AlgoSection>

          <AlgoSection num="03" label="Our Solution Proposed">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#0D0D0D] border border-[#4CAF50]/30 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-[#4CAF50]/10 border border-[#4CAF50]/40 text-[#4CAF50] font-mono text-[10px] px-2 py-0.5 tracking-widest">ACTIVE SOLUTION</div>
                </div>
                <p className="text-[#C0C0C0] font-['Space_Grotesk'] text-sm leading-relaxed mb-5">
                  Out-of-Band BLE broadcast system implemented in oob_comms.c/h — fully static, integer-only, interrupt-safe. Packs a complete health snapshot into a 25-byte BLE advertisement and adapts broadcast urgency based on alert level from P2.
                </p>
                <div className="space-y-4">
                  <div className="border-l-2 border-[#4CAF50] pl-4">
                    <div className="font-mono text-[#4CAF50] text-xs tracking-wider mb-1">TRIGGER LOGIC</div>
                    <p className="text-[#A0A0A0] font-mono text-xs leading-relaxed">QM-minimized logic from P2 decides alert level: OK / WARN / CRITICAL / LAST_GASP.</p>
                  </div>
                  <div className="border-l-2 border-[#6495ED] pl-4">
                    <div className="font-mono text-[#6495ED] text-xs tracking-wider mb-1">COMPACT PACKET BUILDER</div>
                    <p className="text-[#A0A0A0] font-mono text-xs leading-relaxed">Full health snapshot packed into 25-byte BLE advertisement. Decoder support for phone/ESP32 reconstruction.</p>
                  </div>
                  <div className="border-l-2 border-[#FFA500] pl-4">
                    <div className="font-mono text-[#FFA500] text-xs tracking-wider mb-1">LAST GASP PROTOCOL</div>
                    <p className="text-[#A0A0A0] font-mono text-xs leading-relaxed">On imminent failure or power loss, broadcasts final state at 50 ms ultra-fast intervals — highest priority, interrupt-safe.</p>
                  </div>
                </div>
              </div>

              <ScrollableFlowchart title="ALGORITHM FLOW — P4">
                <svg
                  viewBox="0 0 780 1260"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ width: '780px', height: 'auto', display: 'block' }}
                >
                  <defs>
                    <marker id="arP4" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                      <path d="M0,0 L10,5 L0,10 Z" fill="#777" />
                    </marker>
                  </defs>

                  {/* ═══════════════════════════════════════════════
                      CENTER AXIS = 360
                      RIGHT RAIL (Last Gasp) = x=660
                      OUTER LOOP RAIL (Yes) = x=730
                      Four interval boxes start at x=60
                      Box width ~140, gaps ~10:
                        box1: x=60  w=130  → cx=125  right=190
                        box2: x=200 w=130  → cx=265  right=330
                        box3: x=340 w=130  → cx=405  right=470
                        box4: x=490 w=140  → cx=560  right=630
                      ═══════════════════════════════════════════════ */}

                  {/* ── 1. Health Snapshot Available ── */}
                  <FlowRect x={240} y={20} w={240} h={46} text={["Health Snapshot Available", "failure prob, wear, bad blocks, errors"]} />
                  <FlowArrow x1={360} y1={66} x2={360} y2={96} markerId="arP4" />

                  {/* ── 2. Evaluate Alert Level ── */}
                  <FlowRect x={240} y={96} w={240} h={46} text={["Evaluate Alert Level", "QM minimized logic from P2"]} />
                  <FlowArrow x1={360} y1={142} x2={360} y2={182} markerId="arP4" />

                  {/* ── 3. Is failure prob >= Last Gasp threshold? ── */}
                  <FlowDiamond cx={360} cy={244} rx={130} ry={58} text={["Is failure probability", ">= Last Gasp threshold?"]} />

                  {/* YES → right rail x=660, Force LAST GASP terminal on the rail */}
                  <line x1={490} y1={244} x2={660} y2={244} stroke="#555" strokeWidth="2" />
                  <line x1={660} y1={244} x2={660} y2={782} stroke="#555" strokeWidth="2" />
                  <line x1={660} y1={782} x2={630} y2={782} stroke="#555" strokeWidth="2" markerEnd="url(#arP4)" />
                  <text x={498} y={238} fill="#E63946" fontSize="9" fontFamily="monospace" fontWeight="bold">Yes</text>
                  <FlowTerminal x={570} y={264} w={140} h={44} text={["Force LAST GASP", "Highest priority alert"]} color="red" />

                  {/* NO → down */}
                  <FlowArrow x1={360} y1={302} x2={360} y2={342} markerId="arP4" />
                  <text x={368} y={326} fill="#888" fontSize="9" fontFamily="monospace">No</text>

                  {/* ── 4. Any uncorrectable errors? ── */}
                  <FlowDiamond cx={360} cy={400} rx={120} ry={56} text={["Any uncorrectable", "errors present?"]} />

                  {/* YES → left → Set CRITICAL alert terminal */}
                  <line x1={240} y1={400} x2={120} y2={400} stroke="#555" strokeWidth="2" />
                  <line x1={120} y1={400} x2={120} y2={490} stroke="#555" strokeWidth="2" markerEnd="url(#arP4)" />
                  <text x={128} y={448} fill="#E63946" fontSize="9" fontFamily="monospace" fontWeight="bold">Yes</text>
                  <FlowTerminal x={60} y={490} w={120} h={44} text={["Set CRITICAL alert", "Immediate escalation"]} color="red" />
                  {/* CRITICAL terminal feeds down then right into ~200ms box top */}
                  <line x1={120} y1={534} x2={120} y2={800} stroke="#555" strokeWidth="2" />
                  <line x1={120} y1={800} x2={402} y2={800} stroke="#555" strokeWidth="2" markerEnd="url(#arP4)" />

                  {/* NO → down → Compute alert */}
                  <FlowArrow x1={360} y1={456} x2={360} y2={496} markerId="arP4" />
                  <text x={368} y={480} fill="#888" fontSize="9" fontFamily="monospace">No</text>
                  <FlowRect x={240} y={496} w={240} h={46} text={["Compute alert using", "minimized logic"]} />
                  <FlowArrow x1={360} y1={542} x2={360} y2={582} markerId="arP4" />

                  {/* ── 5. Alert Level? diamond ── */}
                  <FlowDiamond cx={360} cy={632} rx={115} ry={50} text={["Alert Level?"]} />

                  {/* OK → far left vertical */}
                  <line x1={245} y1={632} x2={95} y2={632} stroke="#555" strokeWidth="2" />
                  <line x1={95} y1={632} x2={95} y2={756} stroke="#555" strokeWidth="2" markerEnd="url(#arP4)" />
                  <text x={100} y={698} fill="#4CAF50" fontSize="9" fontFamily="monospace">OK</text>

                  {/* WARN → diagonal down-left */}
                  <line x1={318} y1={678} x2={268} y2={756} stroke="#555" strokeWidth="2" markerEnd="url(#arP4)" />
                  <text x={276} y={734} fill="#FFA500" fontSize="9" fontFamily="monospace">WARN</text>

                  {/* CRITICAL → diagonal down-right */}
                  <line x1={402} y1={678} x2={428} y2={756} stroke="#555" strokeWidth="2" markerEnd="url(#arP4)" />
                  <text x={396} y={734} fill="#E63946" fontSize="9" fontFamily="monospace">CRITICAL</text>

                  {/* LAST GASP rail (x=660) arrives at y=782 = mid of ultra-fast box → left arrow */}
                  {/* (already drawn above, terminates at x=630 which is right edge of box4) */}

                  {/* ── Four interval boxes all at y=756 ── */}
                  {/* box1 — OK: slow ~5 sec */}
                  <FlowRect x={60}  y={756} w={130} h={44} text={["Set slow interval", "~5 sec"]} />
                  {/* box2 — WARN: medium ~1 sec */}
                  <FlowRect x={200} y={756} w={135} h={44} text={["Set medium interval", "~1 sec"]} />
                  {/* box3 — CRITICAL: fast ~200 ms */}
                  <FlowRect x={345} y={756} w={130} h={44} text={["Set fast interval", "~200 ms"]} />
                  {/* box4 — LAST GASP: ultra-fast ~50 ms */}
                  <FlowRect x={490} y={756} w={140} h={44} text={["Set ultra-fast interval", "~50 ms"]} />

                  {/* ── All four boxes bottom-center drop to horizontal rail at y=858 ── */}
                  <line x1={125} y1={800} x2={125} y2={858} stroke="#555" strokeWidth="2" />
                  <line x1={268} y1={800} x2={268} y2={858} stroke="#555" strokeWidth="2" />
                  <line x1={410} y1={800} x2={410} y2={858} stroke="#555" strokeWidth="2" />
                  <line x1={560} y1={800} x2={560} y2={858} stroke="#555" strokeWidth="2" />
                  <line x1={125} y1={858} x2={560} y2={858} stroke="#555" strokeWidth="2" />
                  <line x1={360} y1={858} x2={360} y2={878} stroke="#555" strokeWidth="2" markerEnd="url(#arP4)" />

                  {/* ── 6. Pack health data ── */}
                  <FlowRect x={240} y={878} w={240} h={46} text={["Pack health data into", "compact BLE packet"]} />
                  <FlowArrow x1={360} y1={924} x2={360} y2={958} markerId="arP4" />

                  {/* ── 7. Broadcast via BLE ── */}
                  <FlowRect x={240} y={958} w={240} h={46} text={["Broadcast packet via BLE", "connectionless"]} />
                  <FlowArrow x1={360} y1={1004} x2={360} y2={1044} markerId="arP4" />

                  {/* ── 8. Power loss or failure still ongoing? ── */}
                  <FlowDiamond cx={360} cy={1094} rx={125} ry={50} text={["Power loss or failure", "still ongoing?"]} />

                  {/* YES → right outer rail x=730 → up → left into right edge of ultra-fast box */}
                  <line x1={485} y1={1094} x2={730} y2={1094} stroke="#555" strokeWidth="2" />
                  <line x1={730} y1={1094} x2={730} y2={778} stroke="#555" strokeWidth="2" />
                  <line x1={730} y1={778} x2={630} y2={778} stroke="#555" strokeWidth="2" markerEnd="url(#arP4)" />
                  <text x={492} y={1088} fill="#E63946" fontSize="9" fontFamily="monospace" fontWeight="bold">Yes</text>

                  {/* NO → down → Continue normal monitoring */}
                  <FlowArrow x1={360} y1={1144} x2={360} y2={1178} markerId="arP4" />
                  <text x={368} y={1166} fill="#4CAF50" fontSize="9" fontFamily="monospace">No</text>
                  <FlowTerminal x={220} y={1178} w={280} h={44} text={["Continue normal periodic", "monitoring + broadcast"]} color="green" />
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
                    <th className="text-left px-5 py-3 text-[#E63946]/70 tracking-widest uppercase text-[10px] font-medium">Conventional Methods</th>
                    <th className="text-left px-5 py-3 text-[#4CAF50] tracking-widest uppercase text-[10px] font-medium">Our OOB BLE System</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Visibility', 'Host-dependent', 'Independent (wireless)'],
                    ['Failure handling', 'None during crash', 'Works even on power loss'],
                    ['Latency', 'High (polling)', 'Real-time broadcast'],
                    ['Memory usage', 'High logging overhead', '25 bytes per packet'],
                    ['Deployment', 'Requires OS / tools', 'Bare-metal firmware'],
                  ].map(([a, b, c], i) => (
                    <tr key={a} className={`border-b border-[#1A1A1A] ${i % 2 === 0 ? 'bg-[#0A0A0A]' : ''}`}>
                      <td className="px-5 py-3 text-[#A0A0A0]">{a}</td>
                      <td className="px-5 py-3 text-[#E63946]/80">{b}</td>
                      <td className="px-5 py-3 text-[#4CAF50] font-bold">{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AlgoSection>

          <AlgoSection num="05" label="Real-World Use Case">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UseCaseCard color="red" title="Without Our Solution" text="A cloud server SSD is handling continuous database writes. Suddenly, a power failure occurs. Conventional systems lose all in-flight health data — no failure probability, no block state, no error metrics — leaving engineers with zero root cause analysis capability and repeated outages." />
              <UseCaseCard color="green" title="With Our Solution" text="Our OOB system triggers Last Gasp, broadcasting failure probability, bad block count, and error metrics at 50 ms intervals during the failure window. A nearby monitoring device captures the final state → enabling precise failure diagnosis and preventing repeated outages." />
            </div>
          </AlgoSection>

        </div>
      </div>
    </div>
  );
}