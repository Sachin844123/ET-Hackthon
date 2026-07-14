import React from 'react';
import { SEVERITY_CONFIG } from '../constants/threatFeed';

const SEVERITY_ICONS = {
  CRITICAL: '💀',
  HIGH: '🐛',
  MEDIUM: '⚡',
  LOW: '📡',
};

/**
 * ThreatFeedItem — shared threat feed row.
 * Used in:
 *   - Landing page "Recent Intelligence" panel
 *   - Tab 5 "Live Threat Feed" horizontal strip
 *
 * Props:
 *   item    — object from THREAT_FEED_ITEMS
 *   compact — boolean (horizontal strip in Tab 5 uses compact=true)
 */
export default function ThreatFeedItem({ item, compact = false }) {
  const cfg = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.LOW;

  if (compact) {
    return (
      <div
        className="flex-shrink-0 w-72 rounded-lg p-3 border flex flex-col gap-2 cursor-pointer transition-all duration-200 hover:scale-[1.02]"
        style={{
          background: cfg.bg,
          borderColor: cfg.border,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[9px] font-bold font-mono px-2 py-0.5 rounded tracking-widest"
            style={{ color: cfg.color, background: `${cfg.color}20`, border: `1px solid ${cfg.border}` }}
          >
            {item.severity}
          </span>
          <span className="text-[9px] text-slate-500 font-mono">{item.timeAgo}</span>
        </div>
        <p className="text-[11px] text-slate-200 font-semibold leading-tight line-clamp-2">{item.headline}</p>
        <p className="text-[10px] text-slate-400 leading-tight line-clamp-2">{item.description}</p>
        <div className="flex items-center gap-1.5 mt-auto pt-1 border-t border-slate-800/60">
          <span className="text-[10px]">{item.sourceIcon}</span>
          <span className="text-[9px] text-slate-500 font-mono">Source: {item.source}</span>
          {item.technique && (
            <span
              className="ml-auto text-[8px] font-mono px-1.5 py-0.5 rounded"
              style={{ color: '#06b6d4', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)' }}
            >
              {item.technique}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Full row variant (Landing page)
  return (
    <div
      className="flex items-center gap-3 py-3 px-3 rounded-lg border transition-all duration-200 cursor-pointer group hover:border-opacity-80"
      style={{
        background: 'rgba(15,21,37,0.6)',
        borderColor: 'rgba(51,65,85,0.4)',
      }}
    >
      {/* Severity icon circle */}
      <div
        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-base"
        style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}
      >
        {SEVERITY_ICONS[item.severity] || '⚠️'}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded tracking-widest flex-shrink-0"
            style={{ color: cfg.color, background: `${cfg.color}20` }}
          >
            {item.severity}
          </span>
          <span className="text-[11px] text-slate-200 font-medium truncate">{item.headline}</span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono truncate">
          {item.source} · {item.technique}
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-right flex-shrink-0">
        <div className="text-[10px] text-slate-400 font-mono">{item.timestamp}</div>
        <div className="text-[9px] text-slate-600 font-mono">{item.timeAgo}</div>
      </div>

      {/* Chevron */}
      <svg className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}
