import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, LayoutDashboard, Network, Bell, BookOpen,
  Play, Settings, LogOut, ChevronDown, User, Target
} from 'lucide-react';
import SystemControllerPanel from '../components/SystemControllerPanel';
import AttackChainTimeline from '../components/AttackChainTimeline';
import AttackPathDiagram from '../components/AttackPathDiagram';
import RetroactiveTimeline from '../components/RetroactiveTimeline';
import PlaybookExecutor from '../components/PlaybookExecutor';
import ThreatIntelPanel from '../components/ThreatIntelPanel';
import ParticleBackground from '../components/ParticleBackground';

const TABS = [
  { id: 'kill-chain',     label: 'KILL CHAIN',    icon: Shield },
  { id: 'attack-graph',   label: 'ATTACK GRAPH',  icon: Network },
  { id: 'alert-timeline', label: 'ALERT TIMELINE', icon: Bell },
  { id: 'playbooks',      label: 'PLAYBOOKS',     icon: BookOpen },
  { id: 'threat-intel',   label: 'THREAT INTEL',  icon: Target },
];

const SIDEBAR_ICONS = [
  { icon: LayoutDashboard, label: 'Dashboard', tab: 'kill-chain' },
  { icon: Network,         label: 'Attack Graph', tab: 'attack-graph' },
  { icon: Bell,            label: 'Alerts', tab: 'alert-timeline' },
  { icon: BookOpen,        label: 'Playbooks', tab: 'playbooks' },
  { icon: Play,            label: 'Threat Intel', tab: 'threat-intel' },
  { icon: Settings,        label: 'Settings', tab: null },
];

const SCENARIOS = [
  { label: 'AIIMS DELHI 2022', endpoint: '/api/demo/aiims/live', cacheEndpoint: '/api/demo/aiims' },
  { label: 'CBSE DATA THEFT 2026', endpoint: '/api/demo/cbse/live', cacheEndpoint: '/api/demo/cbse' },
];

