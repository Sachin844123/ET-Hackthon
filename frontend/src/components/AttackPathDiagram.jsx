import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize, Focus, Info } from 'lucide-react';
import { KILL_CHAIN_STAGES } from '../constants/killChain';
import { useMitreLookup, prefetchTechniques } from '../hooks/useMitreLookup';
import SystemControllerPanel from './SystemControllerPanel';

// ── AIIMS Attack Path Graph Definition ───────────────────────────────────────
// Three paths: main ransomware path, secondary SMB path, persistence loop-back
const GRAPH_PATHS = {
  main: [
    { id: 'ia-1',   stageId: 'initial-access',      tech: 'T1078',     day: 1,  label: 'Cred Theft',   host: 'svc_backup$' },
    { id: 'ex-1',   stageId: 'execution',            tech: 'T1059.001', day: 2,  label: 'PS Exec',      host: 'AIIMS-BACKUP-SRV-01' },
    { id: 'pe-1',   stageId: 'persistence',          tech: 'T1053.005', day: 3,  label: 'Sched Task',   host: 'AIIMS-DC-01' },
    { id: 'priv-1', stageId: 'privilege-escalation', tech: 'T1068',     day: 4,  label: 'Priv Esc',     host: 'AIIMS-DC-01' },
    { id: 'de-1',   stageId: 'defense-evasion',      tech: 'T1562.001', day: 5,  label: 'AV Disabled',  host: 'AIIMS-FILE-SRV-02' },
    { id: 'col-1',  stageId: 'collection',           tech: 'T1560.001', day: 7,  label: '47GB Staged',  host: 'C:\\Windows\\Temp' },
    { id: 'exf-1',  stageId: 'exfiltration',         tech: 'T1071.001', day: 12, label: 'C2 Beacon',    host: '185.220.101.47' },
    { id: 'imp-1',  stageId: 'impact',               tech: 'T1486',     day: 22, label: 'Ransomware',   host: '284K records' },
  ],
  smb: [
    { id: 'lm-1', stageId: 'lateral-movement',      tech: 'T1021.002', day: 3,  label: 'SMB Sweep',    host: 'AIIMS-PATIENT-MGMT-01' },
    { id: 'lm-2', stageId: 'lateral-movement',      tech: 'T1021.002', day: 5,  label: 'Pivot → EHR',  host: 'AIIMS-EHR-DB-01' },
  ],
  loop: [
    { id: 'loop-pe', stageId: 'persistence',         tech: 'T1547',     day: 4,  label: 'Autorun Key',  host: 'HKU\\Run' },
    { id: 'loop-de', stageId: 'defense-evasion',     tech: 'T1562',     day: 5,  label: 'AMSI Bypass',  host: 'PowerShell' },
  ],
};

// Layout constants — now circle-based
const NODE_W = 100;       // column slot width (centres circles every 100+gap px)
const NODE_H = 64;        // circle diameter (2 * CIRCLE_R)
const LABEL_H = 50;       // height for labels below circle
const COL_GAP = 50;       // gap between circle centres
const ROW_GAP = LABEL_H + 40; // gap between rows (accounts for label below)
const PAD = 50;
const COLS = GRAPH_PATHS.main.length;
const TOTAL_W = PAD * 2 + COLS * NODE_W + (COLS - 1) * COL_GAP;
const ROW1_Y = PAD;                                 // main path
const ROW2_Y = ROW1_Y + NODE_H + ROW_GAP;          // SMB path
const LOOP_Y = ROW2_Y + NODE_H + ROW_GAP;          // loop nodes

// x-centre for a main path index
const nodeX = (i) => PAD + i * (NODE_W + COL_GAP) + NODE_W / 2;
// Find main path index for node that shares a stage
const mainIdx = (stageId) => GRAPH_PATHS.main.findIndex(n => n.stageId === stageId);

const TOTAL_H = LOOP_Y + NODE_H + LABEL_H + PAD * 2;

// Circle radius and label constants
const CIRCLE_R = 32;

