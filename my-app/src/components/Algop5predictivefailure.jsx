import { AlgoSection, ScrollableFlowchart, UseCaseCard, FlowRect, FlowDiamond, FlowTerminal, FlowArrow } from './Algop1badblockmanager.jsx';

export default function AlgoP5PredictiveFailure() {
  return (
    <div className="bg-[#080808]">
      <div className="px-8 pt-8 pb-4 border-b border-[#E63946]/20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-[#E63946] animate-pulse" />
            <span className="font-mono text-[#E63946] text-xs tracking-[0.3em] uppercase">P5 · PREDICTIVE FAILURE ANALYSIS</span>
          </div>
          <h2 className="text-2xl font-['Space_Grotesk'] font-black tracking-tighter text-white">Lightweight Integer-Based Health Predictor</h2>
          <p className="text-[#A0A0A0] text-xs font-mono mt-1">FAILURE_PREDICTOR.C · INTEGER_SCORING · OFFLINE_TRAINED_MODEL · BARE_METAL_CORTEX_M4</p>
        </div>
      </div>

      <div className="px-8 py-10">
        <div className="max-w-7xl mx-auto space-y-10">

          <AlgoSection num="01" label="Problem Description">
            <div className="bg-[#0D0D0D] border border-[#2A2A2A] border-l-2 border-l-[#E63946] p-6">
              <p className="text-[#C0C0C0] font-['Space_Grotesk'] text-sm leading-relaxed">
                SSD failures are gradual but unpredictable. Firmware must estimate failure probability in real time using multiple health indicators — bad blocks, wear level, LDPC failure rate, and temperature — without floating-point support, no heavy ML models, and within a few CPU cycles on Cortex-M4. Either conventional approach is too inaccurate or too expensive to deploy on bare-metal embedded firmware.
              </p>
            </div>
          </AlgoSection>

          <AlgoSection num="02" label="Conventional Method">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#0D0D0D] border border-[#2A2A2A] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[#E63946]" style={{ fontSize: '18px' }}>tune</span>
                  <span className="font-['Space_Grotesk'] font-bold text-white text-sm">Threshold-Based Rules</span>
                </div>
                <ul className="text-[#A0A0A0] font-mono text-xs leading-relaxed space-y-1.5">
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>Fixed limits (e.g., wear {'>'} 80% → warning)</li>
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>Ignores interactions between parameters</li>
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>Misses compounding failures — low accuracy</li>
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>No real probability output — only binary alert</li>
                </ul>
              </div>
              <div className="bg-[#0D0D0D] border border-[#2A2A2A] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[#E63946]" style={{ fontSize: '18px' }}>model_training</span>
                  <span className="font-['Space_Grotesk'] font-bold text-white text-sm">Full ML Models (XGBoost etc.)</span>
                </div>
                <ul className="text-[#A0A0A0] font-mono text-xs leading-relaxed space-y-1.5">
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>High accuracy but requires floating-point</li>
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>Large memory and runtime overhead</li>
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>Not deployable on bare-metal Cortex-M4</li>
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>Result: accurate but entirely unsuitable for firmware</li>
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
                  Lightweight integer-based prediction model pre-trained offline (XGBoost/logistic), converted into integer thresholds and scoring logic. Outputs a single failure_prob (0–100%) — fully static, no heap, no floating-point operations.
                </p>
                <div className="space-y-4">
                  <div className="border-l-2 border-[#4CAF50] pl-4">
                    <div className="font-mono text-[#4CAF50] text-xs tracking-wider mb-1">OFFLINE TRAINING</div>
                    <p className="text-[#A0A0A0] font-mono text-xs leading-relaxed">Model trained on historical failure datasets, then converted to integer thresholds + scoring weights.</p>
                  </div>
                  <div className="border-l-2 border-[#6495ED] pl-4">
                    <div className="font-mono text-[#6495ED] text-xs tracking-wider mb-1">INTEGER PIPELINE</div>
                    <p className="text-[#A0A0A0] font-mono text-xs leading-relaxed">Normalizes raw metrics → scores contributions → accumulates → clamps to 0–100%.</p>
                  </div>
                  <div className="border-l-2 border-[#FFA500] pl-4">
                    <div className="font-mono text-[#FFA500] text-xs tracking-wider mb-1">DOWNSTREAM FEEDS</div>
                    <p className="text-[#A0A0A0] font-mono text-xs leading-relaxed">Outputs failure_prob into P2 trigger logic and P4 OOB broadcast system in real time.</p>
                  </div>
                </div>
              </div>

              <ScrollableFlowchart title="ALGORITHM FLOW — P5">
                <svg
                  viewBox="0 0 620 1060"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ width: '620px', height: 'auto', display: 'block' }}
                >
                  <defs>
                    <marker id="arP5" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                      <path d="M0,0 L10,5 L0,10 Z" fill="#777" />
                    </marker>
                  </defs>

                  {/* Collect raw health metrics */}
                  <FlowRect x={190} y={20} w={240} h={46} text={["Collect Raw Health Metrics", "(bad blocks, wear, LDPC fails, temp)"]} />
                  <FlowArrow x1={310} y1={66} x2={310} y2={96} markerId="arP5" />

                  {/* Normalize inputs */}
                  <FlowRect x={190} y={96} w={240} h={46} text={["Normalize Inputs", "(scale to integer ranges)"]} />
                  <FlowArrow x1={310} y1={142} x2={310} y2={172} markerId="arP5" />

                  {/* Score each metric contribution */}
                  <FlowRect x={190} y={172} w={240} h={46} text={["Score Each Metric Contribution", "(integer weights × normalized values)"]} />
                  <FlowArrow x1={310} y1={218} x2={310} y2={248} markerId="arP5" />

                  {/* Accumulate total risk score */}
                  <FlowRect x={190} y={248} w={240} h={46} text={["Accumulate Total Risk Score", "(sum weighted contributions)"]} />
                  <FlowArrow x1={310} y1={294} x2={310} y2={334} markerId="arP5" />

                  {/* Is failure trend increasing? */}
                  <FlowDiamond cx={310} cy={390} rx={120} ry={56} text={["Is failure trend", "increasing?"]} />

                  {/* YES → increase probability */}
                  <line x1={190} y1={390} x2={80} y2={390} stroke="#555" strokeWidth="2" />
                  <line x1={80} y1={390} x2={80} y2={490} stroke="#555" strokeWidth="2" markerEnd="url(#arP5)" />
                  <text x={88} y={442} fill="#E63946" fontSize="9" fontFamily="monospace" fontWeight="bold">Yes</text>
                  <FlowRect x={20} y={490} w={120} h={46} text={["Increase failure prob", "(risk accumulation)"]} />

                  {/* NO → maintain/adjust */}
                  <line x1={430} y1={390} x2={520} y2={390} stroke="#555" strokeWidth="2" />
                  <line x1={520} y1={390} x2={520} y2={490} stroke="#555" strokeWidth="2" markerEnd="url(#arP5)" />
                  <text x={436} y={442} fill="#4CAF50" fontSize="9" fontFamily="monospace">No</text>
                  <FlowRect x={460} y={490} w={120} h={46} text={["Maintain or slightly", "adjust probability"]} />

                  {/* Converge → clamp output */}
                  <line x1={80} y1={536} x2={80} y2={590} stroke="#555" strokeWidth="2" />
                  <line x1={520} y1={536} x2={520} y2={590} stroke="#555" strokeWidth="2" />
                  <line x1={80} y1={590} x2={520} y2={590} stroke="#555" strokeWidth="2" />
                  <line x1={310} y1={590} x2={310} y2={610} stroke="#555" strokeWidth="2" markerEnd="url(#arP5)" />

                  <FlowRect x={190} y={610} w={240} h={36} text={["Clamp output to 0–100%"]} />
                  <FlowArrow x1={310} y1={646} x2={310} y2={676} markerId="arP5" />

                  <FlowRect x={190} y={676} w={240} h={36} text={["Output final failure_prob"]} />
                  <FlowArrow x1={310} y1={712} x2={310} y2={742} markerId="arP5" />

                  <FlowRect x={190} y={742} w={240} h={36} text={["Feed into decision systems"]} />

                  {/* Two downstream branches */}
                  <line x1={310} y1={778} x2={310} y2={808} stroke="#555" strokeWidth="2" />
                  <line x1={130} y1={808} x2={490} y2={808} stroke="#555" strokeWidth="2" />
                  <line x1={130} y1={808} x2={130} y2={828} stroke="#555" strokeWidth="2" markerEnd="url(#arP5)" />
                  <line x1={490} y1={808} x2={490} y2={828} stroke="#555" strokeWidth="2" markerEnd="url(#arP5)" />

                  {/* P2 Trigger Logic */}
                  <FlowRect x={50} y={828} w={160} h={46} text={["P2: Trigger Logic", "(alert classification)"]} />

                  {/* P4 OOB Broadcast */}
                  <FlowRect x={410} y={828} w={160} h={46} text={["P4: OOB Broadcast", "(external reporting)"]} />

                  {/* Both → Enable real-time monitoring */}
                  <line x1={130} y1={874} x2={130} y2={940} stroke="#555" strokeWidth="2" markerEnd="url(#arP5)" />
                  <line x1={490} y1={874} x2={490} y2={940} stroke="#555" strokeWidth="2" markerEnd="url(#arP5)" />

                  <FlowTerminal x={50} y={940} w={160} h={44} text={["Real-time monitoring", "outside system"]} color="green" />
                  <FlowTerminal x={410} y={940} w={160} h={44} text={["Real-time monitoring", "outside system"]} color="green" />
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
                    <th className="text-left px-5 py-3 text-[#E63946]/70 tracking-widest uppercase text-[10px] font-medium">Conventional Thresholds</th>
                    <th className="text-left px-5 py-3 text-[#FFA500]/70 tracking-widest uppercase text-[10px] font-medium">Full ML Models</th>
                    <th className="text-left px-5 py-3 text-[#4CAF50] tracking-widest uppercase text-[10px] font-medium">Our Lightweight Predictor</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Accuracy', 'Low', 'High', 'High (near ML-level)'],
                    ['Compute cost', 'Very low', 'Very high', 'Very low'],
                    ['Memory', 'Minimal', 'Large', 'Minimal'],
                    ['Firmware suitability', 'Yes', 'No', 'Yes'],
                    ['Real-time capability', 'Limited', 'No', 'Yes'],
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
              <UseCaseCard color="red" title="Without Our Solution" text="A mobile device SSD is running heavy workloads — gaming plus background updates. Bad blocks increase slowly while temperature fluctuates. The conventional threshold system treats each metric in isolation and misses the compounding risk → sudden, unwarned failure occurs, wiping unsaved game progress and corrupting background sync data." />
              <UseCaseCard color="green" title="With Our Solution" text="Our predictor combines all signals — bad blocks, wear, LDPC fails, and temperature — and detects rising failure probability (e.g., 68%) well before the threshold crossing. Firmware triggers preventive GC, throttling, and a P4 alert, avoiding sudden crash and fully preserving user data." />
            </div>
          </AlgoSection>

        </div>
      </div>
    </div>
  );
}