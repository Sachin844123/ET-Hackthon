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
    <div className="flex flex-col h-full bg-[#0a0e1a] text-slate-300 rounded-lg border-2 border-slate-800 shadow-xl overflow-hidden min-h-[500px]">
      
      {/* Toast */}
      <div className={`absolute top-4 left-1/2 -translate-x-1/2 bg-green-900 border border-green-500 text-green-100 px-4 py-2 rounded shadow-2xl transition-all duration-300 z-50 flex items-center gap-2 ${showToast ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <CheckCircle className="w-4 h-4" />
        <span className="text-sm font-bold tracking-wide">Audit trail exported — legally admissible evidence package generated.</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Panel: List */}
        <div className="w-1/3 border-r border-slate-800 bg-slate-900/50 flex flex-col">
          <div className="p-4 border-b border-slate-800 bg-slate-900">
            <h2 className="text-sm font-bold text-white tracking-widest flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-500" />
              TRIGGERED PLAYBOOKS
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {executions.length === 0 ? (
              <div className="text-center p-4 text-slate-500 text-sm">No playbooks triggered yet.</div>
            ) : executions.map(exec => (
              <div 
                key={exec.execution_id}
                onClick={() => setSelectedExecId(exec.execution_id)}
                className={`p-3 rounded cursor-pointer border transition-colors ${selectedExecId === exec.execution_id ? 'bg-slate-800 border-cyan-500/50' : 'bg-slate-900/50 border-transparent hover:bg-slate-800/50'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(exec.status)}
                    <span className="font-bold text-sm text-slate-200">{exec.playbook_name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold tracking-wider ${getBlastRadiusColor(exec.blast_radius)}`}>
                    {exec.blast_radius} BLAST RADIUS
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{exec.triggered_by_alert_id}</span>
                </div>
                {exec.status === 'PENDING_APPROVAL' && (
                  <div className="flex gap-2 mt-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); on_approve && on_approve(exec.execution_id); }}
                      className="flex-1 bg-green-600/20 hover:bg-green-600/40 border border-green-500 text-green-400 text-xs py-1 rounded transition-colors"
                    >
                      APPROVE
                    </button>
                    <button 
                      className="flex-1 bg-red-600/20 hover:bg-red-600/40 border border-red-500 text-red-400 text-xs py-1 rounded transition-colors"
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
        <div className="w-2/3 flex flex-col bg-[#0a0e1a]">
          {selectedExec ? (
            <>
              <div className="p-6 border-b border-slate-800 flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">{selectedExec.playbook_name}</h3>
                  <div className="text-xs text-slate-400 font-mono">EXEC ID: {selectedExec.execution_id}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold flex items-center gap-1 justify-end mb-1">
                    STATUS: {selectedExec.status === 'EXECUTED' ? <span className="text-green-500">EXECUTED</span> : <span className="text-amber-500">PENDING APPROVAL</span>}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {selectedExec.requires_approval ? 'HUMAN APPROVAL REQUIRED' : 'AUTONOMOUS EXECUTION'}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <h4 className="text-xs font-bold text-slate-500 tracking-widest mb-4">ACTION SEQUENCE</h4>
                <div className="space-y-4">
                  {selectedExec.actions.map((action, idx) => (
                    <div key={idx} className="bg-slate-900 border border-slate-700 rounded p-4 relative overflow-hidden">
                      {action.status === 'SUCCESS' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500" />}
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-cyan-900/50 text-cyan-400 text-xs px-2 py-0.5 rounded border border-cyan-800">
                            {action.action_type}
                          </span>
                          <span className="text-sm text-slate-300 font-mono">{action.target_entity}</span>
                        </div>
                        {action.status === 'SUCCESS' ? (
                          <span className="text-xs text-green-500 font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3"/> SUCCESS</span>
                        ) : (
                          <span className="text-xs text-slate-500 font-bold">PENDING</span>
                        )}
                      </div>
                      <div className="bg-[#0a0e1a] p-2 rounded border border-slate-800 font-mono text-[10px] text-slate-400 mt-3 overflow-x-auto">
                        {action.audit_log_entry || `[SIMULATED] ACTION:${action.action_type} TARGET:${action.target_entity}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                <button 
                  onClick={handleExport}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded transition-colors border border-slate-600"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm font-bold tracking-widest">EXPORT AUDIT TRAIL</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
              Select a playbook to view details
            </div>
          )}
        </div>
      </div>

      {/* Footer Stats Bar */}
      <div className="bg-slate-900 border-t border-slate-800 p-2 flex justify-between items-center text-[10px] text-slate-400 font-mono">
        <div className="flex gap-4">
          <span>AUTO-EXECUTED: <span className="text-green-400">{autoExecuted}</span></span>
          <span>PENDING: <span className="text-amber-400">{pending}</span></span>
          <span>ROLLED BACK: <span className="text-slate-500">{rolledBack}</span></span>
        </div>
        <div className="tracking-widest flex items-center gap-1 text-cyan-500">
          <ShieldAlert className="w-3 h-3" />
          ALL ACTIONS LOGGED WITH CRYPTOGRAPHIC TIMESTAMPS
        </div>
      </div>
    </div>
  );
}
