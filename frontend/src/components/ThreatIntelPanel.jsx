import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, AlertTriangle, ExternalLink, Target } from 'lucide-react';
import { useMitreLookup, prefetchTechniques } from '../hooks/useMitreLookup';
import GlitchText from './GlitchText';

const CERT_IN_ADVISORIES = [
  { id: 'CIAD-2022-0041', overlap: 'HIGH',   title: 'Ransomware attacks on Healthcare Sector', iocs: ['185.220.101.47', '72.exe staging'], issued: '2022-11-24' },
  { id: 'CIAD-2022-0038', overlap: 'MEDIUM', title: 'Active exploitation by APT41',            iocs: ['185.220.101.47', '72.exe staging'], issued: '2022-10-15' },
];

const ACTOR_ALIASES  = ['Double Dragon', 'Winnti Group', 'Barium', 'Wicked Panda'];
const ACTOR_SECTORS  = ['Healthcare', 'Finance', 'Defence', 'Education'];

export default function ThreatIntelPanel({ actor_attribution, predicted_ttps = [], autopsyResult }) {
  const actor   = actor_attribution || { actor_name: 'APT41', confidence: 0.84 };
  const confPct = Math.round((actor.confidence || 0.84) * 100);

  const predTtps = (() => {
    const merged = [...(autopsyResult?.ttp_attributions || []), ...(predicted_ttps || [])].slice(0, 3);
    return merged.length > 0 ? merged : [
      { technique_id: 'T1486', confidence: 0.90 },
      { technique_id: 'T1100', confidence: 0.80 },
      { technique_id: 'T1497', confidence: 0.70 },
    ];
  })();

  const techIds = predTtps.map(t => t.technique_id).filter(Boolean);
  useEffect(() => { prefetchTechniques(techIds); }, [techIds.join(',')]);
  const { getTechnique } = useMitreLookup(techIds);

  const totalTtps      = autopsyResult?.ttp_attributions?.length || 12;
  const totalIocs      = autopsyResult?.retroactive_alerts?.length || 28;
  const totalCampaigns = 2;
  const cvssScore      = 9.4;

  const overlapStyle = (o) => o === 'HIGH'
    ? { color: '#ef4444', bg: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.5)' }
    : { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.5)' };

  return (
    <div className="flex flex-col h-full overflow-hidden gap-4">

      {/* Stat tiles */}
      <div className="shrink-0 grid grid-cols-4 gap-3">
        {[
          { label: 'TOTAL TTPs',     value: totalTtps,            color: '#06b6d4' },
          { label: 'IOCs EXTRACTED', value: totalIocs,            color: '#f59e0b' },
          { label: 'CAMPAIGNS',      value: totalCampaigns,       color: '#a855f7' },
          { label: 'CVSS SCORE',     value: cvssScore.toFixed(1), color: '#ef4444' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border p-3 text-center"
            style={{ background: 'rgba(15,21,37,0.9)', borderColor: 'rgba(30,41,59,0.8)' }}>
            <div className="font-mono text-xl font-bold" style={{ color }}>{value}</div>
            <div className="text-[8px] font-mono text-slate-600 tracking-widest mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* 3-column body */}
      <div className="flex gap-4 flex-1 overflow-hidden min-h-0">

        {/* Col 1 – Actor Attribution */}
        <div className="w-52 shrink-0 rounded-xl border flex flex-col overflow-hidden"
          style={{ background: 'rgba(15,21,37,0.9)', borderColor: 'rgba(239,68,68,0.3)' }}>
          <div className="px-4 py-3 border-b flex items-center gap-2"
            style={{ borderColor: 'rgba(30,41,59,0.8)', background: 'rgba(11,15,23,0.6)' }}>
            <Target className="w-4 h-4 text-red-500 animate-pulse" />
            <h3 className="text-[10px] font-bold text-white tracking-widest font-mono">ACTOR ATTRIBUTION</h3>
          </div>
          <div className="flex-1 p-4 flex flex-col items-center overflow-y-auto">
            <div className="relative w-28 h-28 mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(30,41,59,0.8)" strokeWidth={5} />
                <defs><filter id="ti-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter></defs>
                <motion.circle cx="50" cy="50" r="44" fill="none"
                  stroke={confPct >= 80 ? '#ef4444' : '#f59e0b'}
                  strokeWidth={6} strokeLinecap="round" filter="url(#ti-glow)"
                  initial={{ strokeDasharray: '276.5', strokeDashoffset: 276.5 }}
                  animate={{ strokeDashoffset: 276.5 - (276.5 * confPct) / 100 }}
                  transition={{ duration: 2, delay: 0.3, ease: 'easeOut' }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-2xl font-black" style={{ color: confPct >= 80 ? '#ef4444' : '#f59e0b' }}>{confPct}%</span>
                <span className="text-[8px] font-mono text-slate-500 tracking-widest">MATCH</span>
              </div>
            </div>
            <div className="font-mono text-lg font-black text-white text-center mb-1" style={{ textShadow: '0 0 15px rgba(239,68,68,0.5)' }}>
              <GlitchText text={actor.actor_name} delay={500} />
            </div>
            <div className="text-[9px] font-mono text-slate-500 mb-4">NATION-STATE THREAT ACTOR</div>
            <div className="w-full mb-3">
              <div className="text-[8px] font-mono text-slate-600 tracking-widest mb-1.5">KNOWN ALIASES</div>
              <div className="flex flex-wrap gap-1">
                {ACTOR_ALIASES.map(a => <span key={a} className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>{a}</span>)}
              </div>
            </div>
            <div className="w-full">
              <div className="text-[8px] font-mono text-slate-600 tracking-widest mb-1.5">TARGET SECTORS</div>
              <div className="flex flex-wrap gap-1">
                {ACTOR_SECTORS.map(s => <span key={s} className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}>{s}</span>)}
              </div>
            </div>
          </div>
        </div>

        {/* Col 2 – Predicted TTP Forecast */}
        <div className="flex-1 rounded-xl border flex flex-col overflow-hidden"
          style={{ background: 'rgba(13,18,30,0.97)', borderColor: 'rgba(30,41,59,0.8)' }}>
          <div className="px-5 py-3.5 border-b flex items-center gap-2"
            style={{ borderColor: 'rgba(30,41,59,0.7)', background: 'rgba(9,12,20,0.7)' }}>
            <Search className="w-4 h-4 text-amber-400" />
            <h3 className="text-[11px] font-bold text-white tracking-widest font-mono">PREDICTED TTP FORECAST</h3>
          </div>
          <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4">
            <div className="text-[9px] font-mono font-bold text-amber-400 tracking-widest">NEXT PROBABLE TARGETS</div>

            {predTtps.map((ttp, i) => {
              const tech = getTechnique(ttp.technique_id);
              const conf = Math.round((ttp.confidence || (0.9 - i * 0.1)) * 100);
              const vc   = conf >= 85 ? '#ef4444' : conf >= 75 ? '#f59e0b' : '#06b6d4';
              return (
                <motion.div key={ttp.technique_id}
                  initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, type: 'spring' }}
                  className="rounded-xl border p-4"
                  style={{ background: 'rgba(9,12,20,0.9)', borderColor: 'rgba(30,41,59,0.7)' }}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-[10px] font-bold font-mono text-cyan-400 mb-0.5">{ttp.technique_id}</div>
                      <div className="text-sm font-bold text-white">{tech?.name || 'Unknown Technique'}</div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 ml-4">
                      <span className="text-[8px] font-mono text-slate-500 tracking-widest">PROBABILITY</span>
                      <span className="font-mono text-2xl font-black leading-none" style={{ color: vc }}>{conf}%</span>
                    </div>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(30,41,59,0.8)' }}>
                    <motion.div className="h-full rounded-full" style={{ background: vc }}
                      initial={{ width: 0 }} animate={{ width: `${conf}%` }}
                      transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }} />
                  </div>
                  <div className="border-t border-slate-800/60 pt-2.5">
                    <div className="text-[8px] font-bold font-mono text-cyan-400 tracking-wider mb-1">DEFENSIVE RESPONSE:</div>
                    <div className="text-[9px] font-mono text-slate-400 leading-relaxed">
                      {tech?.description ? tech.description.slice(0, 90) + '…' : 'Implement monitoring and blocking for this TTP.'}
                    </div>
                  </div>
                </motion.div>
              );
            })}

            <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-[10px] font-bold font-mono tracking-widest hover:bg-cyan-500/10 transition-all"
              style={{ borderColor: 'rgba(6,182,212,0.35)', color: '#22d3ee' }}>
              VIEW FULL TTP FORECAST <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Col 3 – CERT-IN Directives */}
        <div className="flex-1 rounded-xl border flex flex-col overflow-hidden"
          style={{ background: 'rgba(13,18,30,0.97)', borderColor: 'rgba(30,41,59,0.8)' }}>
          <div className="px-5 py-3.5 border-b flex items-center gap-2"
            style={{ borderColor: 'rgba(30,41,59,0.7)', background: 'rgba(9,12,20,0.7)' }}>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-[11px] font-bold text-white tracking-widest font-mono">CERT-IN DIRECTIVES</h3>
          </div>
          <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4">

            {CERT_IN_ADVISORIES.map((adv, i) => {
              const os = overlapStyle(adv.overlap);
              return (
                <motion.div key={adv.id}
                  initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.12, type: 'spring' }}
                  className="rounded-xl border p-4"
                  style={{ background: 'rgba(9,12,20,0.9)', borderColor: 'rgba(30,41,59,0.7)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold font-mono text-cyan-400">{adv.id}</span>
                    <span className="text-[8px] font-bold font-mono px-2 py-0.5 rounded"
                      style={{ background: os.bg, color: os.color, border: os.border }}>
                      OVERLAP: {adv.overlap}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white leading-snug mb-3">{adv.title}</div>
                  <div className="mb-3">
                    <div className="text-[8px] font-mono text-slate-500 tracking-widest mb-1.5">MATCHING IOC DETAILS:</div>
                    <div className="flex flex-wrap gap-3">
                      {adv.iocs.map(ioc => <span key={ioc} className="text-[9px] font-mono font-bold text-red-400">{ioc}</span>)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/60">
                    <span className="text-[8px] font-mono text-slate-500">ISSUED: {adv.issued}</span>
                    <button className="flex items-center gap-1 text-[8px] font-bold font-mono text-cyan-400 hover:text-cyan-300 tracking-wider transition-colors">
                      READ DIRECTIVE <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {/* IT ACT SECTION 70B */}
            <motion.div
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, type: 'spring' }}
              className="rounded-xl border p-4"
              style={{ background: 'rgba(9,12,20,0.9)', borderColor: 'rgba(6,182,212,0.25)' }}>
              <div className="text-center mb-2">
                <span className="text-[9px] font-bold font-mono text-cyan-400 tracking-widest">IT ACT SECTION 70B</span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 text-center leading-relaxed mb-3">
                Mandatory compliance. Incident indicators listed above require immediate reporting.
              </p>
              <div className="flex justify-center">
                <button className="flex items-center gap-1.5 text-[9px] font-bold font-mono text-cyan-400 hover:text-cyan-300 tracking-widest transition-colors">
                  VIEW LEGAL FRAMEWORK <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>

          </div>
        </div>

      </div>
    </div>
  );
}