function AttackNode({ node, x, y, stage, techName, detected, active, isImpact, onClick, scale }) {
  if (!stage) return null;
  const cx = x;
  const cy = y + CIRCLE_R; // circles are centred vertically at cy

  return (
    <g
      className="cursor-pointer"
      onClick={() => onClick(node)}
    >
      {/* Outer glow ring for active */}
      {active && (
        <motion.circle
          cx={cx} cy={cy} r={CIRCLE_R + 8}
          fill="none"
          stroke={stage.color}
          strokeWidth={1.5}
          opacity={0.3}
          animate={{ r: [CIRCLE_R + 6, CIRCLE_R + 12, CIRCLE_R + 6] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      {/* Pulsing outer ring for impact node */}
      {isImpact && (
        <motion.circle
          cx={cx} cy={cy} r={CIRCLE_R + 5}
          fill="none" stroke="#ef4444" strokeWidth={1.5}
          animate={{ opacity: [0.3, 0.9, 0.3] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
      )}

      {/* Main circle */}
      <motion.circle
        cx={cx} cy={cy} r={CIRCLE_R}
        fill={detected ? stage.bgColor : 'rgba(15,21,37,0.95)'}
        stroke={isImpact ? '#ef4444' : detected ? stage.borderColor : 'rgba(51,65,85,0.5)'}
        strokeWidth={active ? 2.5 : 1.5}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{
          opacity: 1, scale: 1,
          filter: active ? `drop-shadow(0 0 12px ${stage.color})` : isImpact ? 'drop-shadow(0 0 8px #ef4444)' : 'none',
        }}
        transition={{ duration: 0.4, delay: 0.1 }}
      />

      {/* Stage Icon (foreignObject centred in circle) */}
      <foreignObject x={cx - 14} y={cy - 14} width={28} height={28}>
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <stage.icon
            style={{
              width: 18,
              height: 18,
              color: detected ? stage.color : '#334155',
            }}
          />
        </div>
      </foreignObject>

      {/* Technique ID badge above label */}
      <text
        x={cx} y={cy + CIRCLE_R + 14}
        fontSize={8} fill={stage.color}
        fontFamily="JetBrains Mono, monospace"
        fontWeight="bold"
        textAnchor="middle"
      >
        {node.tech}
      </text>

      {/* Short label */}
      <text
        x={cx} y={cy + CIRCLE_R + 25}
        fontSize={9}
        fill={detected ? '#e2e8f0' : '#64748b'}
        fontFamily="Inter, sans-serif"
        fontWeight={600}
        textAnchor="middle"
      >
        {node.label}
      </text>

      {/* Day marker */}
      <text
        x={cx} y={cy + CIRCLE_R + 37}
        fontSize={8}
        fill={stage.color}
        fontFamily="JetBrains Mono, monospace"
        textAnchor="middle"
        opacity={0.7}
      >
        D{node.day}
      </text>
    </g>
  );
}

// Module-level counter for unique arrow marker IDs
let _arrowCounter = 0;

function Arrow({ x1, y1, x2, y2, color = '#334155', dashed = false, curved = false }) {
  const idRef = useRef(`arr-${++_arrowCounter}`);
  const id = idRef.current;
  let d;
  if (curved) {
    const cx = (x1 + x2) / 2;
    const cy = Math.max(y1, y2) + 40;
    d = `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
  } else {
    d = `M${x1},${y1} L${x2},${y2}`;
  }
  return (
    <g>
      <defs>
        <marker id={id} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill={color} opacity={0.7} />
        </marker>
      </defs>
      <motion.path
        d={d}
        stroke={color} strokeWidth={1.5}
        strokeDasharray={dashed ? '5,4' : 'none'}
        fill="none"
        markerEnd={`url(#${id})`}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.7 }}
        transition={{ duration: 1, delay: 0.6 }}
      />
    </g>
  );
}

export default function AttackPathDiagram({
  graph_nodes = [],
  graph_edges = [],
  incident_id = 'aiims_2022',
  autopsyResult = null,
}) {
  const [dayThreshold, setDayThreshold] = useState(22);
  const [onlyCompromised, setOnlyCompromised] = useState(false);
  const [activeNodeTypes, setActiveNodeTypes] = useState({
    HOST: true, ACCOUNT: true, IP: true, DOMAIN: true, PROCESS: true,
  });
  const [selectedNode, setSelectedNode] = useState(null);
  const [zoom, setZoom] = useState(0.9);

  const allTechIds = [...GRAPH_PATHS.main, ...GRAPH_PATHS.smb, ...GRAPH_PATHS.loop].map(n => n.tech);

  useEffect(() => {
    prefetchTechniques(allTechIds);
  }, [allTechIds.join(',')]);

  const { getTechniqueName } = useMitreLookup(allTechIds);

  const visibleMain = GRAPH_PATHS.main.filter(n => n.day <= dayThreshold);
  const visibleSmb = GRAPH_PATHS.smb.filter(n => n.day <= dayThreshold);
  const visibleLoop = GRAPH_PATHS.loop.filter(n => n.day <= dayThreshold);

  const stageById = Object.fromEntries(KILL_CHAIN_STAGES.map(s => [s.id, s]));

  const totalPaths = 3;
  const criticalPaths = 1;
  const compromisedNodes = visibleMain.length + visibleSmb.length;

  const handleZoomIn = () => setZoom(z => Math.min(1.5, z + 0.15));
  const handleZoomOut = () => setZoom(z => Math.max(0.4, z - 0.15));
  const handleFit = () => setZoom(0.9);

  const toggleNodeType = (type) =>
    setActiveNodeTypes(prev => ({ ...prev, [type]: !prev[type] }));

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'transparent' }}>

      {/* ── Left Control Panel ──────────────────────────────────────── */}
      <div
        className="w-64 shrink-0 border-r flex flex-col overflow-y-auto"
        style={{ background: 'rgba(11,15,23,0.8)', borderColor: 'rgba(30,37,48,0.8)' }}
      >
        <div className="p-4 flex flex-col gap-4">

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'ATTACK PATHS', value: totalPaths, color: '#06b6d4' },
              { label: 'CRITICAL', value: criticalPaths, color: '#ef4444' },
              { label: 'COMPROMISED', value: compromisedNodes, color: '#f59e0b' },
              { label: 'VISIBLE', value: visibleMain.length + visibleSmb.length, color: '#22c55e' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-lg p-2 text-center"
                style={{ background: 'rgba(15,21,37,0.8)', border: '1px solid rgba(30,41,59,0.8)' }}
              >
                <div className="font-mono text-base font-bold" style={{ color }}>{value}</div>
                <div className="text-[8px] font-mono text-slate-600 tracking-widest">{label}</div>
              </div>
            ))}
          </div>

          {/* Day Threshold slider */}
          <div>
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-2">
              <span>DAY THRESHOLD</span>
              <span className="text-cyan-400 font-bold">Day {dayThreshold} (T-{22 - dayThreshold})</span>
            </div>
            <input
              type="range" min={1} max={22} value={dayThreshold}
              onChange={e => setDayThreshold(Number(e.target.value))}
              className="w-full accent-cyan-400"
              style={{ height: '4px' }}
            />
            <div className="flex justify-between text-[8px] font-mono text-slate-600 mt-1">
              <span>T-21</span><span>T-0</span>
            </div>
          </div>

          {/* Show Only Compromised */}
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => setOnlyCompromised(v => !v)}
              className="w-9 h-5 rounded-full relative transition-all cursor-pointer"
              style={{
                background: onlyCompromised ? '#06b6d4' : 'rgba(30,41,59,0.8)',
                border: '1px solid rgba(51,65,85,0.5)',
              }}
            >
              <motion.div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
                animate={{ left: onlyCompromised ? '18px' : '2px' }}
                transition={{ type: 'spring', stiffness: 300 }}
              />
            </div>
            <span className="text-[10px] font-mono text-slate-400">Show Only Compromised</span>
          </label>

          {/* Entity type toggles */}
          <div>
            <div className="text-[9px] font-mono text-slate-600 tracking-widest mb-2">ENTITY TYPES</div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { key: 'HOST', color: '#00b4d8' },
                { key: 'ACCOUNT', color: '#f59e0b' },
                { key: 'IP', color: '#7c3aed' },
                { key: 'DOMAIN', color: '#ec4899' },
                { key: 'PROCESS', color: '#6b7280' },
              ].map(({ key, color }) => (
                <button
                  key={key}
                  onClick={() => toggleNodeType(key)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[9px] font-bold font-mono transition-all"
                  style={{
                    background: activeNodeTypes[key] ? `${color}18` : 'rgba(15,21,37,0.6)',
                    border: `1px solid ${activeNodeTypes[key] ? color + '50' : 'rgba(51,65,85,0.3)'}`,
                    color: activeNodeTypes[key] ? color : '#475569',
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: activeNodeTypes[key] ? color : '#334155' }} />
                  {key}
                </button>
              ))}
            </div>
          </div>

          {/* Zoom controls */}
          <div>
            <div className="text-[9px] font-mono text-slate-600 tracking-widest mb-2">ZOOM</div>
            <div className="flex gap-2 items-center">
              <button onClick={handleZoomOut} className="w-8 h-8 rounded flex items-center justify-center hover:bg-slate-800 transition-colors border border-slate-800">
                <ZoomOut className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <div className="flex-1 text-center text-[11px] font-mono text-slate-400">{Math.round(zoom * 100)}%</div>
              <button onClick={handleZoomIn} className="w-8 h-8 rounded flex items-center justify-center hover:bg-slate-800 transition-colors border border-slate-800">
                <ZoomIn className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button onClick={handleFit} className="w-8 h-8 rounded flex items-center justify-center hover:bg-slate-800 transition-colors border border-slate-800" title="Fit">
                <Maximize className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Legend */}
          <div>
            <div className="text-[9px] font-mono text-slate-600 tracking-widest mb-2">KILL CHAIN LEGEND</div>
            <div className="space-y-1">
              {KILL_CHAIN_STAGES.map(s => (
                <div key={s.id} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color, opacity: 0.8 }} />
                  <span className="text-[9px] font-mono text-slate-400">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Entity Criticality gradient bar */}
          <div>
            <div className="text-[9px] font-mono text-slate-600 tracking-widest mb-1.5">ENTITY CRITICALITY</div>
            <div
              className="h-2 rounded-full"
              style={{ background: 'linear-gradient(90deg, #22c55e, #f59e0b, #ef4444)' }}
            />
            <div className="flex justify-between text-[8px] font-mono text-slate-600 mt-0.5">
              <span>Low</span><span>Med</span><span>Critical</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main SVG Diagram ────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto relative" style={{ background: '#070c14' }}>
        {/* Grid background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(30,41,59,0.8) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Top bar */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 border-b"
          style={{ background: 'rgba(7,12,20,0.95)', borderColor: 'rgba(30,41,59,0.6)', backdropFilter: 'blur(8px)' }}
        >
          {/* Left: title + filter badge */}
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono text-slate-500 tracking-widest uppercase">Attack Graph</span>
            <span
              className="text-[9px] font-mono px-2 py-0.5 rounded"
              style={{ background: 'rgba(6,182,212,0.1)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.3)' }}
            >
              {visibleMain.length + visibleSmb.length + visibleLoop.length} NODES · Day 1 → Day {dayThreshold}
            </span>
          </div>

          {/* Right: key stats */}
          <div className="flex items-center gap-6">
            {[
              { label: 'ATTACK PATHS', value: totalPaths, color: '#06b6d4' },
              { label: 'CRITICAL PATHS', value: criticalPaths, color: '#ef4444' },
              { label: 'COMPROMISED NODES', value: compromisedNodes, color: '#f59e0b' },
              { label: 'LAST UPDATED', value: new Date().toLocaleTimeString('en-IN', { hour12: false }), color: '#22c55e' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex flex-col items-end">
                <span className="font-mono text-xs font-bold" style={{ color }}>{value}</span>
                <span className="text-[8px] font-mono text-slate-600 tracking-widest">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SVG diagram */}
        <div className="overflow-auto p-6">
          <svg
            width={TOTAL_W * zoom}
            height={TOTAL_H * zoom}
            viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
            style={{ display: 'block', transformOrigin: 'top left' }}
          >
            <defs>
              <filter id="glow-node" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* ── Path labels ── */}
            <text x={PAD} y={ROW1_Y - 10} fontSize={9} fill="#475569" fontFamily="JetBrains Mono" fontWeight="bold">
              ● MAIN ATTACK PATH (Ransomware)
            </text>
            {visibleSmb.length > 0 && (
              <text x={PAD} y={ROW2_Y - 8} fontSize={9} fill="#475569" fontFamily="JetBrains Mono" fontWeight="bold">
                ● LATERAL MOVEMENT (SMB/RDP)
              </text>
            )}
            {visibleLoop.length > 0 && (
              <text x={PAD} y={LOOP_Y - 8} fontSize={9} fill="#475569" fontFamily="JetBrains Mono" fontWeight="bold">
                ↩ PERSISTENCE LOOP-BACK
              </text>
            )}

            {/* ── Main path arrows ── */}
            {visibleMain.slice(0, -1).map((n, i) => {
              const x1 = nodeX(i) + CIRCLE_R;
              const x2 = nodeX(i + 1) - CIRCLE_R;
              const y = ROW1_Y + CIRCLE_R;
              const stage = stageById[n.stageId];
              return (
                <Arrow key={`ma-${i}`} x1={x1} y1={y} x2={x2} y2={y} color={stage?.color || '#334155'} />
              );
            })}

            {/* ── SMB path: branch from main[2] down, then right ── */}
            {visibleSmb.length > 0 && (() => {
              const branchMainIdx = 2; // persistence node branches to SMB
              const bx = nodeX(branchMainIdx);
              const by = ROW1_Y + CIRCLE_R * 2;
              // First SMB node is under main[3]
              const smb0x = nodeX(3);
              const smb1x = nodeX(4);
              const sy = ROW2_Y + CIRCLE_R;
              return (
                <>
                  <Arrow x1={bx} y1={by} x2={smb0x} y2={ROW2_Y} color="#f59e0b" />
                  {visibleSmb.length > 1 && <Arrow x1={smb0x + CIRCLE_R} y1={sy} x2={smb1x - CIRCLE_R} y2={sy} color="#f59e0b" />}
                  {/* Merge SMB back to main[5] */}
                  <Arrow x1={smb1x} y1={ROW2_Y} x2={nodeX(5)} y2={ROW1_Y + CIRCLE_R * 2} color="#f59e0b" dashed />
                </>
              );
            })()}

            {/* ── Loop-back: dashed curved path from impact → persistence ── */}
            {visibleLoop.length > 0 && visibleMain.length >= 8 && (
              <Arrow
                x1={nodeX(7)} y1={ROW1_Y + CIRCLE_R * 2}
                x2={nodeX(2)} y2={ROW1_Y + CIRCLE_R * 2}
                color="#7c3aed" dashed curved
              />
            )}

            {/* ── Main path nodes ── */}
            {visibleMain.map((node, i) => {
              const stage = stageById[node.stageId];
              return (
                <AttackNode
                  key={node.id}
                  node={node}
                  x={nodeX(i)}
                  y={ROW1_Y}
                  stage={stage}
                  techName={getTechniqueName(node.tech)}
                  detected={true}
                  active={selectedNode?.id === node.id}
                  isImpact={node.stageId === 'impact'}
                  onClick={setSelectedNode}
                  scale={zoom}
                />
              );
            })}

            {/* ── SMB path nodes ── */}
            {visibleSmb.map((node, i) => {
              const stage = stageById[node.stageId];
              const x = nodeX(3 + i);
              return (
                <AttackNode
                  key={node.id}
                  node={node}
                  x={x}
                  y={ROW2_Y}
                  stage={stage}
                  techName={getTechniqueName(node.tech)}
                  detected={true}
                  active={selectedNode?.id === node.id}
                  isImpact={false}
                  onClick={setSelectedNode}
                  scale={zoom}
                />
              );
            })}

            {/* ── Loop nodes ── */}
            {visibleLoop.map((node, i) => {
              const stage = stageById[node.stageId];
              const x = nodeX(2 + i);
              return (
                <AttackNode
                  key={node.id}
                  node={node}
                  x={x}
                  y={LOOP_Y}
                  stage={stage}
                  techName={getTechniqueName(node.tech)}
                  detected={true}
                  active={selectedNode?.id === node.id}
                  isImpact={false}
                  onClick={setSelectedNode}
                  scale={zoom}
                />
              );
            })}

            {/* ── Day axis ── */}
            <line x1={PAD} y1={TOTAL_H - 20} x2={TOTAL_W - PAD} y2={TOTAL_H - 20} stroke="rgba(51,65,85,0.4)" strokeWidth={1} />
            {[1, 3, 7, 12, 22].map((day, i) => {
              const mainNode = GRAPH_PATHS.main.find(n => n.day === day);
              const midx = mainNode ? nodeX(GRAPH_PATHS.main.indexOf(mainNode)) : undefined;
              if (!midx) return null;
              return (
                <g key={day}>
                  <line x1={midx} y1={TOTAL_H - 24} x2={midx} y2={TOTAL_H - 18} stroke="rgba(51,65,85,0.6)" strokeWidth={1} />
                  <text x={midx} y={TOTAL_H - 8} fontSize={8} fill={day === 22 ? '#ef4444' : '#475569'} textAnchor="middle" fontFamily="JetBrains Mono">
                    Day {day}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Node detail panel */}
        <AnimatePresence>
          {selectedNode && (() => {
            const stage = stageById[selectedNode.stageId];
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-4 right-4 w-72 rounded-xl border p-4 z-20"
                style={{
                  background: 'rgba(11,15,23,0.97)',
                  borderColor: stage?.borderColor || 'rgba(51,65,85,0.5)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold font-mono text-white tracking-widest">NODE DETAIL</span>
                  <button onClick={() => setSelectedNode(null)} className="text-slate-600 hover:text-slate-400 text-xs">✕</button>
                </div>
                <div className="space-y-2 text-[10px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">TECHNIQUE</span>
                    <span className="text-cyan-400 font-bold">{selectedNode.tech}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">NAME</span>
                    <span className="text-slate-200">{getTechniqueName(selectedNode.tech)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">STAGE</span>
                    <span style={{ color: stage?.color }}>{stage?.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">HOST/TARGET</span>
                    <span className="text-slate-300">{selectedNode.host}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">TIMELINE</span>
                    <span style={{ color: stage?.color }}>Day {selectedNode.day} (T-{22 - selectedNode.day})</span>
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>
    </div>
  );
}
