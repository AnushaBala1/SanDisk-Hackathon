import { useState } from 'react';
import P1BadBlockManager   from './P1badblockmanager.jsx';
import P2LogicMinimization from './P2logicminimization.jsx';
import P3LDPC              from './P3ldpc.jsx';

const MODULES = [
  { id: 'P1', label: 'BAD BLOCK MANAGER',          available: true  },
  { id: 'P2', label: 'LOGIC MINIMIZATION',          available: true  },
  { id: 'P3', label: 'LDPC',                        available: true  },
  { id: 'P4', label: 'OOB COMMUNICATION',           available: false },
  { id: 'P5', label: 'PREDICTIVE FAILURE ANALYSIS', available: false },
];

export default function SimulationPage() {
  const [activeModule, setActiveModule] = useState('P1');

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* Page Header */}
      <div className="px-8 pt-24 pb-6 border-b border-[#E63946]/30 bg-[#080808]">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center px-4 py-1.5 bg-[#1A0000] border border-[#E63946]/50 text-[#FF4D4D] text-xs font-mono tracking-[0.15em] uppercase mb-5">
            <span className="w-1.5 h-1.5 bg-[#E63946] rounded-full mr-2 animate-pulse" />
            LIVE SIMULATION
          </div>
          <h1 className="text-4xl md:text-5xl font-['Space_Grotesk'] font-black tracking-tighter text-white leading-none">
            NANDGuard protecting a simulated SSD
          </h1>
        </div>
      </div>

      {/* Core Modules Tab Bar */}
      <div className="sticky top-16 z-40 bg-[#0D0D0D] border-b border-[#2A2A2A] px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-0 overflow-x-auto">
            <span className="text-[#A0A0A0] font-mono text-[11px] tracking-[0.25em] uppercase pr-6 whitespace-nowrap py-4 border-r border-[#2A2A2A] mr-4 shrink-0">
              CORE MODULES
            </span>
            {MODULES.map(mod => (
              <button
                key={mod.id}
                onClick={() => mod.available && setActiveModule(mod.id)}
                className={`relative px-5 py-4 font-mono text-xs tracking-wider whitespace-nowrap transition-all border-b-2 shrink-0 ${
                  activeModule === mod.id
                    ? 'border-[#E63946] bg-[#1A0000]'
                    : mod.available
                    ? 'border-transparent hover:border-[#E63946]/40 cursor-pointer'
                    : 'border-transparent cursor-not-allowed'
                }`}
              >
                <span className={`font-bold mr-1.5 ${
                  activeModule === mod.id ? 'text-[#E63946]' :
                  mod.available           ? 'text-[#E63946]/60' :
                                            'text-[#5B403F]'
                }`}>
                  {mod.id}
                </span>
                <span className={
                  activeModule === mod.id ? 'text-white' :
                  mod.available           ? 'text-[#C0C0C0] hover:text-white' :
                                            'text-[#666666]'
                }>
                  {mod.label}
                </span>
                {!mod.available && (
                  <span className="ml-2 text-[#555555] text-[9px] border border-[#333333] px-1 py-0.5">
                    LOCKED
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Module Content */}
      <div>
        {activeModule === 'P1' && <P1BadBlockManager />}
        {activeModule === 'P2' && <P2LogicMinimization />}
        {activeModule === 'P3' && <P3LDPC />}
      </div>
    </div>
  );
}