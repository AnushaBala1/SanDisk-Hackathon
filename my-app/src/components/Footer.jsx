export default function Footer() {
  return (
    <footer className="w-full py-16 px-8 bg-[#080808] border-t border-[#E63946]">
      <div className="container mx-auto max-w-7xl">
        
        <div className="flex flex-col items-center justify-center text-center">
          
          {/* Minimal centered branding */}
        <div className="flex items-center gap-3 text-white font-['Space_Grotesk'] font-bold text-2xl tracking-tighter cursor-pointer">
          <span 
            className="text-[#E63946] material-symbols-outlined text-3xl" 
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            security
          </span>
          NANDGuard
        </div>


          {/* Bottom text */}
          <div className="space-y-3">
            <p className="text-gray-500 text-sm tracking-tight">
              SanDisk Hackathon · PSG Institute of Technology and Applied Research · 2026
            </p>
            <p className="text-[#A0A0A0] text-xs font-mono">
              © 2026 NANDGuard Intelligence Systems. All Rights Reserved.
            </p>
          </div>
        </div>

      </div>
    </footer>
  );
}