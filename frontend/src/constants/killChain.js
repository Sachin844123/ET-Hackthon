// ── Kill Chain Stage Definitions ─────────────────────────────────────────────
// Single source of truth. Import this everywhere a stage icon/color is needed.
// Never redefine per-component.

import {
  LogIn, Terminal, Anchor, ArrowUpCircle, EyeOff,
  Network, Database, Upload, Zap
} from 'lucide-react';

export const KILL_CHAIN_STAGES = [
  {
    id: 'initial-access',
    label: 'Initial Access',
    shortLabel: 'INITIAL\nACCESS',
    icon: LogIn,
    color: '#06b6d4',          // cyan
    bgColor: 'rgba(6,182,212,0.12)',
    borderColor: 'rgba(6,182,212,0.5)',
    tactic: 'initial-access',
    demoDay: 1,
    demoTValue: 'T-21',
  },
  {
    id: 'execution',
    label: 'Execution',
    shortLabel: 'EXECUTION',
    icon: Terminal,
    color: '#8b5cf6',          // purple
    bgColor: 'rgba(139,92,246,0.12)',
    borderColor: 'rgba(139,92,246,0.5)',
    tactic: 'execution',
    demoDay: 2,
    demoTValue: 'T-20',
  },
  {
    id: 'persistence',
    label: 'Persistence',
    shortLabel: 'PERSISTENCE',
    icon: Anchor,
    color: '#a855f7',          // purple-500
    bgColor: 'rgba(168,85,247,0.12)',
    borderColor: 'rgba(168,85,247,0.5)',
    tactic: 'persistence',
    demoDay: 3,
    demoTValue: 'T-19',
  },
  {
    id: 'privilege-escalation',
    label: 'Privilege Escalation',
    shortLabel: 'PRIV ESC',
    icon: ArrowUpCircle,
    color: '#f97316',          // orange
    bgColor: 'rgba(249,115,22,0.12)',
    borderColor: 'rgba(249,115,22,0.5)',
    tactic: 'privilege-escalation',
    demoDay: 4,
    demoTValue: 'T-18',
  },
  {
    id: 'defense-evasion',
    label: 'Defense Evasion',
    shortLabel: 'DEFENSE\nEVASION',
    icon: EyeOff,
    color: '#eab308',          // yellow
    bgColor: 'rgba(234,179,8,0.12)',
    borderColor: 'rgba(234,179,8,0.5)',
    tactic: 'defense-evasion',
    demoDay: 5,
    demoTValue: 'T-17',
  },
  {
    id: 'lateral-movement',
    label: 'Lateral Movement',
    shortLabel: 'LATERAL\nMOVEMENT',
    icon: Network,
    color: '#f59e0b',          // amber
    bgColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.5)',
    tactic: 'lateral-movement',
    demoDay: 7,
    demoTValue: 'T-15',
  },
  {
    id: 'collection',
    label: 'Collection',
    shortLabel: 'COLLECTION',
    icon: Database,
    color: '#10b981',          // emerald
    bgColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.5)',
    tactic: 'collection',
    demoDay: 7,
    demoTValue: 'T-15',
  },
  {
    id: 'exfiltration',
    label: 'Exfiltration',
    shortLabel: 'EXFILTRATION',
    icon: Upload,
    color: '#f43f5e',          // rose
    bgColor: 'rgba(244,63,94,0.12)',
    borderColor: 'rgba(244,63,94,0.5)',
    tactic: 'exfiltration',
    demoDay: 12,
    demoTValue: 'T-10',
  },
  {
    id: 'impact',
    label: 'Impact',
    shortLabel: 'IMPACT',
    icon: Zap,
    color: '#ef4444',          // red
    bgColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.7)',
    tactic: 'impact',
    demoDay: 22,
    demoTValue: 'T-0',
  },
];

// Lookup by tactic string (partial match)
export function getStageByTactic(tactic = '') {
  const t = tactic.toLowerCase();
  return KILL_CHAIN_STAGES.find(s =>
    t.includes(s.id) || t.includes(s.tactic) || s.label.toLowerCase().includes(t)
  ) || null;
}

// Lookup by technique ID using heuristic tactic mapping
const TACTIC_BY_TECHNIQUE = {
  T1078: 'initial-access',
  T1190: 'initial-access',
  T1566: 'initial-access',
  T1059: 'execution',
  'T1059.001': 'execution',
  T1547: 'persistence',
  'T1053.005': 'persistence',
  T1068: 'privilege-escalation',
  T1562: 'defense-evasion',
  'T1562.001': 'defense-evasion',
  'T1021.002': 'lateral-movement',
  'T1560.001': 'collection',
  T1048: 'exfiltration',
  'T1071.001': 'exfiltration',
  T1486: 'impact',
  T1490: 'impact',
  T1531: 'impact',
};

export function getStageByTechniqueId(techniqueId = '') {
  const tacticId = TACTIC_BY_TECHNIQUE[techniqueId];
  if (tacticId) return KILL_CHAIN_STAGES.find(s => s.id === tacticId) || null;
  return null;
}
