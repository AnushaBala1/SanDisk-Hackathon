import { AlgoSection, ScrollableFlowchart, UseCaseCard, FlowRect, FlowDiamond, FlowTerminal, FlowArrow } from './Algop1badblockmanager.jsx';

export default function AlgoP2LogicMinimization() {
  return (
    <div className="bg-[#080808]">
      <div className="px-8 pt-8 pb-4 border-b border-[#E63946]/20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-[#E63946] animate-pulse" />
            <span className="font-mono text-[#E63946] text-xs tracking-[0.3em] uppercase">P2 · LOGIC MINIMIZATION</span>
          </div>
          <h2 className="text-2xl font-['Space_Grotesk'] font-black tracking-tighter text-white">QM Logic Minimizer — Quine-McCluskey Engine</h2>
          <p className="text-[#A0A0A0] text-xs font-mono mt-1">QM_MINIMIZER.C · PRIME_IMPLICANT_ENGINE · BUILD_TIME_CODE_GEN · CORTEX_M4</p>
        </div>
      </div>

      <div className="px-8 py-10">
        <div className="max-w-7xl mx-auto space-y-10">

          <AlgoSection num="01" label="Problem Description">
            <div className="bg-[#0D0D0D] border border-[#2A2A2A] border-l-2 border-l-[#E63946] p-6">
              <p className="text-[#C0C0C0] font-['Space_Grotesk'] text-sm leading-relaxed">
                Firmware evaluates 11 real-time health sensors (free blocks, dirty ratio, wear imbalance, LDPC fail rate, temperature, etc.) thousands of times per second to decide GC, wear-leveling, and alerts. Unoptimized Boolean logic creates massive gate counts and power draw on Cortex-M4.
              </p>
            </div>
          </AlgoSection>

          <AlgoSection num="02" label="Conventional Method">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#0D0D0D] border border-[#2A2A2A] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[#E63946]" style={{ fontSize: '18px' }}>code</span>
                  <span className="font-['Space_Grotesk'] font-bold text-white text-sm">Hand-written if/else or K-Maps</span>
                </div>
                <p className="text-[#A0A0A0] font-mono text-xs leading-relaxed">Only practical for ≤6 variables (2⁶ = 64 cells). For 11 variables → 2048 cells → impossible to draw or read manually.</p>
              </div>
              <div className="bg-[#0D0D0D] border border-[#2A2A2A] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[#E63946]" style={{ fontSize: '18px' }}>warning</span>
                  <span className="font-['Space_Grotesk'] font-bold text-white text-sm">K-Map Inefficiencies</span>
                </div>
                <ul className="text-[#A0A0A0] font-mono text-xs leading-relaxed space-y-1.5">
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>Prone to human visual errors</li>
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>Poor don't-care handling</li>
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>No automation, no guaranteed minimal cover</li>
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>Result: 11–18 literals, 20–30+ gates, larger flash, higher power</li>
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
                  Embedded Quine-McCluskey minimizer (qm_minimizer.c/h) runs at build time on host. Takes truth table + don't-cares → finds all prime implicants → greedy essential cover → auto-generates minimal C code (logic_functions.c).
                </p>
                <div className="space-y-4">
                  <div className="border-l-2 border-[#4CAF50] pl-4">
                    <div className="font-mono text-[#4CAF50] text-xs tracking-wider mb-1">SCALABILITY</div>
                    <p className="text-[#A0A0A0] font-mono text-xs leading-relaxed">Handles 16 variables, perfect don't-care propagation.</p>
                  </div>
                  <div className="border-l-2 border-[#6495ED] pl-4">
                    <div className="font-mono text-[#6495ED] text-xs tracking-wider mb-1">LITERAL REDUCTION</div>
                    <p className="text-[#A0A0A0] font-mono text-xs leading-relaxed">67–73% literal reduction, fully static &amp; integer-only.</p>
                  </div>
                  <div className="border-l-2 border-[#FFA500] pl-4">
                    <div className="font-mono text-[#FFA500] text-xs tracking-wider mb-1">CODE GENERATION</div>
                    <p className="text-[#A0A0A0] font-mono text-xs leading-relaxed">Build-time auto C code — no runtime overhead.</p>
                  </div>
                </div>
              </div>

              <ScrollableFlowchart title="ALGORITHM FLOW — P2">
                <svg
                  viewBox="0 0 420 800"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ width: '520px', height: 'auto', display: 'block' }}
                >
                  <defs>
                    <marker id="arP2" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                      <path d="M0,0 L10,5 L0,10 Z" fill="#777" />
                    </marker>
                  </defs>

                  <FlowRect x={90} y={20} w={240} h={46} text={["Start with Truth Table", "All input combinations + Don't-cares"]} />
                  <FlowArrow x1={210} y1={66} x2={210} y2={96} markerId="arP2" />

                  <FlowRect x={110} y={96} w={200} h={36} text={["Group combinations by", "how many 1s they have"]} />
                  <FlowArrow x1={210} y1={132} x2={210} y2={162} markerId="arP2" />

                  <FlowRect x={110} y={162} w={200} h={36} text={["Look for pairs differing", "in exactly ONE variable"]} />
                  <FlowArrow x1={210} y1={198} x2={210} y2={228} markerId="arP2" />

                  <FlowRect x={90} y={228} w={240} h={46} text={["Combine into a larger group", "(ignore that variable)"]} />
                  <FlowArrow x1={210} y1={274} x2={210} y2={314} markerId="arP2" />

                  <FlowDiamond cx={210} cy={364} rx={120} ry={50} text={["Any more pairs", "that can be combined?"]} />

                  {/* YES loop back */}
                  <line x1={90} y1={364} x2={40} y2={364} stroke="#555" strokeWidth="2" />
                  <line x1={40} y1={364} x2={40} y2={180} stroke="#555" strokeWidth="2" />
                  <line x1={40} y1={180} x2={110} y2={180} stroke="#555" strokeWidth="2" markerEnd="url(#arP2)" />
                  <text x={46} y={278} fill="#888" fontSize="9" fontFamily="monospace">Yes</text>

                  <FlowArrow x1={210} y1={414} x2={210} y2={444} markerId="arP2" />
                  <text x={218} y={434} fill="#888" fontSize="9" fontFamily="monospace">No</text>

                  <FlowRect x={90} y={444} w={240} h={46} text={["These un-combinable groups are", "the simplest building blocks (PIs)"]} />
                  <FlowArrow x1={210} y1={490} x2={210} y2={520} markerId="arP2" />

                  <FlowRect x={90} y={520} w={240} h={46} text={["Identify which building blocks are", "the ONLY way to cover YES cases"]} />
                  <FlowArrow x1={210} y1={566} x2={210} y2={596} markerId="arP2" />

                  <FlowRect x={90} y={596} w={240} h={46} text={["Greedily add fewest remaining", "blocks until every YES is covered"]} />
                  <FlowArrow x1={210} y1={642} x2={210} y2={672} markerId="arP2" />

                  <FlowTerminal x={115} y={672} w={190} h={52} text={["Final minimal expression", "— fewest terms, fewest variables"]} color="blue" />
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
                    <th className="text-left px-5 py-3 text-[#E63946]/70 tracking-widest uppercase text-[10px] font-medium">Conventional (K-maps + manual)</th>
                    <th className="text-left px-5 py-3 text-[#4CAF50] tracking-widest uppercase text-[10px] font-medium">Our QM Minimizer</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Scalability', '≤6 variables only', 'Up to 16 variables'],
                    ['Error risk', 'High (visual)', 'Zero (algorithmic)'],
                    ["Don't-care handling", 'Manual & error-prone', 'Perfect propagation'],
                    ['Literal reduction', 'None', '67–73%'],
                    ['Automation', 'None', 'Build-time auto C code'],
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
              <UseCaseCard color="red" title="Without Our Solution" text="A mobile phone is recording 8K video while simultaneously syncing 5 GB of cloud data. The SSD controller must make 12,000 GC/wear-leveling decisions per second. Conventional K-map code uses 18+ literals → each decision takes 35 cycles → the controller overheats and throttles to 60% speed, causing a 15-second recording stutter and dropped frames." />
              <UseCaseCard color="green" title="With Our Solution" text="Our QM-minimized functions reduce to 3–6 literals (<10 cycles) → the controller stays cool and sustains full 8K write speed, delivering smooth, stutter-free recording and saving the entire 5 GB sync without interruption." />
            </div>
          </AlgoSection>

        </div>
      </div>
    </div>
  );
}