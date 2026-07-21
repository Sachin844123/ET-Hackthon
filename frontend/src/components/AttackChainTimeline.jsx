import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ChevronRight, Download, ExternalLink, Info, Skull, Calendar, ShieldCheck, Target, Bell, Flag, XOctagon, Server, Database, TrendingUp, Clock, AlertOctagon } from 'lucide-react';
import { KILL_CHAIN_STAGES, getStageByTactic, getStageByTechniqueId } from '../constants/killChain';
import { useMitreLookup, prefetchTechniques } from '../hooks/useMitreLookup';
import GlitchText from './GlitchText';


const AIIMS_DEMO_TIMELINE = [
  { day: 1, tValue: 'T-21', techniqueId: 'T1078', confidence: 0.73, timeStr: '10:12 AM' },
  { day: 1, tValue: 'T-21', techniqueId: 'T1059.001', confidence: 0.68, timeStr: '11:02 AM' },
  { day: 1, tValue: 'T-21', techniqueId: 'T1547.001', confidence: 0.81, timeStr: '11:47 AM' },
  { day: 2, tValue: 'T-20', techniqueId: 'T1068', confidence: 0.76, timeStr: '09:21 AM' },
  { day: 3, tValue: 'T-19', techniqueId: 'T1021.002', confidence: 0.84, timeStr: '02:14 PM' },
  { day: 3, tValue: 'T-19', techniqueId: 'T1005', confidence: 0.69, timeStr: '03:11 PM' },
  { day: 4, tValue: 'T-18', techniqueId: 'T1071.001', confidence: null, timeStr: '12:18 AM' },
  { day: 22, tValue: 'T-0', techniqueId: 'T1486', confidence: 0.91, timeStr: '07:30 AM' },
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
  const incidentId = autopsy_result?.incident_id || 'aiims_2022';
  const isCbse = incidentId.includes('cbse');
  const targetName = isCbse ? 'CBSE Result Portal' : 'AIIMS Delhi';
  const envName = isCbse ? 'Cloud Server + Database' : 'Windows AD + On-Prem';
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
  const displayStages = KILL_CHAIN_STAGES.filter(s => s.id !== 'defense-evasion');

  // Find alert for a stage
  const getAlertForStage = (stageId) => {
    const stageTtps = ttpsByStage[stageId] || [];
    for (const ttp of stageTtps) {
      const a = alerts.find(al => al.mitre_technique_id === ttp.technique_id);
      if (a) return a;
    }
    return null;
  };

  const confBars = Math.floor(actorConf / 10);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'transparent' }}>

      {/* ── Premium Header Autopsy Dashboard ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="shrink-0 mb-6"
        style={{
          background: 'rgba(9, 13, 23, 0.75)',
          borderColor: 'rgba(255, 255, 255, 0.05)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          padding: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'stretch',
          gap: '24px',
          flexWrap: 'wrap',
        }}
      >
        {/* Campaign Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: '1 1 auto', minWidth: '300px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="shrink-0 relative" style={{
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(239, 68, 68, 0.8)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.25)',
            }}>
              <XOctagon className="w-7 h-7 text-red-500" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">CAMPAIGN</span>
              <h1 className="font-bold text-white tracking-wide mt-0.5 font-display" style={{ fontSize: '22px', margin: 0 }}>
                {isCbse ? 'Operation CBSE Leak (2026)' : 'Operation Dark Ward (2022)'}
              </h1>
              <span className="text-xs text-slate-400 font-sans mt-0.5">AI-Powered Retrospective Attack Analysis</span>
            </div>
          </div>

          {/* Sub-details Row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace' }}>
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>{isCbse ? 'Jun 12, 2026 16:15:30' : 'May 14, 2022 18:24:41'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace' }}>
              <Target className="w-4 h-4 text-slate-500" />
              <span>Target <span className="text-white">{targetName}</span></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace' }}>
              <Server className="w-4 h-4 text-slate-500" />
              <span>Environment <span className="text-white">{envName}</span></span>
            </div>
          </div>
        </div>

        {/* Confidence Block */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          paddingLeft: '24px',
          gap: '4px',
          minWidth: '180px',
        }}>
          <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">CONFIDENCE</span>
          <span className="text-3xl font-bold font-mono text-red-500" style={{ fontSize: '28px', textShadow: '0 0 15px rgba(239, 68, 68, 0.4)' }}>
            {actorConf}%
          </span>
          <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: '14px',
                  height: '10px',
                  borderRadius: '2px',
                  background: i < Math.floor(actorConf / 10) ? '#ef4444' : '#1e293b',
                  boxShadow: i < Math.floor(actorConf / 10) ? '0 0 8px rgba(239, 68, 68, 0.6)' : 'none',
                }}
              />
            ))}
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-2">Detected on Day 3</span>
        </div>

        {/* Last Updated & Actions */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          paddingLeft: '24px',
          minWidth: '180px',
          minHeight: '84px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">LAST UPDATED</span>
            <span className="text-xs text-slate-300 font-mono">
              {isCbse ? 'Jun 12, 2026 - 16:15 PM' : 'May 14, 2022 - 18:24 AM'}
            </span>
          </div>

          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: '#d1d5db',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: 'rgba(9, 13, 23, 0.5)',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = '#d1d5db';
            }}
          >
            <Download className="w-4 h-4" /> EXPORT REPORT
          </button>
        </div>
      </motion.div>

      {/* ── Prevention Window Banner ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="shrink-0 flex items-center justify-between px-6 py-4 rounded-2xl border mb-6"
        style={{
          background: 'rgba(16,185,129,0.03)',
          borderColor: 'rgba(16,185,129,0.3)',
          boxShadow: '0 0 20px rgba(16,185,129,0.02)',
        }}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center border border-emerald-500/40 bg-emerald-950/20 shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-500 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-emerald-400 font-bold font-mono text-sm tracking-wider">
              {prevention}-DAY PREVENTION WINDOW
            </span>
            <span className="text-xs text-slate-400 mt-0.5">
              System flagged Day 3 with &gt;80% confidence. Breach avoidable.
            </span>
          </div>
        </div>
        <div>
          <button className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-950/10 px-4 py-2 rounded-lg transition-all">
            VIEW DETAILS <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>

      {/* ── Kill Chain Stage Row ─────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden relative mt-4" style={{ minHeight: 0 }}>
        <div className="relative flex gap-0 min-w-max p-2 pb-14 h-full">

          {/* Connecting line segments with glow dots */}
          {displayStages.map((stage, idx) => {
            if (idx === displayStages.length - 1) return null;
            const nextStage = displayStages[idx + 1];
            // Check if there is data in either this stage or the next stage to style the track active
            const hasDataCurrent = (ttpsByStage[stage.id]?.length > 0) || (alerts.some(a => getStageByTactic(a.alert_type || a.mitre_technique_id || '')?.id === stage.id)) || AIIMS_DEMO_TIMELINE.some(d => getStageByTechniqueId(d.techniqueId)?.id === stage.id);
            const hasDataNext = (ttpsByStage[nextStage.id]?.length > 0) || (alerts.some(a => getStageByTactic(a.alert_type || a.mitre_technique_id || '')?.id === nextStage.id)) || AIIMS_DEMO_TIMELINE.some(d => getStageByTechniqueId(d.techniqueId)?.id === nextStage.id);
            const isLineActive = hasDataCurrent && hasDataNext;

            return (
              <div
                key={`line-${stage.id}`}
                className="absolute pointer-events-none"
                style={{
                  top: '96px',
                  left: `calc(${(idx * 100) / displayStages.length}% + ${100 / (displayStages.length * 2)}%)`,
                  width: `${100 / displayStages.length}%`,
                  height: '2.5px',
                  background: isLineActive
                    ? `linear-gradient(90deg, ${stage.color}, ${nextStage.color})`
                    : 'rgba(51, 65, 85, 0.25)',
                  zIndex: 0,
                }}
              >
                {/* Glow Dot */}
                <div
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: isLineActive ? '#ffffff' : '#334155',
                    boxShadow: isLineActive
                      ? `0 0 10px #ffffff, 0 0 5px ${stage.color}`
                      : 'none',
                  }}
                />
              </div>
            );
          })}

          {displayStages.map((stage, idx) => {
            const phaseAlerts = alerts.filter(a => {
              const s = getStageByTactic(a.alert_type || a.mitre_technique_id || '');
              return s?.id === stage.id;
            });
            const stageTtps = ttpsByStage[stage.id] || [];
            const stageAlert = phaseAlerts[0] || null;
            const hasData = stageTtps.length > 0 || stageAlert !== null || AIIMS_DEMO_TIMELINE.some(d => getStageByTechniqueId(d.techniqueId)?.id === stage.id);
            const isImpact = stage.id === 'impact';

            // Demo timeline pin — use technique-ID based lookup
            const demoPin = AIIMS_DEMO_TIMELINE.find(d =>
              getStageByTechniqueId(d.techniqueId)?.id === stage.id
            ) || null;

            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + idx * 0.1, type: 'spring', stiffness: 80 }}
                className="flex-1 min-w-[170px] max-w-[200px] flex flex-col items-center relative z-10"
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
                  className="w-16 h-16 rounded-full flex items-center justify-center relative cursor-pointer transition-all duration-300"
                  style={{
                    background: hasData ? stage.bgColor : 'rgba(15,21,37,0.8)',
                    border: `2px solid ${hasData ? stage.borderColor : 'rgba(51,65,85,0.4)'}`,
                    boxShadow: isImpact
                      ? '0 0 20px rgba(239,68,68,0.4)'
                      : hasData
                        ? `0 0 12px ${stage.color}40`
                        : 'none',
                    transform: selectedStage?.id === stage.id ? 'scale(1.12)' : 'scale(1)',
                    zIndex: 2,
                  }}
                >
                  <stage.icon
                    className="w-7 h-7"
                    style={{ color: hasData ? stage.color : '#334155' }}
                  />
                  {isImpact && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-red-500"
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                </div>

                {/* Stage label */}
                <div
                  className="text-[10px] tracking-widest font-bold text-center px-1 mt-3 mb-1 font-mono uppercase"
                  style={{ color: hasData ? stage.color : '#475569' }}
                >
                  {stage.shortLabel}
                </div>

                {/* Day marker */}
                {demoPin && (
                  <div
                    className="text-[10px] font-mono text-center mt-1"
                    style={{ color: hasData ? '#94a3b8' : '#334155' }}
                  >
                    Day {demoPin.day} <span className="text-slate-500">{demoPin.timeStr}</span>
                  </div>
                )}

                {/* TTP Cards */}
                <div className="flex flex-col gap-2 mt-4 w-full px-1">
                  {stageTtps.length > 0 ? (
                    stageTtps.map((ttp) => {
                      const conf = Math.round((ttp.confidence || 0.75) * 100);
                      return (
                        <div
                          key={ttp.technique_id}
                          className="w-full rounded-xl p-3 border font-mono flex flex-col justify-between"
                          style={{
                            background: 'rgba(9, 13, 23, 0.65)',
                            borderColor: 'rgba(255, 255, 255, 0.05)',
                            minHeight: '82px',
                          }}
                        >
                          <div>
                            <span className="text-[10px] font-bold tracking-wider" style={{ color: stage.color }}>
                              {ttp.technique_id}
                            </span>
                            <div className="text-[10px] text-slate-300 font-sans leading-tight mt-1 mb-3 font-semibold truncate">
                              {getTechniqueName(ttp.technique_id) || 'Threat Indicator'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-auto">
                            <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${conf}%`,
                                  background: stage.color,
                                  boxShadow: `0 0 6px ${stage.color}aa`,
                                }}
                              />
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 font-mono">
                              {conf}%
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : demoPin && demoPin.confidence !== null ? (
                    /* Fallback to high fidelity demo TTP if simulation data is not yet fully populated */
                    <div
                      className="w-full rounded-xl p-3 border font-mono flex flex-col justify-between"
                      style={{
                        background: 'rgba(9, 13, 23, 0.65)',
                        borderColor: 'rgba(255, 255, 255, 0.05)',
                        minHeight: '82px',
                      }}
                    >
                      <div>
                        <span className="text-[10px] font-bold tracking-wider" style={{ color: stage.color }}>
                          {demoPin.techniqueId}
                        </span>
                        <div className="text-[10px] text-slate-300 font-sans leading-tight mt-1 mb-3 font-semibold truncate">
                          {getTechniqueName(demoPin.techniqueId) || 'Threat Indicator'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-auto">
                        <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.round(demoPin.confidence * 100)}%`,
                              background: stage.color,
                              boxShadow: `0 0 6px ${stage.color}aa`,
                            }}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 font-mono">
                          {Math.round(demoPin.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* Empty state placeholder */
                    <div
                      className="w-full rounded-xl p-3 border font-mono flex flex-col justify-center items-center gap-1"
                      style={{
                        background: 'rgba(9, 13, 23, 0.35)',
                        borderColor: 'rgba(255, 255, 255, 0.03)',
                        minHeight: '82px',
                      }}
                    >
                      <span className="text-[9px] font-bold text-slate-600">No TTP Detected</span>
                      <span className="text-[10px] text-slate-500">—</span>
                    </div>
                  )}
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
        className="shrink-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px mt-6"
        style={{
          background: 'rgba(30,41,59,0.15)',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.03)',
        }}
      >
        {[
          { icon: Calendar, label: 'TOTAL DURATION', value: `${totalDuration} DAYS`, subtext: isCbse ? 'Jun 12 - Jul 04, 2026' : 'May 14 - Jun 04, 2022', color: '#38bdf8' },
          { icon: ShieldCheck, label: 'CONTAINED BEFORE IMPACT', value: 'YES', subtext: 'Attack disrupted', color: '#10b981' },
          { icon: Target, label: 'ATTACK COMPLETION', value: '67%', subtext: '6 of 9 stages detected', color: '#ef4444' },
          { icon: Bell, label: 'TOTAL ALERTS', value: totalAlerts || 7, subtext: 'Across all stages', color: '#a855f7' },
          { icon: Clock, label: 'RESPONSE TIME', value: '4.2 HOURS', subtext: 'Avg. containment time', color: '#06b6d4' },
          { icon: Shield, label: 'STATUS', value: 'CONTAINED', subtext: 'No further activity detected', color: '#10b981' },
        ].map(({ icon: Icon, label, value, subtext, color }, i) => (
          <div
            key={label}
            className="flex items-center gap-3 py-4 px-5"
            style={{
              background: 'rgba(9, 13, 23, 0.75)',
              borderRight: i < 5 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
            }}
          >
            <div className="shrink-0">
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[7.5px] font-mono tracking-widest text-slate-500 uppercase truncate">{label}</span>
              <span className="font-mono text-sm font-bold text-white my-0.5" style={{ textShadow: `0 0 10px ${color}20` }}>{value}</span>
              <span className="text-[8px] font-mono text-slate-400 truncate">{subtext}</span>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
