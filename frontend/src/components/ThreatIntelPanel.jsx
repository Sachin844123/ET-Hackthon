import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Target, ExternalLink, Shield } from 'lucide-react';
import { THREAT_FEED_ITEMS } from '../constants/threatFeed';
import { useMitreLookup, prefetchTechniques } from '../hooks/useMitreLookup';
import ThreatFeedItem from './ThreatFeedItem';
import GlitchText from './GlitchText';

const CERT_IN_ADVISORIES = [
  {
    id: 'CIAD-2022-0041',
    date: '2022-11-23',
    severity: 'HIGH',
    title: 'Ransomware Targeting Healthcare Sector — Immediate Action Required',
    iocs: ['185.220.101.47', 'update.microsofft.com', 'svhost32.exe'],
    itActSection: '70B(6)(ii)',
  },
  {
    id: 'CIAD-2022-0038',
    date: '2022-10-15',
    severity: 'MEDIUM',
    title: 'APT41 Active Exploitation — Valid Account Abuse via Service Accounts',
    iocs: ['svc_backup$', 'T1078', 'port:445'],
    itActSection: '70B(6)(iii)',
  },
  {
    id: 'NCIIPC-2022-HC-002',
    date: '2022-09-30',
    severity: 'HIGH',
    title: 'CNI Healthcare Sector Alert — C2 Beaconing via DNS Jitter Pattern',
    iocs: ['T1071.001', '300s±45s jitter'],
    itActSection: '70B(6)(i)',
  },
];

const ACTOR_SECTORS = ['Healthcare', 'Finance', 'Defence', 'Education'];
const ACTOR_ALIASES = ['Double Dragon', 'Winnti Group', 'Barium', 'Wicked Panda'];

