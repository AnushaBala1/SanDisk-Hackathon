export default function ProblemSection() {
  return (
    <section className="py-32 bg-[#0A0A0A]">
      <div className="section-container">
        <div className="max-w-3xl mb-16">
          <div className="text-[#E63946] font-mono text-xs tracking-[0.3em] uppercase mb-4">THE PROBLEM</div>
          <h2 className="text-5xl md:text-6xl font-['Space_Grotesk'] font-black tracking-tighter text-white leading-none">
            SSDs fail silently, and the cost is catastrophic.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { num: "$5,600/min", title: "Enterprise Downtime", text: "Average cost of unplanned server downtime due to localized storage failure in critical infrastructure." },
            { num: "70%", title: "Silent Corruption", text: "Flash storage units that fail without any SMART attribute warning until the device is read-only." },
            { num: "0 Tools", title: "Open Monitoring", text: "Total absence of cross-vendor firmware intelligence tools that provide predictive health analytics." }
          ].map((item, index) => (
            <div key={index} className="bg-[#111111] border-l-4 border-[#E63946] p-8 hover:shadow-[0_0_30px_rgba(230,57,70,0.15)] transition-all group">
              <div className="text-[#FF4D4D] font-mono text-5xl font-bold mb-4 group-hover:scale-105 transition-transform origin-left">
                {item.num}
              </div>
              <h3 className="text-white font-['Space_Grotesk'] font-bold text-xl mb-4 tracking-tight">
                {item.title}
              </h3>
              <p className="text-[#A0A0A0] font-light leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}