export default function SSDMockup() {
  return (
    <div className="relative w-80 h-96 bg-gradient-to-br from-[#111111] to-[#0A0A0A] border border-[#E63946]/30 p-6 transform rotate-12 shadow-2xl overflow-hidden group">
      
      {/* Circuit Pattern Background */}
      <div className="absolute inset-0 circuit-pattern opacity-15 group-hover:opacity-30 transition-opacity duration-700"></div>

      {/* Subtle Red Glow Layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-[#E63946]/5 to-transparent opacity-60 animate-pulse"></div>

      <div className="relative z-10 flex flex-col h-full justify-between">
        
        {/* Top Section */}
        <div className="flex justify-between items-start">
          <div className="text-white font-['Space_Grotesk'] font-black text-2xl tracking-tighter">
            NANDGUARD <span className="text-[#FF4D4D]">X1</span>
          </div>
          <span 
            className="text-[#E63946] material-symbols-outlined text-3xl animate-pulse" 
            style={{ fontVariationSettings: "'FILL' 1", animationDuration: '3s' }}
          >
            memory
          </span>
        </div>

        {/* Status Bar with Animation */}
        <div className="space-y-5">
          <div className="h-1 bg-[#1A0000] w-full overflow-hidden rounded-full relative">
            {/* Progress Bar */}
            <div 
              className="h-full bg-gradient-to-r from-[#E63946] to-[#FF4D4D] rounded-full 
                         animate-[loading_4s_linear_infinite]"
              style={{
                width: '68%',
              }}
            ></div>
            
            {/* Moving Scan Line */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent 
                            animate-[scan_2.5s_linear_infinite]"></div>
          </div>

          {/* Status Text */}
          <div className="font-mono text-xs text-[#A0A0A0] tracking-wider">
            SYSTEM_STATUS: <span className="text-[#FF4D4D]">MONITORING</span>...<br />
            OFFSET_ADDR: <span className="text-[#E63946]">0x4F22B1</span>...
          </div>
        </div>
      </div>

      {/* Bottom Red Glow Accent */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#E63946]/20 to-transparent pointer-events-none"></div>
    </div>
  );
}