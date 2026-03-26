export default function CTABanner({ onSimulationClick }) {
  return (
    <section className="w-full bg-[#1A0000] py-24 px-8 border-y border-[#E63946]">
      <div className="section-container flex flex-col lg:flex-row items-center justify-between gap-10">
        
        <h2 className="text-4xl md:text-5xl font-['Space_Grotesk'] font-black tracking-tighter text-white max-w-2xl leading-none text-center lg:text-left">
          See NANDGuard protecting a drive in real time.
        </h2>

        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <button
            onClick={onSimulationClick}
            className="bg-[#E63946] hover:bg-[#FF4D4D] text-white px-8 py-4 font-['Space_Grotesk'] font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-3 rounded min-w-[220px]"
          >
            Simulation
            <span className="material-symbols-outlined text-xl">rocket_launch</span>
          </button>

          <button className="border border-[#E63946] text-white px-8 py-4 font-['Space_Grotesk'] font-bold text-base hover:bg-[#111111] transition-all active:scale-95 flex items-center justify-center gap-3 rounded min-w-[220px]">
            Explore Algorithms
            <span className="material-symbols-outlined text-xl">menu_book</span>
          </button>
        </div>
      </div>
    </section>
  );
}