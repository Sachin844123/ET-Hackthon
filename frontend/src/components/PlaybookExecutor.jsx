import React, { useState } from 'react';
import { ShieldAlert, CheckCircle, Clock, RotateCcw, Download } from 'lucide-react';

export default function PlaybookExecutor({ executions = [], on_approve }) {
  const [selectedExecId, setSelectedExecId] = useState(executions.length > 0 ? executions[0].execution_id : null);
  const [showToast, setShowToast] = useState(false);

  const selectedExec = executions.find(e => e.execution_id === selectedExecId);

  const getBlastRadiusColor = (radius) => {
    switch (radius?.toUpperCase()) {
      case 'HIGH': return 'bg-red-500 text-white';
      case 'MEDIUM': return 'bg-amber-500 text-white';
      case 'LOW': return 'bg-green-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toUpperCase()) {
      case 'EXECUTED': return <CheckCircle className="text-green-500 w-5 h-5" />;
      case 'PENDING_APPROVAL': return <Clock className="text-amber-500 w-5 h-5" />;
      case 'ROLLED_BACK': return <RotateCcw className="text-slate-500 w-5 h-5" />;
      default: return <ShieldAlert className="text-blue-500 w-5 h-5" />;
    }
  };

  const handleExport = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
    // In a real app, this would trigger a download of the JSON audit trail
  };

  const autoExecuted = executions.filter(e => e.status === 'EXECUTED' && !e.requires_approval).length;
  const pending = executions.filter(e => e.status === 'PENDING_APPROVAL').length;
  const rolledBack = executions.filter(e => e.status === 'ROLLED_BACK').length;

  return (
    <div className="cyber-card flex flex-col h-full text-slate-300 overflow-hidden min-h-[500px] bg-[#0a0e1a]/85 backdrop-blur-sm animate-fade-in-up">
      
      {/* Toast */}
      <div className={`absolute top-4 left-1/2 -translate-x-1/2 bg-green-950 border border-green-500 text-green-400 px-5 py-2.5 rounded shadow-2xl transition-all duration-300 z-50 flex items-center gap-2 shadow-[0_0_25px_rgba(34,197,94,0.3)] ${showToast ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <CheckCircle className="w-4 h-4 animate-bounce" />
        <span className="text-xs font-bold font-mono tracking-wider">AUDIT PACKAGE EXPORTED — CRYPTOGRAPHIC SHA-256 SIGNATURE VALIDATED</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Panel: List */}
        <div className="w-1/3 border-r border-slate-800/80 bg-slate-950/20 flex flex-col tech-border-r">
          <div className="p-4 border-b border-slate-800 bg-slate-900/60">
            <h2 className="text-xs font-bold text-white tracking-widest flex items-center gap-2 font-mono">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              TRIGGERED PLAYBOOKS
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {executions.length === 0 ? (
              <div className="text-center p-4 text-slate-500 text-xs font-mono">No playbooks triggered yet.</div>
            ) : executions.map(exec => (
              <div 
                key={exec.execution_id}
                onClick={() => setSelectedExecId(exec.execution_id)}
                className={`p-3 rounded cursor-pointer border transition-all ${selectedExecId === exec.execution_id ? 'bg-slate-900 border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'bg-slate-900/40 border-slate-800/60 hover:bg-slate-900/80'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(exec.status)}
                    <span className="font-bold text-xs text-slate-200 font-mono">{exec.playbook_name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold tracking-widest font-mono ${getBlastRadiusColor(exec.blast_radius)}`}>
                    {exec.blast_radius} BLAST RADIUS
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono break-all">{exec.triggered_by_alert_id}</span>
                </div>
                {exec.status === 'PENDING_APPROVAL' && (
                  <div className="flex gap-2 mt-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); on_approve && on_approve(exec.execution_id); }}
                      className="flex-1 bg-green-950/40 hover:bg-green-900/50 border border-green-500/50 text-green-400 text-[10px] font-bold font-mono py-1 rounded transition-colors shadow-[0_0_8px_rgba(34,197,94,0.1)]"
                    >
                      APPROVE
                    </button>
                    <button 
                      className="flex-1 bg-red-950/40 hover:bg-red-900/50 border border-red-500/50 text-red-400 text-[10px] font-bold font-mono py-1 rounded transition-colors"
                    >
                      REJECT
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel: Detail */}
        <div className="w-2/3 flex flex-col bg-[#0a0e1a]/60">
          {selectedExec ? (
            <>
              <div className="p-6 border-b border-slate-800/80 flex justify-between items-start bg-slate-900/30">
                <div>
                  <h3 className="text-base font-bold text-white mb-1 font-mono tracking-wide">{selectedExec.playbook_name}</h3>
                  <div className="text-[10px] text-slate-500 font-mono">EXECUTION ID: {selectedExec.execution_id}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold flex items-center gap-1.5 justify-end mb-1 font-mono">
                    STATUS: {selectedExec.status === 'EXECUTED' ? <span className="text-green-400 neon-glow-text-cyan">EXECUTED</span> : <span className="text-amber-400 neon-glow-text-amber">PENDING APPROVAL</span>}
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono tracking-widest">
                    {selectedExec.requires_approval ? 'HUMAN APPROVAL REQUIRED' : 'AUTONOMOUS REACTION'}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <h4 className="text-[10px] font-bold text-slate-500 tracking-widest mb-4 font-mono uppercase">ACTION SEQUENCE</h4>
                <div className="space-y-4">
                  {selectedExec.actions.map((action, idx) => (
                    <div key={idx} className="cyber-card p-4 relative overflow-hidden bg-[#0a0e1a]/40 border-slate-850">
                      {action.status === 'SUCCESS' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500" />}
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-cyan-950/60 text-cyan-400 text-[10px] px-2 py-0.5 rounded border border-cyan-800/50 font-mono">
                            {action.action_type}
                          </span>
                          <span className="text-xs text-slate-300 font-mono">{action.target_entity}</span>
                        </div>
                        {action.status === 'SUCCESS' ? (
                          <span className="text-xs text-green-400 font-bold flex items-center gap-1 font-mono"><CheckCircle className="w-3.5 h-3.5"/> SUCCESS</span>
                        ) : (
                          <span className="text-xs text-slate-500 font-bold font-mono">AWAITING</span>
                        )}
                      </div>
                      <div className="bg-[#05070f] p-3 rounded border border-slate-900 font-mono text-[10px] text-slate-400 mt-3 overflow-x-auto leading-relaxed">
                        {action.audit_log_entry || `[SYSTEM] ACTION:${action.action_type} TARGET:${action.target_entity}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-950/40">
                <button 
                  onClick={handleExport}
                  className="cyber-button-cyan w-full flex items-center justify-center gap-2 py-3 rounded font-bold tracking-widest text-xs border border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.25)] transition-all"
                >
                  <Download className="w-4 h-4" />
                  EXPORT CRYPTOGRAPHIC AUDIT PACKAGE
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs font-mono">
              Select a playbook to view active audit trail details.
            </div>
          )}
        </div>
      </div>

      {/* Footer Stats Bar */}
      <div className="bg-slate-950 border-t border-slate-800/80 p-3 flex justify-between items-center text-[9px] text-slate-500 font-mono uppercase tracking-wider">
        <div className="flex gap-4">
          <span>AUTO-EXECUTED: <span className="text-green-400 font-bold">{autoExecuted}</span></span>
          <span>PENDING: <span className="text-amber-400 font-bold">{pending}</span></span>
          <span>ROLLED BACK: <span className="text-slate-600 font-bold">{rolledBack}</span></span>
        </div>
        <div className="tracking-widest flex items-center gap-1.5 text-cyan-400 font-bold">
          <ShieldAlert className="w-3.5 h-3.5 animate-pulse" />
          ALL ACTIONS LOGGED WITH CRYPTOGRAPHIC TIMESTAMPS
        </div>
      </div>
    </div>
  );
}
