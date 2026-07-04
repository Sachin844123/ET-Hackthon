import React, { useState, useEffect, useRef } from 'react';
import { Shield, Play, Activity, Server, Database, Globe, Check, Loader2 } from 'lucide-react';
import AttackChainTimeline from '../components/AttackChainTimeline';
import ThreatGraph3D from '../components/ThreatGraph3D';
import RetroactiveTimeline from '../components/RetroactiveTimeline';
import PlaybookExecutor from '../components/PlaybookExecutor';
import ThreatIntelPanel from '../components/ThreatIntelPanel';

export default function Demo() {
  const [activeTab, setActiveTab] = useState('KILL CHAIN');
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [progressSteps, setProgressSteps] = useState([]);
  const [autopsyResult, setAutopsyResult] = useState(null);
  
  const [scenario, setScenario] = useState('AIIMS DELHI 2022');

  const startAutopsy = async () => {
    setIsRunning(true);
    setIsComplete(false);
    setProgressSteps([]);
    setAutopsyResult(null);

    // Call the real backend SSE endpoint
    try {
      const response = await fetch('http://localhost:8000/api/demo/aiims/live', {
        method: 'POST',
      });
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.status === 'complete' && data.result) {
                setAutopsyResult(data.result);
                setIsComplete(true);
                setIsRunning(false);
                setActiveTab('KILL CHAIN');
              } else {
                setProgressSteps(prev => {
                  // Keep only latest 5 or update existing step
                  const existing = prev.findIndex(s => s.step === data.step);
                  if (existing >= 0) {
                    const newSteps = [...prev];
                    newSteps[existing] = data;
                    return newSteps;
                  }
                  return [...prev, data];
                });
              }
            } catch (e) {
              // Parse error on chunk
            }
          }
        }
      }
    } catch (error) {
      console.error("Autopsy run failed:", error);
      setIsRunning(false);
    }
  };

  const handleApprovePlaybook = async (execution_id) => {
    try {
      const res = await fetch(`http://localhost:8000/api/playbook/approve/${execution_id}`, {
        method: 'POST'
      });
      if (res.ok) {
        const updatedExec = await res.json();
        setAutopsyResult(prev => {
          if (!prev) return prev;
          const newExecs = prev.playbook_executions.map(ex => 
            ex.execution_id === execution_id ? updatedExec : ex
          );
          return { ...prev, playbook_executions: newExecs };
        });
      }
    } catch (err) {
      console.error("Approve failed", err);
    }
  };

  const tabs = [
    { id: 'KILL CHAIN', label: 'KILL CHAIN' },
    { id: 'ATTACK GRAPH', label: 'ATTACK GRAPH' },
    { id: 'ALERT TIMELINE', label: 'ALERT TIMELINE' },
    { id: 'PLAYBOOKS', label: 'PLAYBOOKS' },
    { id: 'THREAT INTEL', label: 'THREAT INTEL' }
  ];

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col font-sans overflow-hidden cyber-grid-bg">
      
      {/* Top Bar / Control Center Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between px-6 shrink-0 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-red-500 filter drop-shadow-[0_0_5px_rgba(239,68,68,0.5)] animate-pulse" />
          <h1 className="text-white font-bold tracking-widest text-lg">ATTACK CHAIN <span className="text-red-500 neon-glow-text-red">AUTOPSY</span></h1>
          <span className="bg-slate-800 border border-slate-700 text-slate-400 text-[10px] px-2.5 py-0.5 rounded font-mono">CNI RESILIENCE v1.0.0</span>
        </div>
        
        <div className="flex items-center">
          <select 
            value={scenario} 
            onChange={(e) => setScenario(e.target.value)}
            className="bg-slate-900 border-2 border-slate-700 hover:border-cyan-500 text-cyan-400 text-xs font-bold tracking-widest py-2 px-6 rounded cursor-pointer outline-none transition-all duration-300 font-mono"
          >
            <option>AIIMS DELHI 2022</option>
            <option>CBSE DATA THEFT 2026</option>
          </select>
        </div>
        
        <div className="hidden lg:flex items-center gap-6">
          <div className="flex items-center gap-2 text-[10px] tracking-widest text-slate-400 font-bold font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> NEO4J: ONLINE
          </div>
          <div className="flex items-center gap-2 text-[10px] tracking-widest text-slate-400 font-bold font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> CHROMA: ONLINE
          </div>
          <div className="flex items-center gap-2 text-[10px] tracking-widest text-slate-400 font-bold font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> MITRE STIX: READY
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative z-10">
        
        {/* Left Control Panel (35%) */}
        <div className="w-[35%] border-r border-slate-800/80 bg-slate-950/40 flex flex-col overflow-y-auto backdrop-blur-sm tech-border-r">
          <div className="p-6">
            <h2 className="text-[10px] font-bold text-slate-500 tracking-widest mb-4 uppercase">SYSTEM CONTROLLER</h2>
            
            <div className="cyber-card-red p-5 mb-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white leading-tight font-mono">{scenario}</h3>
                  <span className="text-[10px] text-slate-500 font-mono block mt-1">INCIDENT RECONSTRUCTION</span>
                </div>
                <span className="bg-red-950/60 text-red-400 border border-red-500/40 text-[9px] font-bold px-2 py-0.5 rounded tracking-wider uppercase">CRITICAL CNI</span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b border-slate-800/60 pb-2">
                  <span className="text-slate-500">TARGET SYSTEM</span>
                  <span className="text-slate-300">CNI INFRASTRUCTURE</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-2">
                  <span className="text-slate-500">ATTACK DWELL TIME</span>
                  <span className="text-slate-300">{isComplete ? '22 Days (Actual)' : 'ANALYZING...'}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-500">REPLAY RESOLUTION</span>
                  <span className="text-cyan-400 font-bold">1-DAY TIME STEPS</span>
                </div>
              </div>
            </div>

            {!isComplete && (
              <button 
                onClick={startAutopsy} 
                disabled={isRunning}
                className={`w-full py-4 rounded font-bold tracking-widest text-sm flex items-center justify-center gap-2 transition-all duration-300 ${isRunning ? 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed' : 'cyber-button'}`}
              >
                {isRunning ? (
                  <><Loader2 className="w-4 h-4 animate-spin text-red-500" /> REPLAYING SYNTHETIC LOGS...</>
                ) : (
                  <><Play className="w-4 h-4 fill-current text-white" /> RUN ATTACK CHAIN AUTOPSY</>
                )}
              </button>
            )}

            {/* Progress Tracker */}
            {(isRunning || (isComplete && progressSteps.length > 0)) && (
              <div className="mt-8">
                <h3 className="text-[10px] font-bold text-slate-500 tracking-widest mb-4 uppercase">AGENT EXECUTION LOG</h3>
                <div className="space-y-4">
                  {progressSteps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-slate-900/40 p-3 border border-slate-800/60 rounded animate-fade-in-up">
                      <div className="mt-0.5">
                        {step.status === 'complete' ? (
                          <div className="w-5 h-5 rounded-full bg-green-950/60 border border-green-500/50 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-green-400" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-cyan-950/40 border border-cyan-500/50 flex items-center justify-center">
                            <Loader2 className="w-2.5 h-2.5 text-cyan-400 animate-spin" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-xs font-bold font-mono ${step.status === 'complete' ? 'text-slate-300' : 'text-cyan-400 neon-glow-text-cyan'}`}>
                            {step.step?.toUpperCase()}
                          </span>
                          {step.progress_pct && <span className="text-[10px] text-slate-500 font-mono">{step.progress_pct}%</span>}
                        </div>
                        <div className="text-[11px] text-slate-400 leading-normal">{step.summary}</div>
                        {step.agent && <div className="text-[9px] text-slate-500 font-mono tracking-widest mt-1">PROCESSOR: {step.agent}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Results Summary Card */}
            {isComplete && autopsyResult && (
              <div className="mt-8 cyber-card p-5 animate-fade-in-up">
                <h3 className="text-white text-xs font-bold tracking-widest mb-4 border-b border-slate-800 pb-2">RECONSTRUCTION INSIGHTS</h3>
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                    <span className="flex items-center gap-2 text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> EARLIEST SIGNAL</span>
                    <span className="text-cyan-400 font-bold neon-glow-text-cyan">T-21 DAYS</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                    <span className="flex items-center gap-2 text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> HIGH CONFIDENCE</span>
                    <span className="text-amber-400 font-bold neon-glow-text-amber">T-19 DAYS</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                    <span className="flex items-center gap-2 text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> CONTAINMENT GAP</span>
                    <span className="text-orange-400 font-bold">T-10 DAYS</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-800/60 pb-2 pt-1">
                    <span className="flex items-center gap-2 text-slate-200 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> PREVENTATIVE EDGE</span>
                    <span className="text-green-400 font-bold bg-green-950/40 px-2 py-0.5 border border-green-800/50 rounded">19 DAYS SAVED</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="flex items-center gap-2 text-slate-200 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> ATTRIBUTED GROUP</span>
                    <span className="text-red-400 font-bold font-mono">{autopsyResult.actor_attribution?.actor_name || 'APT41'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Dashboard Area (65%) */}
        <div className="flex-1 flex flex-col bg-[#0a0e1a]/80 backdrop-blur-sm">
          {/* Dashboard Tabs */}
          <div className="flex bg-slate-900/40 border-b border-slate-800/80 shrink-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => isComplete && setActiveTab(tab.id)}
                className={`flex-1 py-4 text-[10px] font-bold tracking-widest transition-all duration-300 border-b-2 cyber-header-tab ${activeTab === tab.id ? 'active text-white bg-slate-900/60' : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-900/20'} ${!isComplete && 'cursor-not-allowed opacity-40'}`}
                disabled={!isComplete}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Main Display Window */}
          <div className="flex-1 p-6 overflow-y-auto">
            {!isComplete ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-800/80 rounded-lg bg-slate-900/10">
                <Activity className="w-12 h-12 text-slate-700 mb-4 animate-pulse" />
                <h2 className="text-sm text-slate-400 font-bold mb-2 tracking-widest uppercase">AWAITING SYSTEM INGESTION</h2>
                <p className="text-xs text-slate-500 font-mono">Select scenario target above and trigger simulation replay.</p>
              </div>
            ) : (
              <div className="h-full">
                {activeTab === 'KILL CHAIN' && <AttackChainTimeline autopsy_result={autopsyResult} />}
                {activeTab === 'ATTACK GRAPH' && <ThreatGraph3D graph_nodes={autopsyResult.graph_nodes} graph_edges={autopsyResult.graph_edges} incident_id={autopsyResult.incident_id} />}
                {activeTab === 'ALERT TIMELINE' && <RetroactiveTimeline alerts={autopsyResult.retroactive_alerts} incident_date={autopsyResult.incident_date} />}
                {activeTab === 'PLAYBOOKS' && <PlaybookExecutor executions={autopsyResult.playbook_executions} on_approve={handleApprovePlaybook} />}
                {activeTab === 'THREAT INTEL' && <ThreatIntelPanel actor_attribution={autopsyResult.actor_attribution} predicted_ttps={autopsyResult.ttp_attributions} />}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
