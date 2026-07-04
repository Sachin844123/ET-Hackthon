import React, { useEffect, useState } from 'react';

const PHASES = [
  'Initial Access', 'Execution', 'Persistence', 'Privilege Escalation',
  'Defense Evasion', 'Lateral Movement', 'Collection', 'Command and Control', 'Impact'
];

export default function AttackChainTimeline({ autopsy_result }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const ttps = autopsy_result?.ttp_attributions || [];
  const alerts = autopsy_result?.retroactive_alerts || [];
  
  // Group TTPs by phase
  const ttpsByPhase = {};
  PHASES.forEach(p => { ttpsByPhase[p] = []; });
  
  ttps.forEach(ttp => {
    // Basic mapping logic, fallback to C2 or similar if phase not found
    const phaseMatch = PHASES.find(p => ttp.tactic?.toLowerCase().includes(p.toLowerCase()));
    const phaseKey = phaseMatch || 'Command and Control'; // fallback
    if (ttpsByPhase[phaseKey]) {
      ttpsByPhase[phaseKey].push(ttp);
    }
  });

  const getAlertForPhase = (phaseName) => {
    // Heuristic: map alerts to phases based on MITRE tactic
    const matchingTtp = ttps.find(t => t.tactic?.toLowerCase().includes(phaseName.toLowerCase()));
    if (matchingTtp) {
      return alerts.find(a => a.mitre_technique_id === matchingTtp.technique_id);
    }
    return null;
  };

  const earliestAlert = alerts.length > 0 
    ? alerts.reduce((max, a) => (a.days_before_incident > max.days_before_incident ? a : max), alerts[0])
    : null;
    
  return (
    <div className="bg-[#0a0e1a] text-slate-300 p-6 rounded-lg border-2 border-slate-800 shadow-xl overflow-x-auto relative min-h-[400px]">
      
      {/* Top Banner */}
      <div className="flex justify-center mb-8">
        <div className="border-2 border-slate-700 bg-slate-900 px-6 py-2 rounded-full shadow-lg shadow-black/50 text-sm tracking-widest font-bold">
          <span className="text-slate-400">ATTRIBUTED: </span>
          <span className="text-red-500">APT41 </span>
          <span className="text-slate-500">| CONFIDENCE: </span>
          <span className="text-amber-500">84% </span>
          <span className="text-slate-500">| CAMPAIGN MATCH: </span>
          <span className="text-cyan-400">OPERATION DARK WARD</span>
        </div>
      </div>

      <div className="flex relative mt-16 pb-20 min-w-max">
        
        {/* Horizontal connective line */}
        <div className="absolute top-[120px] left-0 w-full h-1 bg-slate-800 z-0" />
        
        {/* Prevention Window Indicator */}
        <div className="absolute top-[80px] h-[80px] bg-green-900/20 border-t-2 border-green-500/50 z-0 flex items-start pt-2 px-2 transition-all duration-1000"
             style={{ 
               left: '5%', 
               width: '80%', 
               opacity: mounted ? 1 : 0 
             }}>
          <span className="text-green-400 text-xs font-bold tracking-wider flex items-center gap-1 bg-[#0a0e1a] px-2 py-1 rounded">
             ✓ 19-DAY PREVENTION WINDOW
          </span>
        </div>

        {PHASES.map((phase, idx) => {
          const phaseTTPs = ttpsByPhase[phase];
          const phaseAlert = getAlertForPhase(phase);
          const isImpact = phase === 'Impact';
          
          return (
            <div key={phase} className="flex-1 min-w-[200px] flex flex-col items-center relative z-10"
                 style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)', transition: `all 400ms ease-out ${idx * 150}ms` }}>
              
              {/* Alert Badge (if any) */}
              <div className="h-16 flex items-end justify-center mb-4 w-full">
                {phaseAlert && (
                  <div className="group relative flex flex-col items-center cursor-pointer hover:-translate-y-1 transition-transform">
                    <div className="bg-blue-900/40 border border-blue-500 text-blue-400 text-[10px] font-bold px-2 py-1 rounded-full mb-1 flex items-center gap-1 shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                      ⚡ ALERT
                    </div>
                    <div className="text-xs text-blue-300 font-mono text-center">
                      {phaseAlert.time_before_incident}<br/>
                      {Math.round(phaseAlert.confidence * 100)}% Conf
                    </div>
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 w-64 bg-slate-900 border-2 border-slate-700 p-3 rounded shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 text-left">
                      <p className="text-slate-200 text-xs">{phaseAlert.description}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Phase Header */}
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-4 h-8 text-center px-2">
                {phase.replace('Privilege Escalation', 'Priv Esc').replace('Command and Control', 'C2')}
              </div>

              {/* Node connecting point */}
              <div className="w-4 h-4 rounded-full bg-slate-900 border-2 border-slate-600 mb-6 relative z-10" />

              {/* TTP Cards */}
              <div className="flex flex-col gap-3 w-11/12">
                {phaseTTPs.map(ttp => (
                  <div key={ttp.technique_id} className={`bg-slate-900 p-3 rounded border-l-4 shadow-lg ${ttp.confidence > 0.8 ? 'border-red-500' : 'border-amber-500'}`}>
                    <div className="font-mono text-xs text-cyan-400 mb-1">{ttp.technique_id}</div>
                    <div className="text-xs text-slate-200 font-medium leading-tight mb-2">
                      {ttp.technique_name}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] text-slate-500 uppercase">Confidence</span>
                      <span className={`text-[10px] font-bold ${ttp.confidence > 0.8 ? 'text-red-400' : 'text-amber-400'}`}>
                        {Math.round(ttp.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Impact specific UI */}
              {isImpact && (
                <>
                  <div className="absolute top-0 bottom-0 left-1/2 border-l-2 border-dashed border-red-500/50 -z-10" />
                  <div className="absolute top-[90px] bg-[#0a0e1a] border-2 border-red-500 text-red-500 text-xs font-bold px-3 py-1 rounded shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    RANSOMWARE DEPLOYED
                  </div>
                  <div className="absolute bottom-4 text-[10px] text-red-400/80 font-bold tracking-widest text-center bg-[#0a0e1a] px-2">
                    T-0 | ACTUAL DISCOVERY
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Bottom Axis */}
      <div className="absolute bottom-4 left-0 w-full px-12 flex justify-between text-slate-600 font-mono text-[10px]">
        <span>Day 1 (T-21)</span>
        <span>Day 7 (T-15)</span>
        <span>Day 14 (T-8)</span>
        <span className="text-red-500/80">Day 22 (T-0)</span>
      </div>
    </div>
  );
}
