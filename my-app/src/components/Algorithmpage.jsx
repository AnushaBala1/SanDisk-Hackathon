import { useState } from 'react';
import AlgoP1BadBlockManager   from './Algop1badblockmanager.jsx';
import AlgoP2LogicMinimization from './Algop2logicminimization.jsx';
import AlgoP3LDPC              from './Algop3ldpc.jsx';
import AlgoP4OOBCommunication  from './Algop4oobcommunication.jsx';
import AlgoP5PredictiveFailure from './Algop5predictivefailure.jsx';

const MODULES = [
  { id: 'P1', label: 'BAD BLOCK MANAGER',          available: true  },
  { id: 'P2', label: 'LOGIC MINIMIZATION',          available: true  },
  { id: 'P3', label: 'LDPC',                        available: true  },
  { id: 'P4', label: 'OOB COMMUNICATION',           available: true  },
  { id: 'P5', label: 'PREDICTIVE FAILURE ANALYSIS', available: true  },
];

export default function AlgorithmPage() {
  const [activeModule, setActiveModule] = useState('P1');

  return (
    <div className="min-h-screen bg-[#080808] text-white">

      {/* ── Hero Intro — matches reference image ── */}
      <div className="px-8 pt-28 pb-20 bg-[#080808]">
        <div className="max-w-7xl mx-auto">
          <p className="font-['Space_Grotesk'] font-bold text-xs tracking-[0.25em] uppercase text-[#E63946] mb-6">
            ALGORITHMS
          </p>
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-['Space_Grotesk'] font-black tracking-tighter leading-[1.0] mb-8">
            <span className="text-white">Five algorithms.</span>
            <br />
            <span className="text-[#E63946]">Every one interactive.</span>
          </h1>
          <p className="text-[#A0A0A0] font-['Space_Grotesk'] text-base max-w-md leading-relaxed">
            Precision-engineered logic for the next generation of NAND reliability. Each module below is a live simulation of the firmware running in our Obsidian Command architecture.
          </p>
        </div>
      </div>

      {/* ── Core Modules Tab Bar ── */}
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

      {/* ── Module Content ── */}
      <div>
        {activeModule === 'P1' && <AlgoP1BadBlockManager />}
        {activeModule === 'P2' && <AlgoP2LogicMinimization />}
        {activeModule === 'P3' && <AlgoP3LDPC />}
        {activeModule === 'P4' && <AlgoP4OOBCommunication />}
        {activeModule === 'P5' && <AlgoP5PredictiveFailure />}
      </div>
    </div>
  );
}