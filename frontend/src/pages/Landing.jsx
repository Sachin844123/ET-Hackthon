import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, ArrowRight, Zap, Target, Clock, ShieldAlert,
  Activity, Brain, Search, FileText, ChevronRight
} from 'lucide-react';
import { KILL_CHAIN_STAGES } from '../constants/killChain';
import { THREAT_FEED_ITEMS } from '../constants/threatFeed';
import KillChainNode from '../components/KillChainNode';
import ThreatFeedItem from '../components/ThreatFeedItem';
import ParticleBackground from '../components/ParticleBackground';
import AnimatedCounter from '../components/AnimatedCounter';
import GlitchText from '../components/GlitchText';

// Boot sequence unchanged — it's a great effect
const BOOT_SEQUENCE = [
  { text: 'INITIALIZING THREAT ENGINE...', icon: Shield, color: '#06b6d4' },
  { text: 'LOADING MITRE ATT&CK FRAMEWORK...', icon: Target, color: '#a855f7' },
  { text: 'CONNECTING NEO4J GRAPH DATABASE...', icon: Activity, color: '#22c55e' },
  { text: 'CALIBRATING ANOMALY DETECTION...', icon: Zap, color: '#f59e0b' },
  { text: 'SYSTEMS ONLINE — READY FOR AUTOPSY', icon: ShieldAlert, color: '#ef4444' },
];

// Hero workspace card: 6 stages from constants (omit execution + exfiltration for space)
const HERO_STAGES = KILL_CHAIN_STAGES.filter(s =>
  ['initial-access', 'persistence', 'privilege-escalation', 'lateral-movement', 'collection', 'impact'].includes(s.id)
);

const HERO_STAGE_CONNECTS = [
  { from: 0, to: 1, detected: true },
  { from: 1, to: 2, detected: true },
  { from: 2, to: 3, detected: true },
  { from: 3, to: 4, detected: true },
  { from: 4, to: 5, detected: false },
];

const AI_AGENTS = [
  { name: 'INVESTIGATOR', icon: Search, color: '#06b6d4', desc: 'Ingests & vectorizes raw security logs' },
  { name: 'MITRE MAPPER', icon: Target, color: '#a855f7', desc: 'Maps behaviors → ATT&CK techniques' },
  { name: 'IOC EXTRACTOR', icon: Activity, color: '#f59e0b', desc: 'Extracts indicators and threat intel' },
  { name: 'REPORT GEN', icon: FileText, color: '#22c55e', desc: 'Generates CERT-In compliant reports' },
];

