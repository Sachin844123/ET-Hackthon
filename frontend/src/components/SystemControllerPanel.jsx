import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Check, Loader2, BookOpen, Plus, Download,
  Library, LayoutTemplate, Clock, Bell, ShieldAlert
} from 'lucide-react';
import GlitchText from './GlitchText';

/**
 * SystemControllerPanel — persistent left panel shared across Demo tabs.
 *
 * Cards:
 *   1. System Controller (always shown)
 *   2. Reconstruction Insights / Autopsy Status (always shown)
 *   3. Conditional by `tab` prop:
 *        'playbooks'      → Quick Actions (2×2 icon grid)
 *        'attack-graph'   → not rendered (Tab 2 has its own full left panel)
 *        everything else  → Agent Execution Log (live scroll)
 *
 * Props:
 *   scenario       — string
 *   tab            — active tab id
 *   isRunning      — boolean
 *   isComplete     — boolean
 *   autopsyResult  — object | null
 *   progressSteps  — array of SSE step objects
 *   onRun          — callback to trigger autopsy run
 */
export default function SystemControllerPanel({
  scenario = 'AIIMS DELHI 2022',
  tab = 'kill-chain',
  isRunning = false,
  isComplete = false,
  autopsyResult = null,
  progressSteps = [],
  onRun,
}) {
  const logRef = useRef(null);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [progressSteps]);

  const prevention = autopsyResult?.prevention_window_days
    ?? autopsyResult?.retroactive_alerts?.reduce(
        (max, a) => Math.max(max, a.days_before_incident || 0), 0
      ) ?? 19;

  const actor = autopsyResult?.actor_attribution?.actor_name || 'APT41';
  const dwell = autopsyResult?.incident_duration_days || 22;

  // Log timestamps
  const now = new Date();
  const fmt = (d) => d.toTimeString().slice(0, 8);

  const systemLog = [
    { ts: fmt(new Date(now - 5000)), msg: 'System initialization completed' },
    { ts: fmt(new Date(now - 4200)), msg: 'Neo4j connection established' },
    { ts: fmt(new Date(now - 3600)), msg: 'MITRE ATT&CK framework loaded' },
    { ts: fmt(new Date(now - 2800)), msg: 'ChromaDB vector store ready' },
    { ts: fmt(new Date(now - 1800)), msg: 'Scenario data verified' },
    ...progressSteps.map((s, i) => ({
      ts: fmt(new Date(now - (1500 - i * 300))),
      msg: s.summary || s.step || 'Agent step complete',
    })),
  ];

  if (tab === 'attack-graph') return null;

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto p-4">

      {/* ── Card 1: System Controller ───────────────────────────────── */}
      <div
        className="rounded-xl border p-4"
        style={{
          background: 'rgba(15,21,37,0.9)',
          borderColor: 'rgba(239,68,68,0.35)',
          boxShadow: '0 0 20px rgba(239,68,68,0.08)',
        }}
      >
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-sm font-bold text-white font-mono leading-tight">{scenario}</h3>
            <span className="text-[9px] text-slate-500 font-mono block mt-0.5">INCIDENT RECONSTRUCTION</span>
          </div>
          <span className="bg-red-950/60 text-red-400 border border-red-500/40 text-[8px] font-bold px-2 py-0.5 rounded tracking-wider uppercase animate-pulse">
            CRITICAL CNI
          </span>
        </div>

        <div className="space-y-2 text-[10px] font-mono">
          <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
            <span className="text-slate-500">TARGET SYSTEM</span>
            <span className="text-slate-300">CNI INFRASTRUCTURE</span>
          </div>
          <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
            <span className="text-slate-500">ATTACK DWELL TIME</span>
            <span className="text-slate-300 flex items-center gap-1.5">
              {isComplete
                ? <>{dwell} DAYS <span className="text-slate-500">(ACTUAL)</span></>
                : isRunning
                ? <><Loader2 className="w-3 h-3 animate-spin text-cyan-400" /> ANALYZING...</>
                : <span className="text-slate-600">PENDING</span>
              }
            </span>
          </div>
          <div className="flex justify-between pt-0.5">
            <span className="text-slate-500">REPLAY RESOLUTION</span>
            <span className="text-cyan-400 font-bold">1-DAY TIME STEPS</span>
          </div>
        </div>

        {/* Run button — shows when not yet started */}
        {!isComplete && (
          <motion.button
            onClick={onRun}
            disabled={isRunning}
            whileHover={!isRunning ? { scale: 1.02 } : {}}
            whileTap={!isRunning ? { scale: 0.97 } : {}}
            className="w-full mt-4 py-2.5 rounded font-bold tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all"
            style={{
              background: isRunning
                ? 'rgba(30,41,59,0.5)'
                : 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
              border: isRunning ? '1px solid rgba(51,65,85,0.5)' : '1px solid rgba(239,68,68,0.5)',
              color: isRunning ? '#475569' : '#fff',
              boxShadow: isRunning ? 'none' : '0 0 20px rgba(239,68,68,0.3)',
            }}
          >
            {isRunning
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> EXECUTING AUTOPSY...</>
              : <><Activity className="w-3.5 h-3.5" /> RUN ATTACK CHAIN AUTOPSY</>
            }
          </motion.button>
        )}
        {/* Re-run button — shows after completion */}
        {isComplete && !isRunning && (
          <motion.button
            onClick={onRun}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="w-full mt-4 py-2 rounded font-bold tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all"
            style={{
              background: 'rgba(30,41,59,0.4)',
              border: '1px solid rgba(51,65,85,0.5)',
              color: '#64748b',
            }}
          >
            <Activity className="w-3.5 h-3.5" /> RE-RUN AUTOPSY
          </motion.button>
        )}
      </div>

      {/* ── Card 2: Reconstruction Insights / Status ─────────────────── */}
      <div
        className="rounded-xl border p-4"
        style={{
          background: 'rgba(15,21,37,0.9)',
          borderColor: 'rgba(30,41,59,0.8)',
        }}
      >
        {isComplete && autopsyResult ? (
          <>
            <h3 className="text-[10px] font-bold text-white tracking-widest mb-3 font-mono flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-cyan-400" /> RECONSTRUCTION INSIGHTS
            </h3>
            <div className="space-y-2 font-mono text-[10px]">
              {[
                { label: 'EARLIEST SIGNAL', value: 'T-21 DAYS', color: '#06b6d4', pulse: true },
                { label: 'HIGH CONFIDENCE', value: 'T-19 DAYS', color: '#f59e0b', pulse: true },
                { label: 'CONTAINMENT GAP', value: 'T-10 DAYS', color: '#f97316', pulse: false },
                { label: 'PREVENTATIVE EDGE', value: `${prevention} DAYS SAVED`, color: '#22c55e', pulse: true, bold: true },
                { label: 'ATTRIBUTED GROUP', value: actor, color: '#ef4444', pulse: true, bold: true, glow: true },
              ].map(({ label, value, color, pulse, bold, glow }) => (
                <div key={label} className="flex justify-between items-center border-b border-slate-800/40 pb-1.5 last:border-0 last:pb-0">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${pulse ? 'animate-pulse' : ''}`}
                      style={{ background: color }}
                    />
                    {label}
                  </span>
                  <span
                    className={`font-bold ${bold ? 'text-xs' : ''}`}
                    style={{
                      color,
                      textShadow: glow ? `0 0 10px ${color}80` : 'none',
                    }}
                  >
                    {label === 'ATTRIBUTED GROUP'
                      ? <GlitchText text={value} delay={300} />
                      : value
                    }
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <div className="w-8 h-8 rounded-full border-2 border-cyan-500/40 flex items-center justify-center">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-cyan-400 animate-spin"
                    style={{ borderTopColor: 'transparent' }}
                  />
                </div>
                {isRunning && (
                  <div className="absolute inset-0 rounded-full border border-cyan-400/20 animate-ping" />
                )}
              </div>
              <div>
                <div className="text-[10px] font-bold text-white font-mono">
                  {isRunning ? 'EXECUTING AUTOPSY' : 'AWAITING EXECUTION'}
                </div>
                <div className="text-[9px] text-slate-500 font-mono">
                  {isRunning ? 'Reconstructing attack chain...' : 'Click RUN to begin'}
                </div>
              </div>
            </div>
            {isRunning && progressSteps.length > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-1">
                  <span>PROGRESS</span>
                  <span>{Math.min(100, Math.round((progressSteps.filter(s => s.status === 'complete').length / 5) * 100))}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.8)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #06b6d4, #ef4444)' }}
                    initial={{ width: '5%' }}
                    animate={{
                      width: `${Math.max(5, Math.min(95, (progressSteps.filter(s => s.status === 'complete').length / 5) * 100))}%`
                    }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Card 3: Conditional ─────────────────────────────────────── */}
      {tab === 'playbooks' ? (
        /* Quick Actions */
        <div
          className="rounded-xl border p-4"
          style={{ background: 'rgba(15,21,37,0.9)', borderColor: 'rgba(30,41,59,0.8)' }}
        >
          <h3 className="text-[10px] font-bold text-white tracking-widest mb-3 font-mono flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" /> QUICK ACTIONS
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: Plus, label: 'Create Playbook', color: '#06b6d4' },
              { icon: Download, label: 'Import Playbook', color: '#a855f7' },
              { icon: Library, label: 'Playbook Library', color: '#f59e0b' },
              { icon: LayoutTemplate, label: 'Templates', color: '#22c55e' },
            ].map(({ icon: Icon, label, color }) => (
              <button
                key={label}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all hover:scale-105"
                style={{
                  background: `${color}10`,
                  borderColor: `${color}30`,
                }}
              >
                <Icon className="w-4 h-4" style={{ color }} />
                <span className="text-[8px] font-mono text-slate-400 text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : tab === 'alert-timeline' ? (
        /* Quick Metrics for Alert Timeline — clean 2×2 grid */
        <div
          className="rounded-xl border p-4"
          style={{ background: 'rgba(15,21,37,0.9)', borderColor: 'rgba(30,41,59,0.8)' }}
        >
          <h3 className="text-[10px] font-bold text-white tracking-widest mb-3 font-mono flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-cyan-400" /> QUICK METRICS
          </h3>
          <div className="grid grid-cols-2 gap-2">

            {/* Total Alerts */}
            <div
              className="flex flex-col gap-1.5 p-2.5 rounded-lg border"
              style={{ background: 'rgba(6,182,212,0.06)', borderColor: 'rgba(6,182,212,0.15)' }}
            >
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Total Alerts</span>
              <span className="text-xl font-bold font-mono text-cyan-400 leading-none">142</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Bell className="w-3 h-3 text-slate-500" />
                <span className="text-[8px] font-mono text-slate-500">All Stages</span>
              </div>
            </div>

            {/* High Severity */}
            <div
              className="flex flex-col gap-1.5 p-2.5 rounded-lg border"
              style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.15)' }}
            >
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">High Severity</span>
              <span className="text-xl font-bold font-mono text-red-400 leading-none">23</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <ShieldAlert className="w-3 h-3 text-slate-500" />
                <span className="text-[8px] font-mono text-slate-500">16.2% of total</span>
              </div>
            </div>

            {/* Avg Confidence */}
            <div
              className="flex flex-col gap-1.5 p-2.5 rounded-lg border"
              style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.15)' }}
            >
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Avg Confidence</span>
              <span className="text-xl font-bold font-mono text-amber-400 leading-none">84%</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {/* Mini donut progress bar */}
                <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: '84%' }} />
                </div>
              </div>
            </div>

            {/* Response Time */}
            <div
              className="flex flex-col gap-1.5 p-2.5 rounded-lg border"
              style={{ background: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.15)' }}
            >
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Resp. Time</span>
              <span className="text-xl font-bold font-mono text-green-400 leading-none">4.2h</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3 h-3 text-slate-500" />
                <span className="text-[8px] font-mono text-slate-500">Avg. containment</span>
              </div>
            </div>

          </div>
        </div>

      ) : (
        /* Agent Execution Log */
        <div
          className="rounded-xl border p-4 flex flex-col min-h-0"
          style={{ background: 'rgba(15,21,37,0.9)', borderColor: 'rgba(30,41,59,0.8)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold text-white tracking-widest font-mono flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> AGENT EXECUTION LOG
            </h3>
            {isRunning && (
              <span className="text-[8px] font-bold text-green-400 bg-green-950/60 border border-green-500/40 px-2 py-0.5 rounded-full font-mono animate-pulse">
                ● LIVE
              </span>
            )}
          </div>

          <div
            ref={logRef}
            className="flex-1 overflow-y-auto space-y-1 max-h-48"
            style={{ scrollbarWidth: 'thin' }}
          >
            <AnimatePresence initial={false}>
              {systemLog.map((entry, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-2 text-[9px] font-mono"
                >
                  <span className="text-slate-600 flex-shrink-0">{entry.ts}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-400">{entry.msg}</span>
                </motion.div>
              ))}
              {isRunning && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="flex gap-2 text-[9px] font-mono text-cyan-400"
                >
                  <span className="text-slate-600">{fmt(now)}</span>
                  <span>•</span>
                  <span>Processing...</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button className="mt-2 text-[9px] text-cyan-400 font-mono hover:text-cyan-300 transition-colors text-left">
            VIEW FULL LOG →
          </button>
        </div>
      )}
    </div>
  );
}
