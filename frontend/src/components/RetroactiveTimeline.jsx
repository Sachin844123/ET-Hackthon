import React, { useEffect, useState } from 'react';

export default function RetroactiveTimeline({ alerts = [], incident_date }) {
  const [mounted, setMounted] = useState(false);
  const [expandedAlerts, setExpandedAlerts] = useState({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleExpand = (id) => {
    setExpandedAlerts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getConfidenceColor = (conf) => {
    if (conf >= 0.95) return 'bg-red-600 animate-pulse';
    if (conf >= 0.85) return 'bg-red-500';
    if (conf >= 0.75) return 'bg-orange-500';
    return 'bg-amber-500';
  };

  // Sort by days_before_incident descending (earliest first)
  const sortedAlerts = [...alerts].sort((a, b) => b.days_before_incident - a.days_before_incident);

  const preventionAlerts = sortedAlerts.filter(a => a.would_have_prevented_breach);
  const earliestDetect = sortedAlerts.length > 0 ? sortedAlerts[0] : null;
  const highConfAlert = sortedAlerts.find(a => a.confidence >= 0.8) || earliestDetect;
  const lastContainment = preventionAlerts.length > 0 ? preventionAlerts[preventionAlerts.length - 1] : earliestDetect;

  return (
    <div className="cyber-card text-slate-300 p-6 max-w-4xl mx-auto bg-[#0a0e1a]/85 backdrop-blur-sm animate-fade-in-up">
      <h2 className="text-lg font-bold text-white mb-8 tracking-widest border-b border-slate-800 pb-3 font-mono">RETROACTIVE DETECTION TIMELINE</h2>
      
      <div className="relative pl-12 border-l-2 border-slate-850 pb-12">
        {sortedAlerts.map((alert, idx) => (
          <div key={alert.alert_id} 
               className="mb-10 relative"
               style={{ 
                 opacity: mounted ? 1 : 0, 
                 transform: mounted ? 'translateX(0)' : 'translateX(-30px)', 
                 transition: `all 500ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 200}ms` 
               }}>
            
            {/* Timeline Dot */}
            <div className={`absolute -left-[57px] top-1 w-5 h-5 rounded-full border-4 border-[#0a0e1a] transition-all ${alert.would_have_prevented_breach ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'}`} />
            
            {/* Timestamp Badge */}
            <div className="absolute -left-36 top-1 text-right w-24">
              <div className="font-mono text-xs text-slate-300 font-bold">DAY {22 - alert.days_before_incident}</div>
              <div className="font-mono text-[9px] text-cyan-400 tracking-widest uppercase">{alert.time_before_incident}</div>
            </div>

            {/* Card */}
            <div className="cyber-card overflow-hidden">
              
              {/* Top Bar */}
              <div className="bg-slate-900/60 px-4 py-2.5 border-b border-slate-800/80 flex justify-between items-center">
                <div className="flex gap-2">
                  <span className="bg-cyan-950/60 text-cyan-400 text-[10px] px-2 py-0.5 rounded font-mono border border-cyan-800/50">{alert.mitre_technique_id}</span>
                  <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded font-mono border border-slate-700/50">{alert.alert_type}</span>
                </div>
                <div className="flex items-center gap-2 w-32">
                  <span className="text-[9px] text-slate-500 font-mono tracking-wider font-semibold">CONFIDENCE</span>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${getConfidenceColor(alert.confidence)}`} style={{ width: `${alert.confidence * 100}%` }} />
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-4">
                <p className="text-xs text-slate-300 leading-relaxed mb-4">{alert.description}</p>
                
                {/* Evidence Dropdown */}
                <div className="mb-4">
                  <button onClick={() => toggleExpand(alert.alert_id)} className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold font-mono flex items-center gap-1 focus:outline-none transition-colors">
                    {expandedAlerts[alert.alert_id] ? '▼ HIDE EVIDENCE' : '▶ SHOW EVIDENCE'} ({alert.evidence?.length || 0})
                  </button>
                  {expandedAlerts[alert.alert_id] && (
                    <div className="mt-2 bg-[#05070f] p-3 rounded border border-slate-900 text-[11px] font-mono text-slate-400 space-y-1.5 leading-relaxed">
                      {alert.evidence?.map((ev, i) => <div key={i}>• {ev}</div>)}
                    </div>
                  )}
                </div>

                {/* Recommended Action Box */}
                <div className="bg-cyan-950/20 border-l-4 border-cyan-500/80 p-4 rounded text-xs text-slate-200 leading-relaxed font-mono">
                  <span className="font-bold text-cyan-400 block mb-1.5 tracking-wider">RECOMMENDED ACTION:</span>
                  {alert.recommended_action}
                </div>
              </div>

              {/* Footer */}
              <div className={`px-4 py-2 text-[9px] font-bold tracking-widest font-mono uppercase ${alert.would_have_prevented_breach ? 'bg-green-950/30 text-green-400' : 'bg-red-950/30 text-red-400'}`}>
                {alert.would_have_prevented_breach ? '✓ BREACH PREVENTABLE AT THIS STAGE' : '⚠ DATA EXFILTRATION IMMINENT'}
              </div>
            </div>
          </div>
        ))}

        {/* Ransomware Deployed Marker */}
        <div className="relative mt-8" style={{ opacity: mounted ? 1 : 0, transition: 'opacity 1s ease-out 1.2s' }}>
          <div className="absolute -left-[57px] top-1 w-5 h-5 rounded-full border-4 border-[#0a0e1a] bg-red-600 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
          <div className="absolute -left-[45px] top-7 bottom-0 w-0.5 border-l-2 border-dashed border-red-500/20" />
          <div className="cyber-card-red p-4 text-center ml-2">
            <h3 className="text-red-500 font-bold tracking-widest uppercase mb-1 text-xs font-mono">Ransomware Deployed — Actual Discovery</h3>
            <div className="font-mono text-slate-400 text-[10px]">Day 22 (T-0) | The point where legacy signature tools finally alerted</div>
          </div>
        </div>
      </div>

      {/* Summary Box */}
      <div className="mt-12 cyber-card p-6 max-w-lg mx-auto shadow-2xl relative overflow-hidden border-2 border-slate-700">
        <div className="absolute top-0 left-0 w-2.5 h-full bg-gradient-to-b from-cyan-500 to-amber-500" />
        <h3 className="text-white text-xs font-bold tracking-widest mb-4 font-mono">RECONSTRUCTION SUMMARY</h3>
        <div className="space-y-3 font-mono text-xs">
          <div className="flex justify-between border-b border-slate-800/60 pb-2">
            <span className="text-slate-400">EARLIEST DETECTABLE SIGNAL</span>
            <span className="text-cyan-400 font-bold neon-glow-text-cyan">T-{earliestDetect?.days_before_incident || 0} DAYS</span>
          </div>
          <div className="flex justify-between border-b border-slate-800/60 pb-2">
            <span className="text-slate-400">HIGH-CONFIDENCE ALERT</span>
            <span className="text-amber-400 font-bold neon-glow-text-amber">T-{highConfAlert?.days_before_incident || 0} DAYS</span>
          </div>
          <div className="flex justify-between border-b border-slate-800/60 pb-2">
            <span className="text-slate-400">LAST CONTAINMENT WINDOW</span>
            <span className="text-orange-400 font-bold">T-{lastContainment?.days_before_incident || 0} DAYS</span>
          </div>
          <div className="flex justify-between border-b border-slate-800/60 pb-2">
            <span className="text-slate-400">ACTUAL HISTORICAL DISCOVERY</span>
            <span className="text-red-500 font-bold neon-glow-text-red font-bold">T-0</span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-white font-bold tracking-wider">PREVENTION WINDOW</span>
            <span className="text-green-400 font-bold bg-green-950/40 px-2 py-0.5 rounded border border-green-800/50">{(earliestDetect?.days_before_incident || 0)} DAYS SAVED</span>
          </div>
        </div>
      </div>
    </div>
  );
}
