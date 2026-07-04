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
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col font-sans overflow-hidden">
      
      {/* Top Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-red-500" />
          <h1 className="text-white font-bold tracking-widest text-lg">ATTACK CHAIN <span className="text-red-500">AUTOPSY</span></h1>
          <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded font-mono">v1.0.0</span>
        </div>
        
        <div className="flex items-center">
          <select 
            value={scenario} 
            onChange={(e) => setScenario(e.target.value)}
            className="bg-slate-800 border-2 border-slate-700 text-white text-sm font-bold tracking-widest py-1.5 px-4 rounded outline-none focus:border-red-500 transition-colors cursor-pointer appearance-none"
          >
            <option>AIIMS DELHI 2022</option>
            <option>CBSE DATA THEFT 2026</option>
          </select>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-[10px] tracking-widest text-slate-400 font-bold">
            <Server className="w-3 h-3 text-green-500" /> NEO4J
          </div>
          <div className="flex items-center gap-2 text-[10px] tracking-widest text-slate-400 font-bold">
            <Database className="w-3 h-3 text-green-500" /> CHROMA
          </div>
          <div className="flex items-center gap-2 text-[10px] tracking-widest text-slate-400 font-bold">
            <Globe className="w-3 h-3 text-green-500" /> MITRE ATT&CK
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Panel (35%) */}
        <div className="w-[35%] border-r border-slate-800 bg-slate-900/30 flex flex-col overflow-y-auto">
          <div className="p-6">
            <h2 className="text-xs font-bold text-slate-500 tracking-widest mb-4">INCIDENT ANALYSIS</h2>
            
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 mb-6 shadow-lg">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-white leading-tight">AIIMS Delhi<br/>Ransomware</h3>
                <span className="bg-red-900/50 text-red-500 border border-red-500/50 text-[10px] font-bold px-2 py-0.5 rounded tracking-wider">CRITICAL</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-500">Date</span>
                  <span className="text-slate-300 font-mono">November 2022</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-500">Dwell Time</span>
                  <span className="text-slate-300 font-mono">{isComplete ? '22 Days' : '???'}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-slate-500">Status</span>
                  <span className="text-cyan-400 font-mono text-xs tracking-widest">HISTORICAL — RECONSTRUCTION MODE</span>
                </div>
              </div>
            </div>

            {!isComplete && (
              <button 
                onClick={startAutopsy} 
                disabled={isRunning}
                className={`w-full py-4 rounded-lg font-bold tracking-widest text-lg flex items-center justify-center gap-2 transition-all ${isRunning ? 'bg-slate-800 text-slate-500 cursor-not-allowed border-2 border-slate-700' : 'bg-red-600 hover:bg-red-500 text-white border-2 border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.4)] animate-pulse hover:animate-none'}`}
              >
                {isRunning ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> RUNNING AUTOPSY...</>
                ) : (
                  <><Play className="w-5 h-5 fill-current" /> RUN ATTACK CHAIN AUTOPSY</>
                )}
              </button>
            )}

            {/* Progress Tracker */}
            {(isRunning || (isComplete && progressSteps.length > 0)) && (
              <div className="mt-8">
                <h3 className="text-xs font-bold text-slate-500 tracking-widest mb-4">RECONSTRUCTION PROGRESS</h3>
                <div className="space-y-4">
                  {progressSteps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {step.status === 'complete' ? (
                          <div className="w-5 h-5 rounded-full bg-green-900/50 border border-green-500 flex items-center justify-center">
                            <Check className="w-3 h-3 text-green-500" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-cyan-500 flex items-center justify-center">
                            <Loader2 className="w-3 h-3 text-cyan-500 animate-spin" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-sm font-bold ${step.status === 'complete' ? 'text-slate-300' : 'text-cyan-400'}`}>
                            {step.step}
                          </span>
                          {step.progress_pct && <span className="text-xs text-slate-500 font-mono">{step.progress_pct}%</span>}
                        </div>
                        {step.agent && <div className="text-[10px] text-slate-500 font-mono tracking-widest">AGENT: {step.agent}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Results Summary */}
            {isComplete && autopsyResult && (
              <div className="mt-8 bg-slate-900 border-2 border-slate-700 rounded-lg p-5 shadow-xl animate-in fade-in slide-in-from-bottom-4">
                <h3 className="text-white font-bold tracking-widest mb-4">RECONSTRUCTION SUMMARY</h3>
                <div className="space-y-3 font-mono text-sm">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-2 text-slate-400"><span className="w-2 h-2 rounded-full bg-red-500"></span> EARLIEST SIGNAL</span>
                    <span className="text-cyan-400">T-21d</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-2 text-slate-400"><span className="text-amber-500 font-sans text-[10px]">⚡</span> HIGH CONFIDENCE</span>
                    <span className="text-amber-400">T-19d</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-2 text-slate-400"><span className="w-2 h-2 rounded-full bg-orange-500"></span> LAST WINDOW</span>
                    <span className="text-orange-400">T-10d</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2 pt-1">
                    <span className="flex items-center gap-2 text-white font-bold"><span className="text-green-500 font-sans text-[10px]">✅</span> PREVENTION WINDOW</span>
                    <span className="text-green-400 font-bold bg-green-900/30 px-2 py-0.5 rounded">19 DAYS</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="flex items-center gap-2 text-white font-bold"><span className="text-red-500 font-sans text-[10px]">🎯</span> ACTOR</span>
                    <span className="text-red-500 font-bold">{autopsyResult.actor_attribution?.actor_name || 'APT41'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel (65%) */}
        <div className="flex-1 flex flex-col bg-[#0a0e1a]">
          {/* Tabs */}
          <div className="flex bg-slate-900 border-b border-slate-800 shrink-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => isComplete && setActiveTab(tab.id)}
                className={`flex-1 py-3 text-xs font-bold tracking-widest transition-colors border-b-2 ${activeTab === tab.id ? 'text-white border-red-500 bg-slate-800/50' : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/30'} ${!isComplete && 'cursor-not-allowed opacity-50'}`}
                disabled={!isComplete}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {!isComplete ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-800 rounded-lg">
                <Activity className="w-16 h-16 text-slate-700 mb-4" />
                <h2 className="text-xl text-slate-400 font-bold mb-2 tracking-widest">AWAITING RECONSTRUCTION</h2>
                <p className="text-sm">Select an incident and run autopsy to begin reconstruction.</p>
              </div>
            ) : (
              <div className="h-full animate-in fade-in duration-500">
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
