import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowRight } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col relative overflow-hidden font-sans cyber-grid-bg">
      
      {/* Visual background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-red-950/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-950/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between p-6 max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-red-500 filter drop-shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse" />
          <h1 className="text-white font-bold tracking-widest text-xl">ATTACK CHAIN <span className="text-red-500 neon-glow-text-red">AUTOPSY</span></h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center max-w-4xl mx-auto">
        
        {/* LIVE Badge */}
        <div className="mb-8 bg-red-950/40 border border-red-500/50 text-red-400 text-xs font-bold px-4 py-1.5 rounded-full tracking-widest flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.25)] animate-pulse">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          CNI CYBER RESILIENCE SUITE
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-none mb-6">
          ATTACK CHAIN<br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-amber-500 to-cyan-400 neon-glow-text-red">AUTOPSY</span>
        </h1>

        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-12 leading-relaxed">
          Attackers remained undetected inside AIIMS Delhi for 22 days.<br/>
          <span className="text-slate-200 font-semibold neon-glow-text-cyan">Our autonomous engine reconstructs and containment-proves it on Day 3.</span>
        </p>

        {/* Metrics Row (Next-Level Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-16 max-w-3xl">
          <div className="cyber-card p-6">
            <div className="font-mono text-3xl font-bold text-cyan-400 mb-1 neon-glow-text-cyan">T-21 DAYS</div>
            <div className="text-xs text-slate-500 tracking-widest font-bold">EARLIEST SIGNAL</div>
          </div>
          
          <div className="cyber-card p-6 border-amber-500/20">
            <div className="font-mono text-3xl font-bold text-amber-400 mb-1 neon-glow-text-amber">T-19 DAYS</div>
            <div className="text-xs text-slate-500 tracking-widest font-bold">HIGH CONFIDENCE</div>
          </div>
          
          <div className="cyber-card p-6 border-green-500/20">
            <div className="font-mono text-3xl font-bold text-green-400 mb-1">19 DAYS</div>
            <div className="text-xs text-slate-500 tracking-widest font-bold">PREVENTION WINDOW</div>
          </div>
        </div>

        {/* CTA */}
        <button 
          onClick={() => navigate('/demo')}
          className="cyber-button text-white font-bold text-xl px-12 py-5 rounded-lg flex items-center gap-3 transition-transform duration-300 hover:scale-105 active:scale-95"
        >
          RUN DEMO AUTOPSY <ArrowRight className="w-6 h-6" />
        </button>

      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-[10px] md:text-xs text-slate-500 tracking-widest border-t border-slate-900 w-full max-w-7xl mx-auto">
        Built for ET AI Hackathon 2026 <span className="mx-2 text-slate-800">|</span> Problem Statement 7 <span className="mx-2 text-slate-800">|</span> AI-Powered Cyber Resilience for CNI
      </footer>

    </div>
  );
}
