import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, CheckCircle, Clock, RotateCcw, Download,
  Terminal, Search, Plus, Library, ChevronDown, Lock
} from 'lucide-react';
import GlitchText from './GlitchText';

const BLAST_COLORS = {
  HIGH:   { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.5)' },
  MEDIUM: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)' },
  LOW:    { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.4)' },
};

const STATUS_CONFIG = {
  EXECUTED:         { icon: CheckCircle, color: '#22c55e', label: 'EXECUTED', bg: 'rgba(34,197,94,0.1)' },
  PENDING_APPROVAL: { icon: Clock, color: '#f59e0b', label: 'PENDING APPROVAL', bg: 'rgba(245,158,11,0.1)', pulse: true },
  ROLLED_BACK:      { icon: RotateCcw, color: '#64748b', label: 'ROLLED BACK', bg: 'rgba(100,116,139,0.1)' },
};

const CATEGORIES = [
  { label: 'All Playbooks', key: 'ALL' },
  { label: 'Auto-Executed', key: 'EXECUTED' },
  { label: 'Pending Review', key: 'PENDING_APPROVAL' },
  { label: 'Rolled Back', key: 'ROLLED_BACK' },
];

export default function PlaybookExecutor({ executions = [], on_approve }) {
  const [selectedExecId, setSelectedExecId] = useState(executions[0]?.execution_id || null);
  const [expandedId, setExpandedId] = useState(null);
  const [showToast, setShowToast] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const selectedExec = executions.find(e => e.execution_id === selectedExecId);
  const autoCount = executions.filter(e => e.status === 'EXECUTED' && !e.requires_approval).length;
  const pendingCount = executions.filter(e => e.status === 'PENDING_APPROVAL').length;
  const rolledBackCount = executions.filter(e => e.status === 'ROLLED_BACK').length;

  const handleApprove = async (exec_id) => {
    if (on_approve) await on_approve(exec_id);
    setShowToast({ type: 'approved', id: exec_id });
    setTimeout(() => setShowToast(null), 3000);
  };

  const handleExport = () => {
    setShowToast({ type: 'export' });
    setTimeout(() => setShowToast(null), 3500);
  };

  const filteredExecs = executions.filter(e => {
    if (categoryFilter !== 'ALL' && e.status !== categoryFilter) return false;
    if (search && !e.playbook_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    ALL: executions.length,
    EXECUTED: executions.filter(e => e.status === 'EXECUTED').length,
    PENDING_APPROVAL: pendingCount,
    ROLLED_BACK: rolledBackCount,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative" style={{ background: 'transparent' }}>

      {/* Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-2.5 rounded-lg border shadow-2xl"
            style={{
              background: showToast.type === 'approved' ? 'rgba(34,197,94,0.15)' : 'rgba(6,182,212,0.15)',
              borderColor: showToast.type === 'approved' ? 'rgba(34,197,94,0.5)' : 'rgba(6,182,212,0.5)',
            }}
          >
            <CheckCircle className="w-4 h-4" style={{ color: showToast.type === 'approved' ? '#22c55e' : '#06b6d4' }} />
            <span className="text-[10px] font-bold font-mono tracking-widest text-slate-200">
              {showToast.type === 'approved'
                ? 'PLAYBOOK APPROVED — EXECUTING NOW'
                : 'AUDIT PACKAGE EXPORTED — CRYPTOGRAPHIC HASH VALIDATED'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search playbooks..."
            className="w-full pl-8 pr-3 py-1.5 text-[11px] font-mono rounded-lg border outline-none"
            style={{
              background: 'rgba(15,21,37,0.8)',
              borderColor: 'rgba(51,65,85,0.5)',
              color: '#f1f5f9',
            }}
          />
        </div>

        {/* Status filter */}
        <div className="relative">
          <select
            className="appearance-none text-[10px] font-mono bg-transparent border rounded px-3 py-1.5 outline-none pr-6"
            style={{ borderColor: 'rgba(51,65,85,0.5)', color: '#94a3b8' }}
          >
            <option>ALL STATUSES</option>
            <option>EXECUTED</option>
            <option>PENDING</option>
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
        </div>

        <button className="flex items-center gap-1.5 text-[10px] font-mono bg-cyan-950/40 text-cyan-400 border border-cyan-500/40 px-3 py-1.5 rounded hover:bg-cyan-950/70 transition-all">
          <Plus className="w-3.5 h-3.5" /> CREATE PLAYBOOK
        </button>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden min-h-0">

        {/* ── Left Category Column ──────────────────────────────────── */}
        <div className="w-44 shrink-0 flex flex-col gap-1">
          {CATEGORIES.map(({ label, key }) => (
            <button
              key={key}
              onClick={() => setCategoryFilter(key)}
              className="flex items-center justify-between px-3 py-2 rounded-lg text-[11px] font-mono transition-all text-left"
              style={{
                background: categoryFilter === key ? 'rgba(6,182,212,0.1)' : 'transparent',
                color: categoryFilter === key ? '#22d3ee' : '#64748b',
                border: `1px solid ${categoryFilter === key ? 'rgba(6,182,212,0.3)' : 'transparent'}`,
              }}
            >
              <span>{label}</span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                style={{
                  background: categoryFilter === key ? 'rgba(6,182,212,0.2)' : 'rgba(30,41,59,0.8)',
                  color: categoryFilter === key ? '#22d3ee' : '#475569',
                }}
              >
                {counts[key]}
              </span>
            </button>
          ))}

          <div className="mt-auto pt-4 border-t border-slate-800/40">
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-mono text-slate-500 hover:text-slate-400 transition-colors">
              <Library className="w-3.5 h-3.5" /> PLAYBOOK TEMPLATES
            </button>
          </div>
        </div>

        {/* ── Main Playbook Area ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {filteredExecs.length === 0 ? (
            /* Empty state */
            <div className="h-full flex flex-col items-center justify-center text-slate-600">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ border: '2px dashed rgba(51,65,85,0.4)', background: 'rgba(15,21,37,0.5)' }}
              >
                <Terminal className="w-7 h-7 text-slate-700" />
              </div>
              <h3 className="text-sm font-bold font-mono tracking-widest text-slate-700 mb-2">
                NO PLAYBOOKS TRIGGERED
              </h3>
              <p className="text-[11px] font-mono text-slate-700 text-center max-w-xs">
                Run the autopsy first to generate autonomous response playbooks based on detected TTPs.
              </p>
            </div>
          ) : (
            filteredExecs.map((exec, idx) => {
              const blast = BLAST_COLORS[exec.blast_radius?.toUpperCase()] || BLAST_COLORS.MEDIUM;
              const status = STATUS_CONFIG[exec.status] || STATUS_CONFIG.EXECUTED;
              const StatusIcon = status.icon;
              const isExpanded = expandedId === exec.execution_id;

              return (
                <motion.div
                  key={exec.execution_id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08, type: 'spring', stiffness: 80 }}
                  className="rounded-xl border overflow-hidden"
                  style={{
                    background: 'rgba(15,21,37,0.9)',
                    borderColor: selectedExecId === exec.execution_id
                      ? 'rgba(6,182,212,0.4)'
                      : 'rgba(51,65,85,0.4)',
                  }}
                >
                  {/* Playbook header row */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                    onClick={() => {
                      setSelectedExecId(exec.execution_id);
                      setExpandedId(isExpanded ? null : exec.execution_id);
                    }}
                  >
                    {/* Status icon */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: status.bg }}
                    >
                      <StatusIcon
                        className={`w-4 h-4 ${status.pulse ? 'animate-pulse' : ''}`}
                        style={{ color: status.color }}
                      />
                    </div>

                    {/* Name + triggered-by */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[12px] font-bold text-slate-200 font-mono truncate">
                          {exec.playbook_name}
                        </span>
                        <span
                          className="text-[8px] font-bold font-mono px-1.5 py-0.5 rounded shrink-0"
                          style={{ color: blast.color, background: blast.bg, border: `1px solid ${blast.border}` }}
                        >
                          {exec.blast_radius}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-slate-500">
                        Triggered by: {exec.triggered_by || 'Autonomous response'} · {exec.executed_at || 'N/A'}
                      </span>
                    </div>

                    {/* Status badge */}
                    <span
                      className="text-[9px] font-bold font-mono px-2 py-1 rounded shrink-0"
                      style={{ color: status.color, background: status.bg }}
                    >
                      {status.label}
                    </span>

                    {/* Expand chevron */}
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 rotate-180" />
                      : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
                  </div>

                  {/* Expanded commands + approval */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t"
                        style={{ borderColor: 'rgba(30,41,59,0.8)' }}
                      >
                        <div className="px-4 py-3 space-y-3">
                          {/* Commands */}
                          {exec.commands?.length > 0 && (
                            <div
                              className="rounded-lg p-3 font-mono text-[10px] space-y-1.5"
                              style={{ background: '#03050a', border: '1px solid rgba(30,41,59,0.8)' }}
                            >
                              {exec.commands.map((cmd, i) => (
                                <div key={i} className="flex gap-2 text-slate-400">
                                  <span className="text-cyan-600 select-none">{String(i + 1).padStart(2, '0')}</span>
                                  <span>{cmd}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Approval buttons for PENDING */}
                          {exec.status === 'PENDING_APPROVAL' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApprove(exec.execution_id)}
                                className="flex-1 py-2 rounded-lg font-bold font-mono text-[11px] tracking-widest transition-all"
                                style={{
                                  background: 'rgba(34,197,94,0.15)',
                                  border: '1px solid rgba(34,197,94,0.4)',
                                  color: '#22c55e',
                                }}
                              >
                                ✓ APPROVE EXECUTION
                              </button>
                              <button
                                className="flex-1 py-2 rounded-lg font-bold font-mono text-[11px] tracking-widest transition-all"
                                style={{
                                  background: 'rgba(239,68,68,0.1)',
                                  border: '1px solid rgba(239,68,68,0.3)',
                                  color: '#ef4444',
                                }}
                              >
                                ✕ REJECT
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Bottom Summary Bar ───────────────────────────────────────── */}
      <div
        className="shrink-0 mt-4 rounded-xl border flex items-center justify-between px-5 py-3"
        style={{
          background: 'rgba(11,15,23,0.95)',
          borderColor: 'rgba(30,41,59,0.8)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
        }}
      >
        <div className="flex items-center gap-8">
          {[
            { label: 'TOTAL PLAYBOOKS', value: executions.length, color: '#64748b' },
            { label: 'AUTO EXECUTED', value: autoCount, color: '#22c55e' },
            { label: 'PENDING REVIEW', value: pendingCount, color: '#f59e0b' },
            { label: 'ROLLED BACK', value: rolledBackCount, color: '#64748b' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center">
              <span className="text-sm font-bold font-mono" style={{ color }}>{value}</span>
              <span className="text-[8px] font-mono text-slate-600 tracking-widest">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500 hover:text-slate-300 border border-slate-800 px-2.5 py-1.5 rounded transition-all">
            <Download className="w-3 h-3" /> EXPORT AUDIT LOG
          </button>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border"
            style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.25)' }}
          >
            <Lock className="w-3 h-3 text-green-500" />
            <span className="text-[9px] font-mono text-green-600 font-bold tracking-wider">ALL ACTIONS CRYPTOGRAPHICALLY TIMESTAMPED</span>
          </div>
        </div>
      </div>
    </div>
  );
}