export default function Demo() {
  const [activeTab, setActiveTab] = useState('kill-chain');
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [progressSteps, setProgressSteps] = useState([]);
  const [autopsyResult, setAutopsyResult] = useState(null);
  const [scenario, setScenario] = useState(SCENARIOS[0].label);
  const [healthStatus, setHealthStatus] = useState({ neo4j: false, chroma: false, mitre: false });
  const [alertCount, setAlertCount] = useState(0);

  // Load cached result on mount for instant demo
  useEffect(() => {
    const scenarioCfg = SCENARIOS.find(s => s.label === scenario) || SCENARIOS[0];
    fetch(scenarioCfg.cacheEndpoint)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setAutopsyResult(data);
          setIsComplete(true);
          setAlertCount(data.retroactive_alerts?.length || 0);
        }
      })
      .catch(() => {});

    // Health check
    fetch('/health')
      .then(r => r.ok ? r.json() : null)
      .then(h => {
        if (h) setHealthStatus({
          neo4j: h.neo4j_connected,
          chroma: h.chromadb_ready,
          mitre: h.mitre_techniques_loaded > 5,
        });
      })
      .catch(() => {});
  }, [scenario]);

  const startAutopsy = async () => {
    setIsRunning(true);
    setIsComplete(false);
    setProgressSteps([]);
    setAutopsyResult(null);

    const scenarioCfg = SCENARIOS.find(s => s.label === scenario) || SCENARIOS[0];

    try {
      const response = await fetch(scenarioCfg.endpoint, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process all complete SSE events (separated by double-newline)
        const parts = buffer.split('\n\n');
        buffer = parts.pop(); // keep last incomplete chunk

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.status === 'complete' && data.result) {
              setAutopsyResult(data.result);
              setIsComplete(true);
              setIsRunning(false);
              setAlertCount(data.result.retroactive_alerts?.length || 0);
            } else if (data.step) {
              setProgressSteps(prev => {
                const idx = prev.findIndex(s => s.step === data.step);
                if (idx >= 0) { const n = [...prev]; n[idx] = data; return n; }
                return [...prev, data];
              });
            }
          } catch { /* ignore JSON parse errors for non-data lines */ }
        }
      }
    } catch (err) {
      console.error('Autopsy run failed:', err);
      setIsRunning(false);
    }
  };

  const handleApprovePlaybook = async (execution_id) => {
    try {
      const res = await fetch(`/api/playbook/approve/${execution_id}`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setAutopsyResult(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            playbook_executions: prev.playbook_executions?.map(e =>
              e.execution_id === execution_id ? updated : e
            ) || [],
          };
        });
      }
    } catch (err) { console.error('Approve failed', err); }
  };

  const tabId = (id) => id; // alias for clarity

  return (
    <div
      className="min-h-screen flex flex-col font-sans overflow-hidden"
      style={{ background: '#0a0e14', color: '#f1f5f9' }}
    >
      {/* ── TOP BAR ──────────────────────────────────────────────────── */}
      <header
        className="h-14 flex items-center justify-between px-4 shrink-0 relative z-20"
        style={{
          background: 'rgba(11,15,23,0.95)',
          borderBottom: '1px solid rgba(30,37,48,0.9)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-red-500" style={{ filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.6))' }} />
          <span className="text-white font-bold tracking-widest text-sm font-mono">
            ATTACK CHAIN <span className="text-red-500">AUTOPSY</span>
          </span>
          <span
            className="text-[9px] font-mono px-2 py-0.5 rounded"
            style={{ background: 'rgba(30,37,48,0.8)', border: '1px solid rgba(51,65,85,0.5)', color: '#64748b' }}
          >
            CNI RESILIENCE v1.0.0
          </span>
        </div>

        {/* Scenario Selector */}
        <div className="relative flex items-center gap-1.5">
          <select
            value={scenario}
            onChange={e => {
              setScenario(e.target.value);
              setAutopsyResult(null);
              setIsComplete(false);
              setProgressSteps([]);
            }}
            className="appearance-none text-[11px] font-bold font-mono tracking-widest py-1.5 px-4 pr-8 rounded border outline-none cursor-pointer transition-all"
            style={{
              background: 'rgba(15,21,37,0.9)',
              border: '1.5px solid rgba(6,182,212,0.4)',
              color: '#22d3ee',
            }}
          >
            {SCENARIOS.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
          </select>
          <ChevronDown className="absolute right-2 w-3 h-3 text-cyan-400 pointer-events-none" />
        </div>

        {/* Right: status pills + bell + avatar */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-4">
            {[
              { label: 'NEO4J', suffix: 'ONLINE', ok: healthStatus.neo4j },
              { label: 'CHROMA', suffix: 'ONLINE', ok: healthStatus.chroma },
              { label: 'MITRE STIX', suffix: 'READY', ok: healthStatus.mitre },
            ].map(({ label, suffix, ok }) => (
              <div key={label} className="flex items-center gap-1.5 text-[9px] tracking-widest font-bold font-mono">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: ok ? '#22c55e' : '#ef4444',
                    boxShadow: `0 0 6px ${ok ? '#22c55e' : '#ef4444'}`,
                  }}
                />
                <span style={{ color: ok ? '#94a3b8' : '#ef4444' }}>{label}: {suffix}</span>
              </div>
            ))}
          </div>


        </div>
      </header>

      {/* ── BODY ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative z-10">

        {/* Left Sidebar Icon Rail */}
        <div
          className="w-12 flex flex-col items-center py-3 gap-3 shrink-0 relative z-20"
          style={{ background: 'rgba(11,15,23,0.95)', borderRight: '1px solid rgba(30,37,48,0.9)' }}
        >
          {SIDEBAR_ICONS.map(({ icon: Icon, label, tab }) => (
            <button
              key={label}
              onClick={() => tab && setActiveTab(tab)}
              title={label}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
              style={{
                background: activeTab === tab ? 'rgba(239,68,68,0.2)' : 'transparent',
                border: activeTab === tab ? '1px solid rgba(239,68,68,0.4)' : '1px solid transparent',
              }}
            >
              <Icon
                className="w-4 h-4"
                style={{ color: activeTab === tab ? '#ef4444' : '#475569' }}
              />
            </button>
          ))}
          <div className="mt-auto">
            <button title="Export" className="w-8 h-8 rounded-lg flex items-center justify-center">
              <LogOut className="w-4 h-4 text-slate-600 hover:text-slate-400 transition-colors" />
            </button>
          </div>
        </div>

        {/* Left Panel — SystemControllerPanel (hidden on attack-graph and kill-chain) */}
        {activeTab !== 'attack-graph' && activeTab !== 'kill-chain' && (
          <div
            className="w-72 shrink-0 overflow-y-auto border-r"
            style={{
              background: 'rgba(11,15,23,0.7)',
              borderColor: 'rgba(30,37,48,0.8)',
            }}
          >
            <SystemControllerPanel
              scenario={scenario}
              tab={activeTab}
              isRunning={isRunning}
              isComplete={isComplete}
              autopsyResult={autopsyResult}
              progressSteps={progressSteps}
              onRun={startAutopsy}
            />
          </div>
        )}

        {/* Right Area */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Tab Bar */}
          <div
            className="flex shrink-0"
            style={{
              background: 'rgba(11,15,23,0.95)',
              borderBottom: '1px solid rgba(30,37,48,0.9)',
            }}
          >
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className="flex items-center gap-1.5 px-5 py-3 text-[10px] font-bold tracking-widest font-mono transition-all relative"
                  style={{
                    color: active ? '#fff' : '#475569',
                    background: active ? 'rgba(239,68,68,0.08)' : 'transparent',
                    borderBottom: active ? '2px solid #ef4444' : '2px solid transparent',
                  }}
                >
                  <Icon className="w-3 h-3" style={{ color: active ? '#ef4444' : '#475569' }} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden relative">
            {!isComplete && !isRunning && activeTab !== 'attack-graph' && (
              <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                <ParticleBackground variant="dense" />
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab + (isComplete ? '_done' : '_empty')}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="h-full overflow-y-auto"
              >
              {/* Attack graph always renders (has its own empty state) */}
              {activeTab === 'attack-graph' ? (
                <AttackPathDiagram
                  graph_nodes={autopsyResult?.graph_nodes || []}
                  graph_edges={autopsyResult?.graph_edges || []}
                  incident_id={autopsyResult?.incident_id || 'aiims_2022'}
                  autopsyResult={autopsyResult}
                />
              ) : !isComplete && !isRunning ? (
                  /* Empty state */
                  <div className="h-full flex flex-col items-center justify-center text-slate-600">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
                      style={{ border: '2px dashed rgba(6,182,212,0.2)', background: 'rgba(6,182,212,0.05)' }}
                    >
                      <Shield className="w-7 h-7 text-cyan-900" style={{ animation: 'pulse 2s infinite' }} />
                    </div>
                    <h2 className="text-sm font-bold tracking-widest font-mono text-cyan-600/40 mb-2">
                      AWAITING SYSTEM INGESTION
                    </h2>
                    <p className="text-[11px] font-mono text-slate-700">
                      Select scenario target and trigger simulation replay.
                    </p>
                  </div>
                ) : isRunning && !isComplete ? (
                  /* Running state */
                  <div className="h-full flex flex-col items-center justify-center gap-6">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full border-2 border-red-500/30 flex items-center justify-center" style={{ boxShadow: '0 0 30px rgba(239,68,68,0.15)' }}>
                        <div className="w-14 h-14 rounded-full border-2 border-t-red-500 border-r-red-400 border-b-transparent border-l-transparent animate-spin" />
                      </div>
                      <div className="absolute inset-0 rounded-full border border-red-500/10 animate-ping" />
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold font-mono text-red-400 tracking-widest mb-1 animate-pulse">
                        EXECUTING AUTOPSY
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {progressSteps.length > 0
                          ? (progressSteps[progressSteps.length - 1]?.summary || 'Reconstructing attack chain...')
                          : 'Initializing agents...'}
                      </div>
                    </div>
                    {progressSteps.length > 0 && (
                      <div className="w-64">
                        <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-1">
                          <span>PROGRESS</span>
                          <span>{Math.min(100, Math.round((progressSteps.filter(s => s.status === 'complete').length / 5) * 100))}%</span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.8)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              background: 'linear-gradient(90deg, #06b6d4, #ef4444)',
                              width: `${Math.max(5, Math.min(95, (progressSteps.filter(s => s.status === 'complete').length / 5) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {activeTab === 'kill-chain' && (
                      <div className="p-4 h-full">
                        <AttackChainTimeline autopsy_result={autopsyResult} />
                      </div>
                    )}
                    {activeTab === 'alert-timeline' && (
                      <div className="p-4 h-full">
                        <RetroactiveTimeline
                          alerts={autopsyResult?.retroactive_alerts || []}
                          autopsyResult={autopsyResult}
                        />
                      </div>
                    )}
                    {activeTab === 'playbooks' && (
                      <div className="p-4 h-full">
                        <PlaybookExecutor
                          executions={autopsyResult?.playbook_executions || []}
                          on_approve={handleApprovePlaybook}
                        />
                      </div>
                    )}
                    {activeTab === 'threat-intel' && (
                      <div className="p-4 h-full">
                        <ThreatIntelPanel
                          actor_attribution={autopsyResult?.actor_attribution}
                          predicted_ttps={autopsyResult?.ttp_attributions || []}
                          autopsyResult={autopsyResult}
                        />
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
