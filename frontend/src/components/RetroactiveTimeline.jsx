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
    <div className="bg-[#0a0e1a] text-slate-300 p-6 rounded-lg border-2 border-slate-800 shadow-xl max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-white mb-8 tracking-wider">RETROACTIVE DETECTION TIMELINE</h2>
      
      <div className="relative pl-12 border-l-2 border-slate-700 pb-12">
        {sortedAlerts.map((alert, idx) => (
          <div key={alert.alert_id} 
               className="mb-10 relative"
               style={{ 
                 opacity: mounted ? 1 : 0, 
                 transform: mounted ? 'translateX(0)' : 'translateX(-50px)', 
                 transition: `all 500ms ease-out ${idx * 400}ms` 
               }}>
            
            {/* Timeline Dot */}
            <div className={`absolute -left-[57px] top-1 w-6 h-6 rounded-full border-4 border-[#0a0e1a] ${alert.would_have_prevented_breach ? 'bg-cyan-500' : 'bg-amber-500'}`} />
            
            {/* Timestamp Badge */}
            <div className="absolute -left-36 top-1 text-right w-24">
              <div className="font-mono text-xs text-slate-400 font-bold">DAY {22 - alert.days_before_incident}</div>
              <div className="font-mono text-[10px] text-cyan-400 tracking-widest">{alert.time_before_incident}</div>
            </div>

            {/* Card */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-lg transition-all hover:border-slate-500">
              
              {/* Top Bar */}
              <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
                <div className="flex gap-2">
                  <span className="bg-cyan-900/50 text-cyan-400 text-xs px-2 py-0.5 rounded font-mono border border-cyan-800">{alert.mitre_technique_id}</span>
                  <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded font-mono border border-slate-600">{alert.alert_type}</span>
                </div>
                <div className="flex items-center gap-2 w-32">
                  <span className="text-[10px] text-slate-400">CONFIDENCE</span>
                  <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full ${getConfidenceColor(alert.confidence)}`} style={{ width: `${alert.confidence * 100}%` }} />
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-4">
                <p className="text-sm text-slate-300 leading-relaxed mb-4">{alert.description}</p>
                
                {/* Evidence Dropdown */}
                <div className="mb-4">
                  <button onClick={() => toggleExpand(alert.alert_id)} className="text-xs text-cyan-500 hover:text-cyan-400 font-bold flex items-center gap-1 focus:outline-none">
                    {expandedAlerts[alert.alert_id] ? '▼ HIDE EVIDENCE' : '▶ SHOW EVIDENCE'} ({alert.evidence?.length || 0})
                  </button>
                  {expandedAlerts[alert.alert_id] && (
                    <div className="mt-2 bg-[#0a0e1a] p-3 rounded border border-slate-800 text-xs font-mono text-slate-400 space-y-1">
                      {alert.evidence?.map((ev, i) => <div key={i}>• {ev}</div>)}
                    </div>
                  )}
                </div>

                {/* Recommended Action Box */}
                <div className="bg-cyan-900/10 border-l-4 border-cyan-500 p-3 rounded-r text-sm text-cyan-100">
                  <span className="font-bold text-cyan-400 block mb-1">RECOMMENDED ACTION:</span>
                  {alert.recommended_action}
                </div>
              </div>

              {/* Footer */}
              <div className={`px-4 py-2 text-xs font-bold tracking-widest ${alert.would_have_prevented_breach ? 'bg-green-900/20 text-green-400' : 'bg-amber-900/20 text-amber-500'}`}>
                {alert.would_have_prevented_breach ? '✓ BREACH PREVENTABLE AT THIS STAGE' : '⚠ DATA EXFILTRATION IMMINENT'}
              </div>
            </div>
          </div>
        ))}

        {/* Ransomware Deployed Marker */}
        <div className="relative mt-8" style={{ opacity: mounted ? 1 : 0, transition: 'opacity 1s ease-out 2s' }}>
          <div className="absolute -left-[57px] top-1 w-6 h-6 rounded-full border-4 border-[#0a0e1a] bg-red-600 animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.8)]" />
          <div className="absolute -left-[45px] top-7 bottom-0 w-0.5 border-l-2 border-dashed border-red-500/50" />
          <div className="bg-red-900/20 border-2 border-red-500/50 rounded-lg p-4 text-center ml-2">
            <h3 className="text-red-500 font-bold tracking-widest uppercase mb-1">Ransomware Deployed — Actual Discovery</h3>
            <div className="font-mono text-slate-400 text-xs">Day 22 (T-0) | The point where existing tools finally alerted</div>
          </div>
        </div>
      </div>

      {/* Summary Box */}
      <div className="mt-12 bg-slate-900 border-2 border-slate-700 rounded-lg p-6 max-w-lg mx-auto shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-cyan-500" />
        <h3 className="text-white font-bold tracking-widest mb-4">RECONSTRUCTION SUMMARY</h3>
        <div className="space-y-3 font-mono text-sm">
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">EARLIEST DETECTABLE SIGNAL</span>
            <span className="text-cyan-400">T-{earliestDetect?.days_before_incident || 0} DAYS</span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">HIGH-CONFIDENCE ALERT</span>
            <span className="text-amber-400">T-{highConfAlert?.days_before_incident || 0} DAYS</span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">LAST CONTAINMENT WINDOW</span>
            <span className="text-orange-400">T-{lastContainment?.days_before_incident || 0} DAYS</span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">ACTUAL DISCOVERY</span>
            <span className="text-red-500">T-0</span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-white font-bold">PREVENTION WINDOW</span>
            <span className="text-green-400 font-bold bg-green-900/30 px-2 py-0.5 rounded">{(earliestDetect?.days_before_incident || 0)} DAYS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
