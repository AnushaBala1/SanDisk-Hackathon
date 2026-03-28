export default function Navbar({ currentPage, onNavigate }) {
  return (
    <nav className="fixed top-0 w-full z-50 h-16 bg-[#080808] border-b border-[#E63946] flex items-center px-8">
      <div className="flex justify-between items-center w-full max-w-7xl mx-auto">

        {/* Logo */}
        <div
          className="flex items-center gap-3 text-white font-['Space_Grotesk'] font-bold text-2xl tracking-tighter cursor-pointer"
          onClick={() => onNavigate('home')}
        >
          <span
            className="text-[#E63946] material-symbols-outlined text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            security
          </span>
          NANDGuard
        </div>

        {/* Centered Navigation */}
        <div className="hidden md:flex items-center gap-10 absolute left-1/2 -translate-x-1/2 text-sm font-medium">
          <button
            onClick={() => onNavigate('home')}
            className={`font-['Space_Grotesk'] tracking-tight transition-colors ${
              currentPage === 'home'
                ? 'text-white border-b-2 border-[#E63946] pb-1'
                : 'text-[#A0A0A0] hover:text-white'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => onNavigate('simulation')}
            className={`font-['Space_Grotesk'] tracking-tight transition-colors ${
              currentPage === 'simulation'
                ? 'text-white border-b-2 border-[#E63946] pb-1'
                : 'text-[#A0A0A0] hover:text-white'
            }`}
          >
            Simulation
          </button>
          <button
            onClick={() => onNavigate('algorithms')}
            className={`font-['Space_Grotesk'] tracking-tight transition-colors ${
              currentPage === 'algorithms'
                ? 'text-white border-b-2 border-[#E63946] pb-1'
                : 'text-[#A0A0A0] hover:text-white'
            }`}
          >
            Algorithms
          </button>
          <a href="#" className="text-[#A0A0A0] hover:text-white transition-colors font-['Space_Grotesk'] tracking-tight">Tech Stack</a>
          <a href="#" className="text-[#A0A0A0] hover:text-white transition-colors font-['Space_Grotesk'] tracking-tight">Team</a>
        </div>

        <div className="w-10 md:hidden"></div>
      </div>
    </nav>
  );
}