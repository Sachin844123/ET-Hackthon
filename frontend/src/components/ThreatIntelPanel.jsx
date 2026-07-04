import React from 'react';
import { Target, Search, AlertTriangle, ExternalLink } from 'lucide-react';

export default function ThreatIntelPanel({ actor_attribution, predicted_ttps = [] }) {
  const actor = actor_attribution || {
    actor_name: 'Unknown Actor',
    confidence: 0,
    campaign_match: null,
    predicted_next_ttps: []
  };

  const confidencePct = Math.round((actor.confidence || 0) * 100);
  
  // Dummy data for CERT-In advisories for demo
  const advisories = [
    { id: 'CIAD-2022-0041', date: '2022-11-23', score: 'HIGH', title: 'Ransomware attacks on Healthcare Sector' },
    { id: 'CIAD-2022-0038', date: '2022-10-15', score: 'MEDIUM', title: 'Active exploitation by APT41' }
  ];

  return (
    <div className="flex h-full gap-4 min-h-[500px] animate-fade-in-up">
      
      {/* ACTOR PROFILE (Left) */}
      <div className="w-1/3 cyber-card overflow-hidden flex flex-col bg-[#0a0e1a]/85 backdrop-blur-sm">
        <div className="p-4 border-b border-slate-800 bg-slate-900/60">
          <h2 className="text-xs font-bold text-slate-300 tracking-widest flex items-center gap-2 font-mono">
            <Target className="w-4 h-4 text-red-500" />
            ACTOR ATTRIBUTION
          </h2>
        </div>
        
        <div className="p-6 flex-1 flex flex-col items-center">
          <div className="relative w-32 h-32 mb-6">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="6" />
              <circle cx="50" cy="50" r="45" fill="none" stroke={confidencePct > 70 ? '#ef4444' : '#f59e0b'} strokeWidth="6" 
                      strokeDasharray="283" strokeDashoffset={283 - (283 * confidencePct) / 100} 
                      strokeLinecap="round" className="transition-all duration-1000 ease-out" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
              <span className="text-2xl font-bold text-white">{confidencePct}%</span>
              <span className="text-[8px] text-slate-500 tracking-widest uppercase">MATCH VALUE</span>
            </div>
          </div>

          <h1 className="text-2xl font-extrabold text-red-500 mb-1 tracking-wide font-mono neon-glow-text-red">{actor.actor_name}</h1>
          <div className="flex items-center gap-2 mb-6 text-xs text-slate-400 font-mono uppercase">
            <span className="text-lg">🇨🇳</span> 
            <span>China (State-Sponsored)</span>
          </div>

          <div className="w-full space-y-4 font-mono text-xs">
            <div>
              <div className="text-[9px] text-slate-500 tracking-widest mb-1.5 uppercase font-bold">KNOWN ALIASES</div>
              <div className="text-slate-300 leading-normal">Barium, Winnti Group, BRONZE ATLAS, APT41</div>
            </div>
            
            <div>
              <div className="text-[9px] text-slate-500 tracking-widest mb-1.5 uppercase font-bold">TARGET SECTORS</div>
              <div className="flex flex-wrap gap-1.5">
                <span className="bg-slate-900 border border-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded">Healthcare</span>
                <span className="bg-slate-900 border border-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded">Government</span>
                <span className="bg-slate-900 border border-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded">Education</span>
              </div>
            </div>

            {actor.campaign_match && (
              <div className="mt-4 bg-cyan-950/20 border border-cyan-800/40 rounded p-3 shadow-lg">
                <div className="text-[9px] text-cyan-400 tracking-widest mb-1 uppercase font-bold">CAMPAIGN MATCH</div>
                <div className="text-cyan-300 text-xs font-bold leading-tight">{actor.campaign_match}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PREDICTED NEXT MOVES (Center) */}
      <div className="w-1/3 cyber-card overflow-hidden flex flex-col bg-[#0a0e1a]/85 backdrop-blur-sm">
        <div className="p-4 border-b border-slate-800 bg-slate-900/60">
          <h2 className="text-xs font-bold text-slate-300 tracking-widest flex items-center gap-2 font-mono">
            <Search className="w-4 h-4 text-amber-500" />
            PREDICTED TTP FORECAST
          </h2>
        </div>
        
        <div className="p-4 flex-1 bg-gradient-to-b from-amber-950/5 to-transparent">
          <h3 className="text-amber-500 font-bold text-[10px] tracking-widest mb-4 font-mono uppercase">NEXT PROBABLE TARGETS</h3>
          
          <div className="space-y-4">
            {actor.predicted_next_ttps?.map((ttp, idx) => {
              const isObj = typeof ttp === 'object';
              const id = isObj ? ttp.id : ttp;
              const name = isObj ? ttp.name : 'Unknown Technique';
              const prob = isObj ? ttp.probability : 0.9 - (idx * 0.1);
              const action = isObj ? ttp.defensive_action : 'Implement monitoring and blocking for this TTP.';
              
              return (
                <div key={id} className="cyber-card p-3 bg-slate-950/60">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-cyan-400 font-mono text-[10px] font-bold">{id}</span>
                      <h4 className="text-slate-200 text-xs font-bold font-mono leading-tight">{name}</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] text-slate-500 block font-mono">PROBABILITY</span>
                      <span className="text-amber-400 font-bold font-mono text-xs">{Math.round(prob * 100)}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full mb-3 overflow-hidden">
                    <div className="bg-amber-500 h-1 rounded-full" style={{ width: `${prob * 100}%` }} />
                  </div>
                  <div className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 font-mono leading-relaxed">
                    <span className="text-cyan-400 font-bold mb-1 block uppercase text-[9px] tracking-wider">DEFENSIVE RESPONSE:</span>
                    {action}
                  </div>
                </div>
              );
            })}
            
            {(!actor.predicted_next_ttps || actor.predicted_next_ttps.length === 0) && (
              <div className="text-slate-500 text-xs text-center py-10 font-mono">No predictions available.</div>
            )}
          </div>
        </div>
      </div>

      {/* CERT-IN ADVISORIES (Right) */}
      <div className="w-1/3 cyber-card overflow-hidden flex flex-col bg-[#0a0e1a]/85 backdrop-blur-sm">
        <div className="p-4 border-b border-slate-800 bg-slate-900/60">
          <h2 className="text-xs font-bold text-slate-300 tracking-widest flex items-center gap-2 font-mono">
            <AlertTriangle className="w-4 h-4 text-cyan-400 animate-pulse" />
            CERT-IN DIRECTIVES
          </h2>
        </div>
        
        <div className="p-4 flex-1">
          <div className="space-y-3">
            {advisories.map(adv => (
              <div key={adv.id} className="cyber-card p-4 cursor-pointer group bg-slate-950/40">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-cyan-400 font-mono text-xs font-bold">{adv.id}</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded font-bold font-mono border ${adv.score === 'HIGH' ? 'bg-red-950/50 text-red-400 border-red-900/50 shadow-[0_0_8px_rgba(239,68,68,0.1)]' : 'bg-amber-950/50 text-amber-400 border-amber-900/50'}`}>
                    OVERLAP: {adv.score}
                  </span>
                </div>
                <h4 className="text-slate-300 text-xs mb-3 font-semibold leading-relaxed">{adv.title}</h4>
                
                <div className="text-[9px] text-slate-500 mb-3 font-mono leading-relaxed">
                  <span className="block mb-1 tracking-widest uppercase font-bold">MATCHING IOC DETAILS:</span>
                  <div className="flex flex-wrap gap-1">
                    <span className="bg-red-950/30 text-red-400 px-1.5 py-0.5 rounded border border-red-900/50 font-mono text-[9px]">185.220.101.47</span>
                    <span className="bg-amber-950/30 text-amber-400 px-1.5 py-0.5 rounded border border-amber-900/50 font-mono text-[9px]">7z.exe staging</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-900 pt-3 font-mono">
                  <span>DATE: {adv.date}</span>
                  <span className="flex items-center gap-1 group-hover:text-cyan-400 transition-colors font-bold uppercase text-[9px] tracking-wider">
                    READ DIRECTIVE <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 bg-cyan-950/30 border border-cyan-800/40 p-4 rounded text-[11px] font-mono text-cyan-300 leading-relaxed">
            <strong>IT Act Section 70B Directive:</strong> Mandatory compliance. Incident indicators listed above require active reporting to CERT-In team within 6 hours of simulation detection.
          </div>
        </div>
      </div>

    </div>
  );
}
