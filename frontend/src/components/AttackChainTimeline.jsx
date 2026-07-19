import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ChevronRight, Download, ExternalLink, Info } from 'lucide-react';
import { KILL_CHAIN_STAGES, getStageByTactic, getStageByTechniqueId } from '../constants/killChain';
import { useMitreLookup, prefetchTechniques } from '../hooks/useMitreLookup';
import GlitchText from './GlitchText';


const AIIMS_DEMO_TIMELINE = [
  { day: 1, tValue: 'T-21', techniqueId: 'T1078', confidence: 0.73 },
  { day: 3, tValue: 'T-19', techniqueId: 'T1021.002', confidence: 0.81 },
  { day: 7, tValue: 'T-15', techniqueId: 'T1560.001', confidence: 0.94 },
  { day: 12, tValue: 'T-10', techniqueId: 'T1071.001', confidence: 0.99 },
  { day: 22, tValue: 'T-0', techniqueId: 'T1486', confidence: null },
];

export default function AttackChainTimeline({ autopsy_result }) {
  const [selectedStage, setSelectedStage] = useState(null);

  const ttps = autopsy_result?.ttp_attributions || [];
  const alerts = autopsy_result?.retroactive_alerts || [];
  const actor = autopsy_result?.actor_attribution?.actor_name || 'APT41';
  const actorConf = Math.round((autopsy_result?.actor_attribution?.confidence || 0.84) * 100);
  const campaign = autopsy_result?.actor_attribution?.campaign_match || 'OP DARK WARD';
  const prevention = autopsy_result?.prevention_window_days
    ?? alerts.reduce((max, a) => Math.max(max, a.days_before_incident || 0), 19);
  const totalDuration = autopsy_result?.incident_duration_days || 22;
  const totalAlerts = alerts.length || 4;

  // Prefetch all technique IDs
  const allTechIds = [
    ...ttps.map(t => t.technique_id),
    ...AIIMS_DEMO_TIMELINE.map(t => t.techniqueId),
  ].filter(Boolean);

  useEffect(() => {
    prefetchTechniques(allTechIds);
  }, [allTechIds.join(',')]);

  const { getTechniqueName } = useMitreLookup(allTechIds);

  // Map TTPs to stages
  const ttpsByStage = {};
  KILL_CHAIN_STAGES.forEach(s => { ttpsByStage[s.id] = []; });
  ttps.forEach(ttp => {
    const stage = getStageByTactic(ttp.tactic || '');
    if (stage) ttpsByStage[stage.id]?.push(ttp);
  });

  // Find alert for a stage
  const getAlertForStage = (stageId) => {
    const stageTtps = ttpsByStage[stageId] || [];
    for (const ttp of stageTtps) {
      const a = alerts.find(al => al.mitre_technique_id === ttp.technique_id);
      if (a) return a;
    }
    return null;
  };

  // Confidence bar segmented
  const confBars = Math.floor(actorConf / 10);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'transparent' }}>

      {/* ── Attribution Summary Bar ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="shrink-0 flex flex-wrap items-center justify-between gap-4 px-4 py-3 rounded-xl border mb-4"
        style={{
          background: 'rgba(15,21,37,0.9)',
          borderColor: 'rgba(239,68,68,0.3)',
          boxShadow: '0 0 20px rgba(239,68,68,0.06)',
        }}
      >
        {/* Attributed To */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] text-slate-500 font-mono tracking-widest">ATTRIBUTED TO</span>
          <span className="text-red-400 font-bold font-mono text-sm tracking-widest" style={{ textShadow: '0 0 10px rgba(239,68,68,0.5)' }}>
            <GlitchText text={actor} delay={400} />
          </span>
        </div>

        {/* Confidence */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] text-slate-500 font-mono tracking-widest">CONFIDENCE</span>
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="w-3 h-2.5 rounded-sm transition-all"
                  style={{
                    background: i < confBars
                      ? actorConf >= 80 ? '#ef4444' : '#f59e0b'
                      : 'rgba(51,65,85,0.5)',
                    boxShadow: i < confBars && actorConf >= 80
                      ? '0 0 6px rgba(239,68,68,0.5)' : 'none',
                  }}
                />
              ))}
            </div>
            <span className="text-amber-400 font-bold font-mono text-sm">{actorConf}%</span>
          </div>
        </div>

        {/* Campaign */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] text-slate-500 font-mono tracking-widest">CAMPAIGN</span>
          <span className="text-cyan-400 font-mono text-sm font-bold tracking-widest">
            <GlitchText text={campaign} delay={800} />
          </span>
        </div>

        {/* Last Updated */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] text-slate-500 font-mono tracking-widest">LAST UPDATED</span>
          <span className="text-slate-300 font-mono text-xs">
            {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </motion.div>

      {/* ── Prevention Window Banner ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="shrink-0 flex items-center justify-between px-4 py-2.5 rounded-xl border mb-4"
        style={{
          background: 'rgba(16,185,129,0.08)',
          borderColor: 'rgba(34,197,94,0.4)',
          boxShadow: '0 0 20px rgba(34,197,94,0.06)',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 font-bold font-mono text-sm tracking-widest">
            {prevention}-DAY PREVENTION WINDOW
          </span>
          <span className="text-[10px] text-green-600 font-mono">
            — System flagged Day 3 with {'>'}80% confidence. Breach avoidable.
          </span>
        </div>
        <div className="flex gap-2">
          <button className="text-[10px] font-mono text-green-400 hover:text-green-300 border border-green-500/40 px-3 py-1.5 rounded hover:border-green-400/70 transition-all">
            VIEW DETAILS
          </button>
          <button className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-slate-300 border border-slate-700/60 px-3 py-1.5 rounded transition-all">
            <Download className="w-3 h-3" /> EXPORT REPORT
          </button>
        </div>
      </motion.div>

      {/* ── Kill Chain Stage Row ─────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden relative" style={{ minHeight: 0 }}>
        <div className="relative flex gap-0 min-w-max p-2 pb-14 h-full">

          {/* Connecting line */}
          <motion.div
            className="absolute"
            style={{ top: '90px', left: '24px', right: '24px', height: '2px', background: 'linear-gradient(90deg, rgba(6,182,212,0.3), rgba(239,68,68,0.6))' }}
            initial={{ scaleX: 0, transformOrigin: 'left' }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.2, delay: 0.5 }}
          />

          {KILL_CHAIN_STAGES.map((stage, idx) => {
            const phaseAlerts = alerts.filter(a => {
              const s = getStageByTactic(a.alert_type || a.mitre_technique_id || '');
              return s?.id === stage.id;
            });
            const stageTtps = ttpsByStage[stage.id] || [];
            const stageAlert = phaseAlerts[0] || null;
            const hasData = stageTtps.length > 0 || stageAlert !== null;
            const isImpact = stage.id === 'impact';

            // Demo timeline pin — use technique-ID based lookup (not tactic)
            const demoPin = AIIMS_DEMO_TIMELINE.find(d =>
              getStageByTechniqueId(d.techniqueId)?.id === stage.id
            ) || null;
            const detectedConf = stageAlert?.confidence ?? demoPin?.confidence ?? null;

            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + idx * 0.1, type: 'spring', stiffness: 80 }}
                className="flex-1 min-w-[170px] max-w-[200px] flex flex-col items-center relative"
                onClick={() => setSelectedStage(selectedStage?.id === stage.id ? null : stage)}
              >
                {/* Alert detected badge */}
                <div className="h-14 flex items-end justify-center mb-2 w-full">
                  <AnimatePresence>
                    {stageAlert && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.8 + idx * 0.08, type: 'spring' }}
                        className="flex flex-col items-center cursor-pointer group"
                      >
                        <div
                          className="text-[9px] font-bold px-2.5 py-1 rounded-full mb-1 flex items-center gap-1 font-mono tracking-wider"
                          style={{
                            background: 'rgba(6,182,212,0.15)',
                            border: '1px solid rgba(6,182,212,0.5)',
                            color: '#22d3ee',
                            boxShadow: '0 0 10px rgba(6,182,212,0.25)',
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                          DETECTED
                        </div>
                        <div className="text-[9px] text-cyan-300/80 font-mono text-center leading-tight">
                          {stageAlert.time_before_incident}<br />
                          {Math.round(stageAlert.confidence * 100)}% CONF
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Stage Icon */}
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center relative cursor-pointer transition-all duration-300"
                  style={{
                    background: hasData ? stage.bgColor : 'rgba(15,21,37,0.8)',
                    border: `2px solid ${hasData ? stage.borderColor : 'rgba(51,65,85,0.4)'}`,
                    boxShadow: isImpact
                      ? '0 0 20px rgba(239,68,68,0.4)'
                      : hasData
                      ? `0 0 12px ${stage.color}30`
                      : 'none',
                    transform: selectedStage?.id === stage.id ? 'scale(1.12)' : 'scale(1)',
                  }}
                >
                  <stage.icon
                    className="w-7 h-7"
                    style={{ color: hasData ? stage.color : '#334155' }}
                  />
                  {isImpact && (
                    <motion.div
                      className="absolute inset-0 rounded-xl border-2 border-red-500"
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                </div>

                {/* Stage label */}
                <div
                  className="text-[9px] tracking-widest font-bold text-center px-1 mt-3 mb-1 font-mono"
                  style={{ color: hasData ? stage.color : '#475569' }}
                >
                  {stage.shortLabel}
                </div>

                {/* Day marker */}
                {demoPin && (
                  <div
                    className="text-[8px] font-mono text-center"
                    style={{ color: hasData ? `${stage.color}99` : '#334155' }}
                  >
                    Day {demoPin.day} ({demoPin.tValue})
                  </div>
                )}

                {/* TTP Cards (collapsed unless selected) */}
                <div className="flex flex-col gap-2 mt-3 w-full px-1">
                  <AnimatePresence>
                    {stageTtps.length > 0 ? (
                      stageTtps.map((ttp) => (
                        <motion.div
                          key={ttp.technique_id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          transition={{ duration: 0.25 }}
                          className="rounded-lg p-2 border"
                          style={{
                            background: 'rgba(15,21,37,0.9)',
                            borderLeft: `3px solid ${ttp.confidence > 0.8 ? '#ef4444' : '#f59e0b'}`,
                            borderTop: '1px solid rgba(51,65,85,0.4)',
                            borderRight: '1px solid rgba(51,65,85,0.4)',
                            borderBottom: '1px solid rgba(51,65,85,0.4)',
                          }}
                        >
                          <div className="text-[9px] font-bold font-mono text-cyan-400 mb-0.5">{ttp.technique_id}</div>
                          <div className="text-[10px] text-slate-300 leading-tight mb-1">
                            {getTechniqueName(ttp.technique_id)}
                          </div>
                          <div className="flex items-center justify-between text-[8px] font-mono border-t border-slate-800/60 pt-1 mt-1">
                            <span className="text-slate-600">CONF</span>
                            <span style={{ color: ttp.confidence > 0.8 ? '#ef4444' : '#f59e0b', fontWeight: 'bold' }}>
                              {Math.round(ttp.confidence * 100)}%
                            </span>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      /* Empty state placeholder */
                      <div
                        className="rounded-lg p-3 flex flex-col items-center justify-center gap-1.5"
                        style={{
                          background: 'rgba(15,21,37,0.4)',
                          border: '1px dashed rgba(51,65,85,0.35)',
                          minHeight: '60px',
                        }}
                      >
                        <Shield className="w-4 h-4" style={{ color: 'rgba(71,85,105,0.4)' }} />
                        <span className="text-[8px] font-mono tracking-wider" style={{ color: 'rgba(71,85,105,0.6)' }}>NO TTPs DETECTED</span>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Day axis at bottom */}
        <div className="absolute bottom-2 left-0 right-0 flex justify-between px-12 text-[9px] font-mono text-slate-700 tracking-wider">
          <span>Day 1 (T-21)</span>
          <span>Day 7 (T-15)</span>
          <span>Day 14 (T-8)</span>
          <span className="text-red-600/80 font-bold">Day 22 (T-0)</span>
        </div>
      </div>

      {/* ── Bottom Stat Strip ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="shrink-0 grid grid-cols-5 gap-px mt-4"
        style={{
          background: 'rgba(30,41,59,0.25)',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid rgba(30,41,59,0.5)',
        }}
      >
        {[
          { label: 'TOTAL DURATION', value: `${totalDuration} DAYS`, color: '#94a3b8' },
          { label: 'CONTAINED BEFORE IMPACT', value: prevention > 0 ? 'YES' : 'NO', color: prevention > 0 ? '#22c55e' : '#ef4444' },
          { label: 'ATTACK COMPLETION', value: '100%', color: '#ef4444' },
          { label: 'TOTAL ALERTS', value: totalAlerts, color: '#06b6d4' },
          { label: 'RESPONSE TIME', value: `T-${prevention} DAYS`, color: '#f59e0b' },
        ].map(({ label, value, color }, i) => (
          <div
            key={label}
            className="text-center py-3.5 px-3"
            style={{
              background: 'rgba(15,21,37,0.85)',
              borderRight: i < 4 ? '1px solid rgba(30,41,59,0.5)' : 'none',
            }}
          >
            <div className="font-mono text-sm font-bold mb-1" style={{ color, textShadow: `0 0 10px ${color}30` }}>{value}</div>
            <div className="text-[8px] font-mono tracking-widest" style={{ color: 'rgba(100,116,139,0.7)' }}>{label}</div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
