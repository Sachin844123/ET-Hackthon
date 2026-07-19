import React from 'react';

/**
 * KillChainNode — shared stage node used in:
 *   - Landing hero "AI Investigation Workspace" (size="compact")
 *   - Tab 1 Kill Chain row (size="full")
 *   - Tab 2 Attack Path Diagram nodes (size="medium")
 *
 * Props:
 *   stage      — one entry from KILL_CHAIN_STAGES
 *   techniqueId — e.g. "T1078"
 *   techniqueName — resolved name from useMitreLookup
 *   confidence — 0-1 float (optional)
 *   detected   — boolean
 *   size       — "compact" | "medium" | "full"
 *   active     — highlight ring
 *   onClick    — callback
 */
export default function KillChainNode({
  stage,
  techniqueId,
  techniqueName,
  confidence,
  detected = false,
  size = 'full',
  active = false,
  onClick,
}) {
  if (!stage) return null;
  const Icon = stage.icon;

  const SIZE_CONFIGS = {
    compact: {
      wrap: 'w-28 p-2',
      icon: 'w-8 h-8 p-1.5',
      iconSize: 'w-4 h-4',
      label: 'text-[8px]',
      idText: 'text-[7px]',
      nameText: 'text-[8px]',
    },
    medium: {
      wrap: 'w-36 p-2.5',
      icon: 'w-10 h-10 p-2',
      iconSize: 'w-5 h-5',
      label: 'text-[9px]',
      idText: 'text-[8px]',
      nameText: 'text-[9px]',
    },
    full: {
      wrap: 'w-44 p-3',
      icon: 'w-12 h-12 p-2.5',
      iconSize: 'w-6 h-6',
      label: 'text-[10px]',
      idText: 'text-[9px]',
      nameText: 'text-[10px]',
    },
  };

  const s = SIZE_CONFIGS[size] || SIZE_CONFIGS.full;

  return (
    <div
      onClick={onClick}
      className={`${s.wrap} rounded-lg border flex flex-col items-center gap-1.5 cursor-pointer transition-all duration-300 select-none`}
      style={{
        background: detected ? stage.bgColor : 'rgba(15,21,37,0.8)',
        borderColor: active
          ? stage.color
          : detected
          ? stage.borderColor
          : 'rgba(51,65,85,0.6)',
        boxShadow: active
          ? `0 0 16px ${stage.color}60, 0 0 4px ${stage.color}40`
          : detected
          ? `0 0 8px ${stage.color}30`
          : 'none',
      }}
    >
      {/* Icon circle */}
      <div
        className={`${s.icon} rounded-full flex items-center justify-center`}
        style={{
          background: detected ? `${stage.color}25` : 'rgba(30,41,59,0.8)',
          border: `1.5px solid ${detected ? stage.borderColor : 'rgba(51,65,85,0.5)'}`,
        }}
      >
        <Icon
          className={s.iconSize}
          style={{ color: detected ? stage.color : '#475569' }}
        />
      </div>

      {/* Stage label */}
      <span
        className={`${s.label} font-bold tracking-widest font-mono text-center leading-tight`}
        style={{ color: detected ? stage.color : '#64748b' }}
      >
        {stage.shortLabel}
      </span>

      {/* Technique ID + name (only if provided) */}
      {techniqueId && (
        <div className="flex flex-col items-center gap-0.5">
          <span
            className={`${s.idText} font-mono font-bold px-1.5 py-0.5 rounded`}
            style={{
              color: stage.color,
              background: `${stage.color}15`,
              border: `1px solid ${stage.color}40`,
            }}
          >
            {techniqueId}
          </span>
          {techniqueName && (
            <span
              className={`${s.nameText} font-mono text-center leading-tight`}
              style={{ color: '#94a3b8', maxWidth: '100%' }}
            >
              {techniqueName.length > 20
                ? techniqueName.slice(0, 18) + '…'
                : techniqueName}
            </span>
          )}
        </div>
      )}

      {/* Confidence badge */}
      {confidence !== undefined && detected && (
        <span
          className={`${s.idText} font-mono font-bold px-1 py-0.5 rounded`}
          style={{
            color: confidence >= 0.9 ? '#ef4444' : confidence >= 0.75 ? '#f59e0b' : '#06b6d4',
            background: confidence >= 0.9
              ? 'rgba(239,68,68,0.15)'
              : confidence >= 0.75
              ? 'rgba(245,158,11,0.15)'
              : 'rgba(6,182,212,0.15)',
          }}
        >
          {Math.round(confidence * 100)}%
        </span>
      )}
    </div>
  );
}
