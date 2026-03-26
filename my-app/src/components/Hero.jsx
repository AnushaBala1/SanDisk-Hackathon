import SSDMockup from './SSDMockup';

export default function Hero({ onSimulationClick }) {
  return (
    <section className="relative min-h-screen flex items-center pt-24 overflow-hidden bg-[#080808]">
      <div className="absolute inset-0 circuit-pattern opacity-10"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#080808] to-[#080808]"></div>

      <div className="section-container grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10">
        {/* Left Content */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-10">
          <div className="inline-flex items-center px-5 py-2 bg-[#1A0000] border border-[#E63946]/50 text-[#FF4D4D] text-xs font-mono tracking-[0.125em] uppercase rounded">
            SanDisk Hackathon · Track 2
          </div>

          <h1 className="text-6xl md:text-7xl lg:text-8xl font-['Space_Grotesk'] font-black tracking-tighter leading-none text-white">
            Your SSD can now <span className="text-[#FF4D4D] text-glow-red">predict</span> its own death.
          </h1>

          <p className="text-xl text-[#A0A0A0] max-w-2xl leading-relaxed">
            Real-time firmware intelligence for enterprise NAND flash. NANDGuard leverages Five Neural Algorithms to preempt hardware failure before data loss occurs.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-6">
            <button
              onClick={onSimulationClick}
              className="bg-[#E63946] hover:bg-[#FF4D4D] text-white px-8 py-4 font-['Space_Grotesk'] font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-3 rounded min-w-[220px]"
            >
              See Live Simulation
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>

            <button className="border border-[#E63946] text-white px-8 py-4 font-['Space_Grotesk'] font-bold text-base hover:bg-[#111111] transition-all active:scale-95 flex items-center justify-center gap-3 rounded min-w-[220px]">
              How it Works
              <span className="material-symbols-outlined">south</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-8 pt-12 border-t border-[#E63946]/20">
            <div className="space-y-1">
              <div className="text-[#FF4D4D] font-mono text-3xl font-bold">99.2%</div>
              <div className="text-[#A0A0A0] text-sm tracking-widest">PREDICTIVE ACCURACY</div>
            </div>
            <div className="space-y-1">
              <div className="text-[#FF4D4D] font-mono text-3xl font-bold">&lt;15ms</div>
              <div className="text-[#A0A0A0] text-sm tracking-widest">TELEMETRY LATENCY</div>
            </div>
            <div className="space-y-1">
              <div className="text-[#FF4D4D] font-mono text-3xl font-bold">4.2M</div>
              <div className="text-[#A0A0A0] text-sm tracking-widest">IOPS MONITORED</div>
            </div>
          </div>
        </div>

        {/* Right Side */}
        <div className="lg:col-span-5 relative flex items-center justify-center pt-12 lg:pt-0">
          <div className="absolute w-[520px] h-[520px] border border-[#E63946]/10 rounded-full animate-ping opacity-20"></div>
          <div className="absolute w-[420px] h-[420px] border border-[#E63946]/5 rounded-full animate-pulse opacity-30"></div>

          <SSDMockup />

          {/* Floating Badges */}
          <div className="absolute top-12 right-6 bg-[#0F0F0F] border border-[#E63946]/70 p-4 backdrop-blur-sm">
            <div className="text-[10px] text-[#FF4D4D] font-mono tracking-widest">WEAR LEVEL</div>
            <div className="text-2xl font-mono font-bold text-white">84.2%</div>
          </div>

          <div className="absolute bottom-24 left-6 bg-[#0F0F0F] border border-[#E63946]/70 p-4 backdrop-blur-sm">
            <div className="text-[10px] text-[#FF4D4D] font-mono tracking-widest">P/E CYCLES</div>
            <div className="text-2xl font-mono font-bold text-white">2,842</div>
          </div>

          <div className="absolute top-1/2 -right-8 bg-[#1A0000] border border-[#E63946] p-4">
            <div className="text-[10px] text-white font-mono tracking-widest">FAILURE RISK</div>
            <div className="text-2xl font-mono font-bold text-[#FF4D4D]">0.02%</div>
          </div>
        </div>
      </div>
    </section>
  );
}