import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowRight } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col relative overflow-hidden font-sans">
      
      {/* Background Grid */}
      <div 
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #1e293b 1px, transparent 1px),
            linear-gradient(to bottom, #1e293b 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent to-[#0a0e1a] pointer-events-none" />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-red-500" />
          <h1 className="text-white font-bold tracking-widest text-xl">ATTACK CHAIN <span className="text-red-500">AUTOPSY</span></h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        
        {/* LIVE Badge */}
        <div className="mb-8 bg-red-900/20 border border-red-500/50 text-red-500 text-xs font-bold px-3 py-1 rounded-full tracking-widest flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          LIVE DEMO ENVIRONMENT
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-none mb-6">
          ATTACK CHAIN<br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500">AUTOPSY</span>
        </h1>

        <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mb-16 leading-relaxed">
          Attackers were inside AIIMS Delhi for 22 days.<br/>
          <span className="text-slate-200">Our engine would have caught them on Day 3.</span>
        </p>

        {/* Metrics */}
        <div className="flex flex-wrap justify-center gap-8 mb-16">
          <div className="flex flex-col items-center">
            <div className="font-mono text-3xl font-bold text-cyan-400 mb-1">T-21 DAYS</div>
            <div className="text-xs text-slate-500 tracking-widest font-bold">EARLIEST SIGNAL</div>
          </div>
          <div className="w-px h-12 bg-slate-800 hidden md:block" />
          <div className="flex flex-col items-center">
            <div className="font-mono text-3xl font-bold text-amber-500 mb-1">T-19 DAYS</div>
            <div className="text-xs text-slate-500 tracking-widest font-bold">HIGH CONFIDENCE</div>
          </div>
          <div className="w-px h-12 bg-slate-800 hidden md:block" />
          <div className="flex flex-col items-center">
            <div className="font-mono text-3xl font-bold text-green-500 mb-1">19 DAYS</div>
            <div className="text-xs text-slate-500 tracking-widest font-bold">PREVENTION WINDOW</div>
          </div>
        </div>

        {/* CTA */}
        <button 
          onClick={() => navigate('/demo')}
          className="group relative bg-red-600 hover:bg-red-500 text-white font-bold text-xl px-12 py-5 rounded-lg shadow-[0_0_30px_rgba(220,38,38,0.4)] transition-all flex items-center gap-3 overflow-hidden"
        >
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
          RUN ATTACK CHAIN AUTOPSY <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </button>

      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-xs text-slate-500 tracking-widest">
        Built for ET AI Hackathon 2026 <span className="mx-2 text-slate-700">|</span> Problem Statement 7 <span className="mx-2 text-slate-700">|</span> AI-Powered Cyber Resilience for CNI
      </footer>

    </div>
  );
}
