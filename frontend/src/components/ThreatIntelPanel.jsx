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
    <div className="flex h-full gap-4 min-h-[500px]">
      
      {/* ACTOR PROFILE (Left) */}
      <div className="w-1/3 bg-[#0a0e1a] rounded-lg border-2 border-slate-800 shadow-xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-800 bg-slate-900/80">
          <h2 className="text-sm font-bold text-slate-300 tracking-widest flex items-center gap-2">
            <Target className="w-4 h-4 text-red-500" />
            ACTOR PROFILE
          </h2>
        </div>
        
        <div className="p-6 flex-1 flex flex-col items-center">
          <div className="relative w-32 h-32 mb-6">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="8" />
              <circle cx="50" cy="50" r="45" fill="none" stroke={confidencePct > 70 ? '#ef4444' : '#f59e0b'} strokeWidth="8" 
                      strokeDasharray="283" strokeDashoffset={283 - (283 * confidencePct) / 100} 
                      strokeLinecap="round" className="transition-all duration-1000 ease-out" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-white">{confidencePct}%</span>
              <span className="text-[9px] text-slate-400 tracking-widest">CONFIDENCE</span>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-red-500 mb-2">{actor.actor_name}</h1>
          <div className="flex items-center gap-2 mb-6 text-sm text-slate-400">
            <span className="text-xl">🇨🇳</span> 
            <span>China (State-Sponsored)</span>
          </div>

          <div className="w-full space-y-4">
            <div>
              <div className="text-[10px] text-slate-500 tracking-widest mb-1">KNOWN ALIASES</div>
              <div className="text-sm text-slate-300">Barium, Winnti Group, BRONZE ATLAS</div>
            </div>
            
            <div>
              <div className="text-[10px] text-slate-500 tracking-widest mb-1">TARGET SECTORS</div>
              <div className="flex flex-wrap gap-2">
                <span className="bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded">Healthcare</span>
                <span className="bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded">Government</span>
                <span className="bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded">Education</span>
              </div>
            </div>

            {actor.campaign_match && (
              <div className="mt-4 bg-cyan-900/20 border border-cyan-800 rounded p-3">
                <div className="text-[10px] text-cyan-500 tracking-widest mb-1">CAMPAIGN MATCH</div>
                <div className="text-cyan-300 text-sm font-bold">{actor.campaign_match}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PREDICTED NEXT MOVES (Center) */}
      <div className="w-1/3 bg-[#0a0e1a] rounded-lg border-2 border-slate-800 shadow-xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-800 bg-slate-900/80">
          <h2 className="text-sm font-bold text-slate-300 tracking-widest flex items-center gap-2">
            <Search className="w-4 h-4 text-amber-500" />
            PREDICTED NEXT MOVES
          </h2>
        </div>
        
        <div className="p-4 flex-1 bg-gradient-to-b from-amber-900/10 to-transparent">
          <h3 className="text-amber-500 font-bold text-sm tracking-widest mb-4">PREPARE FOR:</h3>
          
          <div className="space-y-4">
            {actor.predicted_next_ttps?.map((ttp, idx) => {
              // Handle both string array or object array from API
              const isObj = typeof ttp === 'object';
              const id = isObj ? ttp.id : ttp;
              const name = isObj ? ttp.name : 'Unknown Technique';
              const prob = isObj ? ttp.probability : 0.9 - (idx * 0.1);
              const action = isObj ? ttp.defensive_action : 'Implement monitoring and blocking for this TTP.';
              
              return (
                <div key={id} className="bg-slate-900 border border-slate-700 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-cyan-400 font-mono text-xs">{id}</span>
                      <h4 className="text-slate-200 text-sm font-bold">{name}</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">PROBABILITY</span>
                      <span className="text-amber-400 font-bold">{Math.round(prob * 100)}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full mb-3">
                    <div className="bg-amber-500 h-1 rounded-full" style={{ width: `${prob * 100}%` }} />
                  </div>
                  <div className="text-xs text-slate-400 border-t border-slate-800 pt-2">
                    <span className="text-cyan-500 font-bold mb-1 block">RECOMMENDATION:</span>
                    {action}
                  </div>
                </div>
              );
            })}
            
            {(!actor.predicted_next_ttps || actor.predicted_next_ttps.length === 0) && (
              <div className="text-slate-500 text-sm text-center py-10">No predictions available.</div>
            )}
          </div>
        </div>
      </div>

      {/* CERT-IN ADVISORIES (Right) */}
      <div className="w-1/3 bg-[#0a0e1a] rounded-lg border-2 border-slate-800 shadow-xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-800 bg-slate-900/80">
          <h2 className="text-sm font-bold text-slate-300 tracking-widest flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-cyan-500" />
            CERT-IN ADVISORIES
          </h2>
        </div>
        
        <div className="p-4 flex-1">
          <div className="space-y-3">
            {advisories.map(adv => (
              <div key={adv.id} className="bg-slate-900 border border-slate-700 hover:border-slate-500 transition-colors rounded-lg p-4 cursor-pointer group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-cyan-400 font-mono text-sm font-bold">{adv.id}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${adv.score === 'HIGH' ? 'bg-red-900/50 text-red-400 border border-red-800' : 'bg-amber-900/50 text-amber-400 border border-amber-800'}`}>
                    OVERLAP: {adv.score}
                  </span>
                </div>
                <h4 className="text-slate-200 text-sm mb-3">{adv.title}</h4>
                
                <div className="text-[10px] text-slate-500 mb-3">
                  <span className="block mb-1 tracking-widest">MATCHING IOCs:</span>
                  <div className="flex flex-wrap gap-1">
                    <span className="bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded border border-red-900/50 font-mono">185.220.101.47</span>
                    <span className="bg-amber-900/30 text-amber-400 px-1.5 py-0.5 rounded border border-amber-900/50 font-mono">7z.exe staging</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center text-xs text-slate-500 border-t border-slate-800 pt-3">
                  <span>Issued: {adv.date}</span>
                  <span className="flex items-center gap-1 group-hover:text-cyan-400 transition-colors">
                    View Details <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 bg-blue-900/20 border border-blue-900 p-3 rounded text-xs text-blue-300">
            <strong>Compliance Note:</strong> Under IT Act Section 70B, incidents matching these indicators must be reported to CERT-In within 6 hours of discovery.
          </div>
        </div>
      </div>

    </div>
  );
}
