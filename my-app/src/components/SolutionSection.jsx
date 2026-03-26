export default function SolutionSection() {
  const algorithms = [
    { id: "P1", icon: "psychology", title: "Neural Wear Levelling", desc: "Optimizes cell exhaustion using deep learning to spread IO load across blocks.", stat: "24% Lifespan Inc." },
    { id: "P2", icon: "error_outline", title: "Dynamic ECC Adj", desc: "Predictively adjusts Error Correction Code strength based on Bit Error Rates.", stat: "0.0% Data Corruption" },
    { id: "P3", icon: "thermostat", title: "Thermal Throttling", desc: "Proactively reduces throughput to prevent silicon heat degradation.", stat: "-15°C Peak Temp" },
    { id: "P4", icon: "query_stats", title: "RBER Monitoring", desc: "Scans Raw Bit Error Rates to detect dying NAND pages in real-time.", stat: "Real-time Telemetry" },
    { id: "P5", icon: "cloud_sync", title: "IO Pattern Analysis", desc: "Heuristic analysis of workload behavior to predict peak demand.", stat: "95% Load Forecast" },
  ];

  return (
    <section className="py-32 bg-[#080808]">
      <div className="section-container">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
          <div className="max-w-2xl">
            <div className="text-[#E63946] font-mono text-xs tracking-[0.3em] uppercase mb-4">THE SOLUTION</div>
            <h2 className="text-5xl md:text-6xl font-['Space_Grotesk'] font-black tracking-tighter text-white">
              Five algorithms for one impenetrable shield.
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {algorithms.map((algo) => (
            <div key={algo.id} className="bg-[#111111] border border-[#5b403f] border-t-[3px] border-t-[#E63946] p-6 hover:-translate-y-2 transition-all duration-300 flex flex-col h-full group">
              <div className="flex justify-between items-start mb-8">
                <span className="font-mono text-[#E63946] text-xs font-bold">{algo.id}</span>
                <span className="material-symbols-outlined text-[#5b403f] group-hover:text-[#E63946] transition-colors">
                  {algo.icon}
                </span>
              </div>
              <h3 className="text-white font-['Space_Grotesk'] font-bold text-lg mb-2">{algo.title}</h3>
              <p className="text-[#e4bebc] text-xs mb-8 flex-grow">{algo.desc}</p>
              <div className="font-mono text-[#E63946] font-black text-sm uppercase">{algo.stat}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}