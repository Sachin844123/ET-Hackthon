import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, Download, ChevronDown, ChevronUp, Skull, CalendarDays } from 'lucide-react';
import { useMitreLookup, prefetchTechniques } from '../hooks/useMitreLookup';
import AnimatedCounter from './AnimatedCounter';
import AnimatedGradientBorder from './AnimatedGradientBorder';

const SEVERITY_COLORS = {
  CRITICAL: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.5)', pulse: true },
  HIGH:     { color: '#f97316', bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.4)', pulse: true },
  MEDIUM:   { color: '#eab308', bg: 'rgba(234,179,8,0.10)', border: 'rgba(234,179,8,0.35)', pulse: false },
  LOW:      { color: '#06b6d4', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.3)', pulse: false },
};

export default function RetroactiveTimeline({ alerts = [], autopsyResult }) {
  const [expandedAlerts, setExpandedAlerts] = useState({});
  const [stageFilter, setStageFilter] = useState('ALL');

  const toggleExpand = (id) => setExpandedAlerts(prev => ({ ...prev, [id]: !prev[id] }));

  // Prefetch all MITRE IDs
  const techIds = [...new Set(alerts.map(a => a.mitre_technique_id).filter(Boolean))];

  useEffect(() => {
    prefetchTechniques(techIds);
  }, [techIds.join(',')]);

  const { getTechniqueName } = useMitreLookup(techIds);

  const sortedAlerts = [...alerts].sort((a, b) => b.days_before_incident - a.days_before_incident);
  const preventionAlerts = sortedAlerts.filter(a => a.would_have_prevented_breach);
  const earliestDetect = sortedAlerts[0] || null;
  const highConfAlert = sortedAlerts.find(a => a.confidence >= 0.8) || earliestDetect;
  const prevention = autopsyResult?.prevention_window_days
    ?? earliestDetect?.days_before_incident ?? 21;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-2">
          <select
            className="text-[10px] font-mono bg-transparent border rounded px-2 py-1.5 outline-none"
            style={{ borderColor: 'rgba(51,65,85,0.5)', color: '#94a3b8' }}
            defaultValue="2022-11-01 — 2022-11-22"
          >
            <option>2022-11-01 — 2022-11-22</option>
          </select>
          <select
            value={stageFilter}
            onChange={e => setStageFilter(e.target.value)}
            className="text-[10px] font-mono bg-transparent border rounded px-2 py-1.5 outline-none"
            style={{ borderColor: 'rgba(51,65,85,0.5)', color: '#94a3b8' }}
          >
            <option value="ALL">ALL STAGES</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
          </select>
        </div>
        <button className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 border border-slate-700/60 px-3 py-1.5 rounded hover:border-slate-600 transition-all">
          <Download className="w-3 h-3" /> EXPORT
        </button>
      </div>

      {/* ── Critical RANSOMWARE Banner ───────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="shrink-0 flex items-center gap-4 px-4 py-3 rounded-xl border mb-4"
        style={{
          background: 'rgba(239,68,68,0.08)',
          borderColor: 'rgba(239,68,68,0.4)',
          boxShadow: '0 0 20px rgba(239,68,68,0.06)',
        }}
      >
        <Skull className="w-5 h-5 text-red-500 shrink-0 animate-pulse" />
        <div>
          <div className="text-[11px] font-bold text-red-400 font-mono tracking-wider">
            RANSOMWARE DEPLOYED — ACTUAL HISTORICAL DISCOVERY
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Day 22 (T-0) · 284K patient records encrypted · System detected signals {prevention} days earlier
          </div>
        </div>
        <div className="ml-auto shrink-0">
          <span
            className="text-[9px] font-bold font-mono px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.5)' }}
          >
            T-0 BREACH
          </span>
        </div>
      </motion.div>

      {/* ── Horizontal Timeline Scale ────────────────────────────────── */}
      <div className="shrink-0 mb-4 relative px-4">
        <div className="relative h-6">
          {/* Base line */}
          <div
            className="absolute top-3 left-0 right-0 h-0.5 rounded"
            style={{ background: 'linear-gradient(90deg, #06b6d4 0%, #f59e0b 50%, #ef4444 85%, rgba(239,68,68,0.3) 100%)' }}
          />
          {/* Tick marks */}
          {['T-21', 'T-15', 'T-10', 'T-5', 'T-0'].map((t, i) => (
            <div
              key={t}
              className="absolute flex flex-col items-center"
              style={{ left: `${i * 25}%`, transform: 'translateX(-50%)' }}
            >
              <div className="w-px h-2.5 mt-1" style={{ background: t === 'T-0' ? '#ef4444' : '#475569' }} />
              <span className="text-[8px] font-mono mt-0.5" style={{ color: t === 'T-0' ? '#ef4444' : '#64748b' }}>
                {t}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden min-h-0">

        {/* ── Reconstruction Summary Card ──────────────────────────── */}
        <div className="shrink-0 w-56">
          <AnimatedGradientBorder borderRadius={12} colors={['#06b6d4', '#f59e0b', '#ef4444', '#06b6d4']} speed={5} glowIntensity={0.15}>
            <div className="p-4 rounded-xl" style={{ background: 'rgba(11,15,23,0.95)' }}>
              <h3 className="text-[9px] font-bold text-white tracking-widest mb-3 font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-sm bg-cyan-500 animate-pulse" />
                RECONSTRUCTION SUMMARY
              </h3>
              <div className="space-y-2.5 font-mono">
                {[
                  {
                    label: 'EARLIEST SIGNAL',
                    value: `T-${earliestDetect?.days_before_incident ?? 21} DAYS`,
                    color: '#06b6d4',
                    icon: '🔍',
                  },
                  {
                    label: 'HIGH CONFIDENCE',
                    value: `T-${highConfAlert?.days_before_incident ?? 19} DAYS`,
                    color: '#f59e0b',
                    icon: '⚡',
                  },
                  {
                    label: 'ACTUAL DISCOVERY',
                    value: 'T-0',
                    color: '#ef4444',
                    icon: '💀',
                  },
                  {
                    label: 'DAYS SAVED',
                    value: prevention,
                    color: '#22c55e',
                    icon: '🛡️',
                    counter: true,
                    bold: true,
                  },
                ].map(({ label, value, color, icon, counter, bold }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between border-b border-slate-800/50 pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px]">{icon}</span>
                      <span className="text-[9px] text-slate-500 tracking-wide">{label}</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${bold ? 'text-sm' : ''}`}
                      style={{ color, background: `${color}18` }}
                    >
                      {counter
                        ? <><AnimatedCounter end={value} duration={1800} delay={500} /> DAYS</>
                        : value
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedGradientBorder>
        </div>

        {/* ── Alert Events List ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {sortedAlerts
            .filter(a => stageFilter === 'ALL' || a.severity === stageFilter)
            .map((alert, idx) => {
              const sev = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.MEDIUM;
              const techName = getTechniqueName(alert.mitre_technique_id);
              const day = 22 - (alert.days_before_incident || 0);

              return (
                <motion.div
                  key={alert.alert_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * idx, type: 'spring', stiffness: 80 }}
                  className="rounded-xl border overflow-hidden"
                  style={{
                    background: 'rgba(15,21,37,0.9)',
                    borderColor: 'rgba(51,65,85,0.4)',
                  }}
                >
                  {/* Alert row header */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* T-value */}
                    <div className="w-20 shrink-0 text-center">
                      <div className="text-sm font-bold font-mono" style={{ color: sev.color }}>
                        T-{alert.days_before_incident}
                      </div>
                      <div className="text-[8px] font-mono text-slate-600">Day {day}</div>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-10 bg-slate-800/60 shrink-0" />

                    {/* Title + pills */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold text-slate-200 leading-tight mb-1 truncate">
                        {alert.description?.slice(0, 70) || 'Anomalous behavior detected'}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded"
                          style={{ color: sev.color, background: sev.bg, border: `1px solid ${sev.border}` }}
                        >
                          {alert.severity}
                        </span>
                        <span
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                          style={{ color: '#22d3ee', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)' }}
                        >
                          {alert.mitre_technique_id}
                        </span>
                        <span className="text-[9px] font-mono text-slate-500 truncate">
                          {techName}
                        </span>
                      </div>
                    </div>

                    {/* Confidence bar + badge */}
                    <div className="shrink-0 flex flex-col items-end gap-1.5 w-32">
                      <div className="text-[9px] font-mono text-slate-500">
                        {Math.round(alert.confidence * 100)}% CONF
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.8)' }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: sev.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${alert.confidence * 100}%` }}
                          transition={{ delay: 0.5 + idx * 0.1, duration: 0.8 }}
                        />
                      </div>
                    </div>

                    {/* Expand toggle */}
                    <button
                      onClick={() => toggleExpand(alert.alert_id)}
                      className="w-7 h-7 flex items-center justify-center rounded shrink-0 hover:bg-slate-800 transition-colors"
                    >
                      {expandedAlerts[alert.alert_id]
                        ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                        : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                      }
                    </button>
                  </div>

                  {/* Expanded evidence */}
                  <AnimatePresence>
                    {expandedAlerts[alert.alert_id] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t"
                        style={{ borderColor: 'rgba(30,41,59,0.8)' }}
                      >
                        <div className="px-4 py-3 space-y-3">
                          {/* Evidence list */}
                          {alert.evidence?.length > 0 && (
                            <div className="bg-[#03050a] rounded-lg p-3 font-mono text-[10px] text-slate-400 space-y-1">
                              {alert.evidence.map((ev, i) => (
                                <div key={i} className="flex gap-2">
                                  <span className="text-cyan-500">❯</span>
                                  <span>{ev}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Recommended action */}
                          <div
                            className="border-l-4 px-3 py-2 rounded-r text-[11px] font-mono"
                            style={{ borderColor: sev.color, background: `${sev.color}10` }}
                          >
                            <div className="text-[9px] font-bold tracking-widest mb-1 flex items-center gap-1.5" style={{ color: sev.color }}>
                              <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: sev.color }} />
                              RECOMMENDED ACTION
                            </div>
                            <span className="text-slate-300">{alert.recommended_action}</span>
                          </div>

                          {/* Prevention badge */}
                          <div
                            className="text-[9px] font-bold font-mono tracking-widest text-center py-1.5 rounded"
                            style={{
                              background: alert.would_have_prevented_breach ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                              color: alert.would_have_prevented_breach ? '#22c55e' : '#ef4444',
                            }}
                          >
                            {alert.would_have_prevented_breach
                              ? '✓ BREACH PREVENTABLE AT THIS STAGE'
                              : '⚠ DATA EXFILTRATION IMMINENT'}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

          {/* Day 22 marker */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="rounded-xl border p-4 text-center"
            style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.4)' }}
          >
            <Skull className="w-5 h-5 text-red-500 mx-auto mb-2 animate-pulse" />
            <div className="text-red-400 font-bold font-mono text-xs tracking-widest">RANSOMWARE DEPLOYED — T-0</div>
            <div className="text-slate-500 font-mono text-[10px] mt-1">Day 22 · The point where legacy tools finally alerted</div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