export default function ThreatIntelPanel({ actor_attribution, predicted_ttps = [], autopsyResult }) {
  const actor = actor_attribution || { actor_name: 'APT41', confidence: 0.84, campaign_match: 'OP DARK WARD' };
  const confPct = Math.round((actor.confidence || 0.84) * 100);

  // Merge predicted TTPs from multiple sources
  const predTtps = (() => {
    const fromResult = autopsyResult?.ttp_attributions?.slice(0, 3) || [];
    const fromProp = predicted_ttps?.slice(0, 3) || [];
    const merged = [...fromResult, ...fromProp].slice(0, 3);
    return merged.length > 0 ? merged : [
      { technique_id: 'T1078', confidence: 0.91, tactic: 'Initial Access' },
      { technique_id: 'T1021.002', confidence: 0.85, tactic: 'Lateral Movement' },
      { technique_id: 'T1486', confidence: 0.78, tactic: 'Impact' },
    ];
  })();

  const techIds = predTtps.map(t => t.technique_id).filter(Boolean);

  // Prefetch in effect to avoid side-effects during render
  useEffect(() => {
    prefetchTechniques(techIds);
  }, [techIds.join(',')]);

  const { getTechnique } = useMitreLookup(techIds);

  // Summary stats from autopsyResult
  const totalTtps = autopsyResult?.ttp_attributions?.length || 12;
  const totalIocs = autopsyResult?.retroactive_alerts?.length || 28;
  const totalCampaigns = 2;
  const cvssScore = 9.4;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Top row: 4 stat tiles ───────────────────────────────────── */}
      <div className="shrink-0 grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'TOTAL TTPs', value: totalTtps, color: '#06b6d4' },
          { label: 'IOCs EXTRACTED', value: totalIocs, color: '#f59e0b' },
          { label: 'CAMPAIGNS', value: totalCampaigns, color: '#a855f7' },
          { label: 'CVSS SCORE', value: cvssScore.toFixed(1), color: '#ef4444' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl border p-3 text-center"
            style={{ background: 'rgba(15,21,37,0.9)', borderColor: 'rgba(30,41,59,0.8)' }}
          >
            <div className="font-mono text-xl font-bold" style={{ color }}>{value}</div>
            <div className="text-[8px] font-mono text-slate-600 tracking-widest mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Middle section: 3 columns ───────────────────────────────── */}
      <div className="flex gap-4 flex-1 overflow-hidden min-h-0">

        {/* Column 1: Actor Attribution */}
        <div
          className="w-56 shrink-0 rounded-xl border flex flex-col overflow-hidden"
          style={{ background: 'rgba(15,21,37,0.9)', borderColor: 'rgba(239,68,68,0.3)' }}
        >
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'rgba(30,41,59,0.8)', background: 'rgba(11,15,23,0.6)' }}>
            <Target className="w-4 h-4 text-red-500 animate-pulse" />
            <h3 className="text-[10px] font-bold text-white tracking-widest font-mono">ACTOR ATTRIBUTION</h3>
          </div>

          <div className="flex-1 p-4 flex flex-col items-center overflow-y-auto">
            {/* Circular progress ring */}
            <div className="relative w-32 h-32 mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(30,41,59,0.8)" strokeWidth={5} />
                <defs>
                  <filter id="ti-glow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
                <motion.circle
                  cx="50" cy="50" r="44"
                  fill="none"
                  stroke={confPct >= 80 ? '#ef4444' : '#f59e0b'}
                  strokeWidth={6}
                  strokeLinecap="round"
                  filter="url(#ti-glow)"
                  initial={{ strokeDasharray: '276.5', strokeDashoffset: 276.5 }}
                  animate={{ strokeDashoffset: 276.5 - (276.5 * confPct) / 100 }}
                  transition={{ duration: 2, delay: 0.3, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-2xl font-black" style={{ color: confPct >= 80 ? '#ef4444' : '#f59e0b' }}>
                  {confPct}%
                </span>
                <span className="text-[8px] font-mono text-slate-500 tracking-widest">MATCH</span>
              </div>
            </div>

            {/* Actor name */}
            <div className="font-mono text-lg font-black text-white text-center mb-1" style={{ textShadow: '0 0 15px rgba(239,68,68,0.5)' }}>
              <GlitchText text={actor.actor_name} delay={500} />
            </div>
            <div className="text-[9px] font-mono text-slate-500 mb-4">NATION-STATE THREAT ACTOR</div>

            {/* Aliases */}
            <div className="w-full mb-3">
              <div className="text-[8px] font-mono text-slate-600 tracking-widest mb-1.5">KNOWN ALIASES</div>
              <div className="flex flex-wrap gap-1">
                {ACTOR_ALIASES.map(a => (
                  <span key={a} className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {a}
                  </span>
                ))}
              </div>
            </div>

            {/* Target sectors */}
            <div className="w-full">
              <div className="text-[8px] font-mono text-slate-600 tracking-widest mb-1.5">TARGET SECTORS</div>
              <div className="flex flex-wrap gap-1">
                {ACTOR_SECTORS.map(s => (
                  <span key={s} className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Predicted TTP Forecast */}
        <div
          className="flex-1 rounded-xl border flex flex-col overflow-hidden"
          style={{ background: 'rgba(15,21,37,0.9)', borderColor: 'rgba(30,41,59,0.8)' }}
        >
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'rgba(30,41,59,0.8)', background: 'rgba(11,15,23,0.6)' }}>
            <Shield className="w-4 h-4 text-purple-400" />
            <h3 className="text-[10px] font-bold text-white tracking-widest font-mono">PREDICTED TTP FORECAST</h3>
          </div>

          <div className="flex-1 p-4 space-y-3 overflow-y-auto">
            {predTtps.map((ttp, i) => {
              const tech = getTechnique(ttp.technique_id);
              const conf = Math.round((ttp.confidence || 0.7 - i * 0.07) * 100);

              return (
                <motion.div
                  key={ttp.technique_id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, type: 'spring' }}
                  className="rounded-xl border p-4"
                  style={{
                    background: 'rgba(11,15,23,0.8)',
                    borderColor: conf >= 85 ? 'rgba(239,68,68,0.3)' : conf >= 75 ? 'rgba(245,158,11,0.3)' : 'rgba(51,65,85,0.4)',
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-mono text-[10px] font-bold text-cyan-400 mb-0.5">{ttp.technique_id}</div>
                      <div className="text-sm font-bold text-white">
                        {tech?.name || ttp.technique_id}
                      </div>
                      <div className="text-[9px] font-mono text-slate-500 mt-0.5">{tech?.tactic || ttp.tactic}</div>
                    </div>
                    <div
                      className="font-mono text-xl font-black shrink-0 ml-3"
                      style={{ color: conf >= 85 ? '#ef4444' : conf >= 75 ? '#f59e0b' : '#06b6d4' }}
                    >
                      {conf}%
                    </div>
                  </div>

                  {/* Probability bar */}
                  <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(30,41,59,0.8)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: conf >= 85 ? '#ef4444' : conf >= 75 ? '#f59e0b' : '#06b6d4' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${conf}%` }}
                      transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }}
                    />
                  </div>

                  {/* Defensive response */}
                  {tech?.description && (
                    <div className="text-[9px] font-mono text-slate-500 border-t border-slate-800/50 pt-2 mt-1">
                      <span className="text-amber-500 font-bold">⚡ DEFENSE: </span>
                      {tech.description}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Column 3: CERT-IN Directives */}
        <div
          className="w-64 shrink-0 rounded-xl border flex flex-col overflow-hidden"
          style={{ background: 'rgba(15,21,37,0.9)', borderColor: 'rgba(30,41,59,0.8)' }}
        >
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'rgba(30,41,59,0.8)', background: 'rgba(11,15,23,0.6)' }}>
            <Shield className="w-4 h-4 text-green-400" />
            <h3 className="text-[10px] font-bold text-white tracking-widest font-mono">CERT-IN DIRECTIVES</h3>
          </div>

          <div className="flex-1 p-4 space-y-3 overflow-y-auto">
            {CERT_IN_ADVISORIES.map((adv, i) => (
              <div
                key={adv.id}
                className="rounded-xl border p-3"
                style={{
                  background: 'rgba(11,15,23,0.8)',
                  borderColor: adv.severity === 'HIGH' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)',
                }}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span
                    className="text-[8px] font-bold font-mono px-1.5 py-0.5 rounded"
                    style={{
                      color: adv.severity === 'HIGH' ? '#ef4444' : '#f59e0b',
                      background: adv.severity === 'HIGH' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)',
                    }}
                  >
                    {adv.severity}
                  </span>
                  <span className="text-[8px] font-mono text-slate-600">{adv.id}</span>
                </div>
                <p className="text-[10px] font-medium text-slate-300 leading-tight mb-2">{adv.title}</p>
                <div className="flex flex-wrap gap-1">
                  {adv.iocs.slice(0, 2).map(ioc => (
                    <span key={ioc} className="text-[7px] font-mono px-1 py-0.5 rounded text-slate-500" style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(51,65,85,0.4)' }}>
                      {ioc}
                    </span>
                  ))}
                </div>
                <div className="mt-2 text-[8px] font-mono text-slate-600">IT Act §{adv.itActSection}</div>
              </div>
            ))}

            {/* IT Act 70B compliance box */}
            <div
              className="rounded-xl border p-3"
              style={{ background: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.25)' }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[9px] font-bold font-mono text-green-400 tracking-widest">IT ACT §70B COMPLIANT</span>
              </div>
              <p className="text-[9px] font-mono text-slate-500 leading-relaxed mb-1.5">
                All incidents reportable to CERT-In within 6 hours per April 2022 Directions.
              </p>
              <button className="flex items-center gap-1 text-[8px] font-mono text-green-600 hover:text-green-400 transition-colors">
                VIEW LEGAL FRAMEWORK <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom: Live Threat Feed ─────────────────────────────────── */}
      <div className="shrink-0 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
          <span className="text-[9px] font-bold font-mono text-slate-500 tracking-widest">LIVE THREAT FEED</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
          {THREAT_FEED_ITEMS.map(item => (
            <ThreatFeedItem key={item.id} item={item} compact />
          ))}
        </div>
      </div>
    </div>
  );
}
