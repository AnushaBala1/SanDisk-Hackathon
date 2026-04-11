import { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import ProblemSection from './components/ProblemSection';
import SolutionSection from './components/SolutionSection';
import CTABanner from './components/CTABanner';
import Footer from './components/Footer';
import SimulationPage from './components/SimulationPage';
import AlgorithmPage from './components/Algorithmpage';
import UartTerminal from './components/UartTerminal';  // ← add this

function App() {
  const [currentPage, setCurrentPage] = useState('home');

  const handleNavigate = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="bg-[#080808] text-white overflow-x-hidden">
      <Navbar currentPage={currentPage} onNavigate={handleNavigate} />

      {currentPage === 'home' && (
        <>
          <Hero onSimulationClick={() => handleNavigate('simulation')} />
          <ProblemSection />
          <SolutionSection />
          <CTABanner
            onSimulationClick={() => handleNavigate('simulation')}
            onAlgorithmsClick={() => handleNavigate('algorithms')}
          />
          <Footer />
        </>
      )}

      {currentPage === 'simulation' && (
        <>
          <SimulationPage />
          <Footer />
        </>
      )}

      {currentPage === 'algorithms' && (
        <>
          <AlgorithmPage />
          <Footer />
        </>
      )}

      {currentPage === 'uart' && (   // ← add this block
        <UartTerminal />
        // No Footer here — UartTerminal is full viewport height (100vh)
      )}
    </div>
  );
}

export default App;