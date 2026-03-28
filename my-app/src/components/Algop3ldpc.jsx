import { AlgoSection, ScrollableFlowchart, UseCaseCard, FlowRect, FlowDiamond, FlowTerminal, FlowArrow } from './Algop1badblockmanager.jsx';

export default function AlgoP3LDPC() {
  return (
    <div className="bg-[#080808]">
      <div className="px-8 pt-8 pb-4 border-b border-[#E63946]/20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-[#E63946] animate-pulse" />
            <span className="font-mono text-[#E63946] text-xs tracking-[0.3em] uppercase">P3 · LDPC CODEC</span>
          </div>
          <h2 className="text-2xl font-['Space_Grotesk'] font-black tracking-tighter text-white">Sparse Systematic Single-Error Correction</h2>
          <p className="text-[#A0A0A0] text-xs font-mono mt-1">LDPC_CODEC.C · K=64 DATA · M=8 PARITY · 4-STAGE INTEGER PIPELINE · BARE_METAL_CORTEX_M4</p>
        </div>
      </div>

      <div className="px-8 py-10">
        <div className="max-w-7xl mx-auto space-y-10">

          <AlgoSection num="01" label="Problem Description">
            <div className="bg-[#0D0D0D] border border-[#2A2A2A] border-l-2 border-l-[#E63946] p-6">
              <p className="text-[#C0C0C0] font-['Space_Grotesk'] text-sm leading-relaxed">
                NAND flash suffers charge loss over time (3-year retention or high temp). A single bit can flip in a 64-bit metadata sector. Firmware must detect, locate, correct, and verify the error in the read path without heavy compute or floating-point on Cortex-M4.
              </p>
            </div>
          </AlgoSection>

          <AlgoSection num="02" label="Conventional Method">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#0D0D0D] border border-[#2A2A2A] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[#E63946]" style={{ fontSize: '18px' }}>memory</span>
                  <span className="font-['Space_Grotesk'] font-bold text-white text-sm">Full LDPC Libraries</span>
                </div>
                <p className="text-[#A0A0A0] font-mono text-xs leading-relaxed">Large tables, floats, multi-iteration decoding. High memory/CPU, not bare-metal friendly, no built-in verification.</p>
              </div>
              <div className="bg-[#0D0D0D] border border-[#2A2A2A] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[#E63946]" style={{ fontSize: '18px' }}>error</span>
                  <span className="font-['Space_Grotesk'] font-bold text-white text-sm">Simple Parity</span>
                </div>
                <ul className="text-[#A0A0A0] font-mono text-xs leading-relaxed space-y-1.5">
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>Can detect single-bit errors</li>
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>Cannot <span className="text-[#E63946] font-bold ml-1">locate</span> the error bit</li>
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>Cannot correct — only flag</li>
                  <li className="flex gap-2"><span className="text-[#E63946]">›</span>No verification stage</li>
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
                  Sparse systematic LDPC (K=64 data bits, M=8 parity bits) with 4-stage integer pipeline in ldpc_codec.c/h. Uses 256 B static H-matrix. Single-bit correction + automatic verification. Fully bare-metal, no heap, no floats.
                </p>
                <div className="space-y-4">
                  <div className="border-l-2 border-[#4CAF50] pl-4">
                    <div className="font-mono text-[#4CAF50] text-xs tracking-wider mb-1">ENCODE</div>
                    <p className="text-[#A0A0A0] font-mono text-xs leading-relaxed">Apply fixed parity rules — create 8 check bits so all rules are satisfied.</p>
                  </div>
                  <div className="border-l-2 border-[#6495ED] pl-4">
                    <div className="font-mono text-[#6495ED] text-xs tracking-wider mb-1">DETECT</div>
                    <p className="text-[#A0A0A0] font-mono text-xs leading-relaxed">Re-check all parity rules on read. Compute syndrome: which rules are broken?</p>
                  </div>
                  <div className="border-l-2 border-[#FFA500] pl-4">
                    <div className="font-mono text-[#FFA500] text-xs tracking-wider mb-1">CORRECT + VERIFY</div>
                    <p className="text-[#A0A0A0] font-mono text-xs leading-relaxed">Broken rule pattern matches ONE specific bit position → flip it → re-syndrome to verify.</p>
                  </div>
                </div>
              </div>

              <ScrollableFlowchart title="ALGORITHM FLOW — P3">
                <svg
                  viewBox="0 0 600 1020"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ width: '600px', height: 'auto', display: 'block' }}
                >
                  <defs>
                    <marker id="arP3" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
                      <path d="M0,0 L10,5 L0,10 Z" fill="#777" />
                    </marker>
                  </defs>

                  <FlowRect x={220} y={20} w={160} h={36} text={["Data to be stored"]} />
                  <FlowArrow x1={300} y1={56} x2={300} y2={86} markerId="arP3" />

                  <FlowRect x={180} y={86} w={240} h={46} text={["Apply fixed parity rules", "(Create extra check bits)"]} />
                  <FlowArrow x1={300} y1={132} x2={300} y2={162} markerId="arP3" />

                  <FlowRect x={220} y={162} w={160} h={36} text={["Write to NAND"]} />
                  <FlowArrow x1={300} y1={198} x2={300} y2={228} markerId="arP3" />

                  <FlowRect x={180} y={228} w={240} h={46} text={["Read back from NAND", "(possible single bit flip)"]} />
                  <FlowArrow x1={300} y1={274} x2={300} y2={304} markerId="arP3" />

                  <FlowRect x={180} y={304} w={240} h={46} text={["Check all parity rules again", "(Compute syndrome)"]} />
                  <FlowArrow x1={300} y1={350} x2={300} y2={390} markerId="arP3" />

                  <FlowDiamond cx={300} cy={440} rx={120} ry={50} text={["Are ALL rules", "satisfied?"]} />

                  {/* YES - Correct */}
                  <line x1={180} y1={440} x2={80} y2={440} stroke="#555" strokeWidth="2" />
                  <line x1={80} y1={440} x2={80} y2={554} stroke="#555" strokeWidth="2" markerEnd="url(#arP3)" />
                  <text x={86} y={500} fill="#4CAF50" fontSize="9" fontFamily="monospace">Yes</text>
                  <FlowTerminal x={30} y={554} w={100} h={44} text={["Data correct", "— no error"]} color="green" />

                  {/* NO - Continue */}
                  <FlowArrow x1={300} y1={490} x2={300} y2={554} markerId="arP3" />
                  <text x={308} y={526} fill="#888" fontSize="9" fontFamily="monospace">No</text>

                  <FlowRect x={180} y={554} w={240} h={46} text={["Pattern of broken rules", "matches ONE specific bit position"]} />
                  <FlowArrow x1={300} y1={600} x2={300} y2={634} markerId="arP3" />

                  <FlowRect x={220} y={634} w={160} h={36} text={["Flip that exact bit"]} />
                  <FlowArrow x1={300} y1={670} x2={300} y2={704} markerId="arP3" />

                  <FlowRect x={210} y={704} w={180} h={36} text={["Re-check all parity rules"]} />
                  <FlowArrow x1={300} y1={740} x2={300} y2={780} markerId="arP3" />

                  <FlowDiamond cx={300} cy={830} rx={115} ry={50} text={["Are ALL rules", "now satisfied?"]} />

                  {/* YES - Verified */}
                  <line x1={185} y1={830} x2={80} y2={830} stroke="#555" strokeWidth="2" />
                  <line x1={80} y1={830} x2={80} y2={934} stroke="#555" strokeWidth="2" markerEnd="url(#arP3)" />
                  <text x={86} y={886} fill="#4CAF50" fontSize="9" fontFamily="monospace">Yes</text>
                  <FlowTerminal x={30} y={934} w={100} h={44} text={["Data correct", "and verified"]} color="green" />

                  {/* NO - Uncorrectable */}
                  <line x1={415} y1={830} x2={520} y2={830} stroke="#555" strokeWidth="2" />
                  <line x1={520} y1={830} x2={520} y2={934} stroke="#555" strokeWidth="2" markerEnd="url(#arP3)" />
                  <text x={424} y={886} fill="#E63946" fontSize="9" fontFamily="monospace">No</text>
                  <FlowTerminal x={470} y={934} w={100} h={44} text={["Uncorrectable", "error — flag"]} color="red" />
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
                    <th className="text-left px-5 py-3 text-[#E63946]/70 tracking-widest uppercase text-[10px] font-medium">Conventional LDPC</th>
                    <th className="text-left px-5 py-3 text-[#4CAF50] tracking-widest uppercase text-[10px] font-medium">Our Sparse LDPC</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Memory', 'Large tables + floats', '256 B static H-matrix'],
                    ['Compute', 'Multi-iteration', '4 simple integer stages'],
                    ['Error correction', 'Multi-bit (heavy)', 'Single-bit guaranteed'],
                    ['Verification', 'None built-in', 'Automatic re-syndrome'],
                    ['Firmware fit', 'Needs OS/heap', 'Bare-metal Cortex-M'],
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
              <UseCaseCard color="red" title="Without Our Solution" text="A self-driving car's SSD stores critical mapping tables. After 3 years of retention in a hot climate, a single bit flips in a metadata sector during boot. Conventional parity detects the error but cannot correct it → the car refuses to boot, causing a 45-minute roadside delay." />
              <UseCaseCard color="green" title="With Our Solution" text="Our LDPC solution instantly locates the exact flipped bit, corrects it, and verifies integrity → the mapping table loads correctly, and the vehicle boots in <2 seconds, preventing the delay and ensuring safety." />
            </div>
          </AlgoSection>

        </div>
      </div>
    </div>
  );
}