const FEATURE_CARDS = [
  {
    icon: Zap, color: '#06b6d4',
    title: 'Retroactive Analysis',
    desc: 'Prove detection capability on known breaches. See exactly when you would have caught it.',
  },
  {
    icon: Brain, color: '#a855f7',
    title: '5 Autonomous AI Agents',
    desc: 'LangGraph pipeline: ingest → baseline → attribute → predict → respond. Fully auditable.',
  },
  {
    icon: Shield, color: '#22c55e',
    title: 'CERT-In Compliant',
    desc: 'IT Act §70B aligned. Every action gets a cryptographic hash for forensic chain-of-custody.',
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const [bootPhase, setBootPhase] = useState(0);
  const [bootComplete, setBootComplete] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [aimsStats, setAimsStats] = useState({ mitreMapping: 100, iocsExtracted: 28 });

  // Boot sequence
  useEffect(() => {
    if (bootPhase < BOOT_SEQUENCE.length) {
      const t = setTimeout(() => setBootPhase(p => p + 1), 420);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setBootComplete(true);
        setTimeout(() => setShowContent(true), 300);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [bootPhase]);

  // Load cached AIIMS stats for hero card
  useEffect(() => {
    fetch('/api/demo/aiims')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setAimsStats({
            mitreMapping: 100,
            iocsExtracted: data.retroactive_alerts?.length || 28,
          });
        }
      })
      .catch(() => {});
  }, []);

  const show = showContent;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: '#0a0e14' }}>

      {/* Particle background */}
      <div className="absolute inset-0 z-0">
        <ParticleBackground variant="default" />
      </div>

      {/* Ambient glows */}
      <motion.div
        className="absolute pointer-events-none"
        style={{ top: '-10%', left: '-5%', width: '40%', height: '40%' }}
        animate={{ opacity: [0.12, 0.2, 0.12] }}
        transition={{ duration: 9, repeat: Infinity }}
      >
        <div className="w-full h-full rounded-full" style={{ background: '#ef4444', filter: 'blur(120px)', opacity: 0.18 }} />
      </motion.div>
      <motion.div
        className="absolute pointer-events-none"
        style={{ bottom: '-10%', right: '-5%', width: '40%', height: '40%' }}
        animate={{ opacity: [0.08, 0.16, 0.08] }}
        transition={{ duration: 12, repeat: Infinity, delay: 3 }}
      >
        <div className="w-full h-full rounded-full" style={{ background: '#6366f1', filter: 'blur(140px)', opacity: 0.15 }} />
      </motion.div>

      {/* ── Boot Sequence Overlay ─────────────────────────────────────── */}
      <AnimatePresence>
        {!bootComplete && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: '#0a0e14' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="w-full max-w-md px-8">
              <div className="flex items-center gap-3 mb-8">
                <Shield className="w-7 h-7 text-red-500" style={{ filter: 'drop-shadow(0 0 10px rgba(239,68,68,0.6))' }} />
                <span className="font-mono text-xs tracking-widest text-slate-500">ATTACK CHAIN AUTOPSY ENGINE v1.0</span>
              </div>
              <div className="space-y-3 mb-6">
                {BOOT_SEQUENCE.map((step, idx) => {
                  const Icon = step.icon;
                  const active = idx < bootPhase;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -16 }}
                      animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
                      className="flex items-center gap-3"
                    >
                      <Icon className="w-4 h-4 shrink-0" style={{ color: step.color, filter: `drop-shadow(0 0 5px ${step.color})` }} />
                      <span className="font-mono text-xs tracking-wider" style={{ color: idx === bootPhase - 1 ? '#f1f5f9' : '#475569' }}>
                        {step.text}
                      </span>
                      {active && <span className="text-green-400 text-xs font-mono font-bold ml-auto">✓</span>}
                    </motion.div>
                  );
                })}
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.8)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #ef4444, #f59e0b, #06b6d4)' }}
                  initial={{ width: '0%' }}
                  animate={{ width: `${(bootPhase / BOOT_SEQUENCE.length) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Nav ───────────────────────────────────────────────────── */}
      <motion.nav
        className="relative z-10 flex items-center justify-between px-8 py-4 max-w-7xl w-full mx-auto"
        initial={{ opacity: 0, y: -16 }}
        animate={show ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <motion.div
            animate={{ filter: ['drop-shadow(0 0 6px rgba(239,68,68,0.4))', 'drop-shadow(0 0 14px rgba(239,68,68,0.7))', 'drop-shadow(0 0 6px rgba(239,68,68,0.4))'] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Shield className="w-7 h-7 text-red-500" />
          </motion.div>
          <span className="font-bold text-white tracking-widest text-base font-mono">
            ATTACK CHAIN <span className="text-red-500">AUTOPSY</span>
          </span>
        </div>

        {/* Center links */}
        <div className="hidden lg:flex items-center gap-8 text-[10px] font-mono tracking-widest uppercase">
          {['Platform', 'Capabilities', 'AI Agents', 'Threat Intel', 'Resources'].map(l => (
            <button
              key={l}
              className="text-slate-500 hover:text-cyan-400 transition-colors duration-200 relative py-1 group"
            >
              {l}
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-cyan-400 transition-all duration-200 group-hover:w-full" />
            </button>
          ))}
        </div>

        {/* Right: status pills */}
        <div className="hidden lg:flex items-center gap-4">
          {[
            { label: 'NEO4J', color: '#22c55e' },
            { label: 'MITRE', color: '#06b6d4' },
            { label: 'STIX', color: '#a855f7' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5 text-[9px] font-bold font-mono tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
              <span style={{ color }}>{label}: ONLINE</span>
            </div>
          ))}
        </div>
      </motion.nav>

      {/* ── Hero Section ─────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 px-8 max-w-7xl w-full mx-auto">

        {/* 2-column hero */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center pt-8 pb-12">

          {/* Left column */}
          <div>
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={show ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.2, type: 'spring' }}
              className="inline-flex items-center gap-2 mb-6"
            >
              <div
                className="flex items-center gap-2 text-[10px] font-bold font-mono tracking-widest px-4 py-1.5 rounded-full"
                style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', color: '#22d3ee' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                CNI CYBER RESILIENCE SUITE
              </div>
            </motion.div>

            {/* Headline */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={show ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <h1 className="text-5xl lg:text-7xl font-black text-white leading-none mb-1 font-display tracking-tight">
                <GlitchText text="Autopsy Every" delay={600} as="span" />
              </h1>
              <h1 className="text-5xl lg:text-7xl font-black leading-none mb-6 font-display tracking-tight">
                <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #06b6d4 100%)' }}>
                  <GlitchText text="Attack." delay={900} as="span" />
                </span>
              </h1>
            </motion.div>

            {/* Subhead */}
            <motion.p
              className="text-lg text-slate-400 max-w-lg mb-8 leading-relaxed"
              initial={{ opacity: 0, y: 16 }}
              animate={show ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.55 }}
            >
              AIIMS Delhi ransomware: attackers hid for{' '}
              <span className="text-white font-bold">22 days</span>. Our autonomous engine flags it on{' '}
              <span className="text-cyan-400 font-semibold">Day 3</span> — with 81% confidence.
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="flex items-center gap-4"
              initial={{ opacity: 0, y: 12 }}
              animate={show ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.7 }}
            >
              <motion.button
                onClick={() => navigate('/demo')}
                whileHover={{ scale: 1.03, boxShadow: '0 0 28px rgba(239,68,68,0.55)' }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-mono text-xs tracking-wider uppercase font-bold text-white transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  boxShadow: '0 0 20px rgba(239,68,68,0.3)',
                  border: '1px solid rgba(239,68,68,0.5)',
                }}
              >
                <Zap className="w-4 h-4 fill-white" />
                Launch Platform
                <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  <ArrowRight className="w-4 h-4" />
                </motion.span>
              </motion.button>

              <motion.button
                whileHover={{
                  scale: 1.03,
                  borderColor: 'rgba(255,255,255,0.8)',
                  color: '#ffffff',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-mono text-xs tracking-wider uppercase font-bold text-slate-400 transition-all duration-300"
                style={{
                  border: '1.5px solid rgba(51,65,85,0.7)',
                  background: 'transparent',
                }}
              >
                Watch Demo
              </motion.button>
            </motion.div>


            {/* 4-icon strip */}
            <motion.div
              className="flex items-center gap-6 mt-8"
              initial={{ opacity: 0 }}
              animate={show ? { opacity: 1 } : {}}
              transition={{ delay: 0.9 }}
            >
              {[
                { icon: Brain, label: 'AI-Driven' },
                { icon: Target, label: 'MITRE ATT&CK' },
                { icon: Activity, label: 'Graph Powered' },
                { icon: Shield, label: 'CERT-In Ready' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
                  <Icon className="w-3.5 h-3.5 text-slate-600" />
                  {label}
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right column: AI Investigation Workspace card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={show ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className="rounded-2xl border overflow-hidden"
              style={{
                background: 'rgba(11,15,23,0.95)',
                borderColor: 'rgba(30,41,59,0.8)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 40px rgba(6,182,212,0.06)',
              }}
            >
              {/* Card header */}
              <div
                className="flex items-center justify-between px-5 py-3.5 border-b"
                style={{ borderColor: 'rgba(30,41,59,0.8)', background: 'rgba(7,12,20,0.8)' }}
              >
                <span className="text-[10px] font-bold font-mono tracking-widest text-slate-400">
                  AI INVESTIGATION WORKSPACE
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[9px] font-mono text-green-500">Analysis in Progress</span>
                </div>
              </div>

              {/* Mini kill chain flow */}
              <div className="p-5">
                <div className="text-[9px] font-mono text-slate-600 tracking-widest mb-3">ATTACK CHAIN RECONSTRUCTION</div>
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {HERO_STAGES.map((stage, i) => {
                    const detected = i < 5;
                    return (
                      <React.Fragment key={stage.id}>
                        <KillChainNode
                          stage={stage}
                          detected={detected}
                          size="compact"
                          active={i === 2}
                        />
                        {i < HERO_STAGES.length - 1 && (
                          <div className="flex-shrink-0">
                            {/* Marching-ants connector */}
                            <svg width="20" height="8">
                              <motion.line
                                x1="0" y1="4" x2="20" y2="4"
                                stroke={detected ? stage.color : '#334155'}
                                strokeWidth="1.5"
                                strokeDasharray="4,3"
                                animate={{ strokeDashoffset: [0, -14] }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              />
                              <polygon points="16,1 20,4 16,7" fill={detected ? stage.color : '#334155'} opacity={0.7} />
                            </svg>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* 3 stats */}
                <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t" style={{ borderColor: 'rgba(30,41,59,0.6)' }}>
                  {[
                    { label: 'MITRE MAPPING', value: aimsStats.mitreMapping, suffix: '%', color: '#22c55e' },
                    { label: 'IOCs EXTRACTED', value: aimsStats.iocsExtracted, color: '#f59e0b' },
                    { label: 'REPORT', value: 'AUTO', color: '#06b6d4', text: true },
                  ].map(({ label, value, suffix, color, text }) => (
                    <div key={label} className="text-center">
                      <div className="font-mono text-xl font-black mb-0.5" style={{ color }}>
                        {text
                          ? value
                          : <AnimatedCounter end={value} suffix={suffix} duration={1500} delay={1200} />
                        }
                      </div>
                      <div className="text-[8px] font-mono text-slate-600 tracking-widest">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Feature Cards Row ─────────────────────────────────────── */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={show ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.0 }}
        >
          {FEATURE_CARDS.map(({ icon: Icon, color, title, desc }, i) => (
            <motion.div
              key={title}
              whileHover={{ y: -4, scale: 1.01 }}
              className="rounded-xl border p-5 cursor-pointer transition-all"
              style={{
                background: 'rgba(15,21,37,0.8)',
                borderColor: 'rgba(30,41,59,0.8)',
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                style={{ background: `${color}15`, border: `1px solid ${color}30` }}
              >
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{title}</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Bottom 2-col ─────────────────────────────────────────── */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12"
          initial={{ opacity: 0 }}
          animate={show ? { opacity: 1 } : {}}
          transition={{ delay: 1.2 }}
        >
          {/* Recent Intelligence */}
          <div className="rounded-xl border overflow-hidden" style={{ background: 'rgba(11,15,23,0.9)', borderColor: 'rgba(30,41,59,0.8)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(30,41,59,0.8)' }}>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-[10px] font-bold font-mono tracking-widest text-slate-400">RECENT INTELLIGENCE</span>
              </div>
              <button className="text-[9px] font-mono text-cyan-500 hover:text-cyan-400 transition-colors flex items-center gap-1">
                VIEW ALL <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="p-3 space-y-1">
              {THREAT_FEED_ITEMS.slice(0, 4).map(item => (
                <ThreatFeedItem key={item.id} item={item} compact={false} />
              ))}
            </div>
          </div>

          {/* Our AI Team */}
          <div className="rounded-xl border overflow-hidden" style={{ background: 'rgba(11,15,23,0.9)', borderColor: 'rgba(30,41,59,0.8)' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(30,41,59,0.8)' }}>
              <span className="text-[10px] font-bold font-mono tracking-widest text-slate-400">OUR AI TEAM</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {AI_AGENTS.map(({ name, icon: Icon, color, desc }) => (
                <div
                  key={name}
                  className="rounded-xl border p-3"
                  style={{ background: 'rgba(15,21,37,0.8)', borderColor: `${color}25` }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: `${color}15` }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <span className="text-[9px] font-bold font-mono" style={{ color }}>{name}</span>
                  </div>
                  <p className="text-[9px] text-slate-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <motion.footer
        className="relative z-10 py-5 border-t text-center"
        style={{ borderColor: 'rgba(30,41,59,0.6)' }}
        initial={{ opacity: 0 }}
        animate={show ? { opacity: 1 } : {}}
        transition={{ delay: 1.5 }}
      >
        <p className="text-[10px] text-slate-600 font-mono tracking-widest">
          ET AI Hackathon 2026
          <span className="mx-2 text-slate-800">|</span>
          Problem Statement 7
          <span className="mx-2 text-slate-800">|</span>
          AI-Powered Cyber Resilience for Critical National Infrastructure
        </p>
      </motion.footer>
    </div>
  );
}
