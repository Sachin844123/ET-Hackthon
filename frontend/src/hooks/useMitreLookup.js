// ── useMitreLookup — Shared MITRE Technique Name Resolver ────────────────────
// Module-level cache (persists across renders, avoids re-fetching).
// Usage:
//   const { getTechnique, loading } = useMitreLookup();
//   const tech = getTechnique('T1078');  // { name, tactic, description } or null

import { useState, useEffect, useCallback } from 'react';

// Module-level cache — shared across all component instances
const MITRE_CACHE = new Map();
const PENDING_FETCHES = new Set();

// Fallback stubs for offline / API-key-less demos
const MITRE_STUBS = {
  'T1078':     { name: 'Valid Accounts',                tactic: 'Initial Access',     description: 'Abusing valid credentials to gain access.' },
  'T1190':     { name: 'Exploit Public-Facing App',     tactic: 'Initial Access',     description: 'Exploiting vulnerabilities in internet-facing systems.' },
  'T1566':     { name: 'Phishing',                      tactic: 'Initial Access',     description: 'Sending phishing messages to gain access.' },
  'T1059':     { name: 'Command and Scripting Interp.', tactic: 'Execution',          description: 'Abusing command/scripting interpreters.' },
  'T1059.001': { name: 'PowerShell',                    tactic: 'Execution',          description: 'Using PowerShell for malicious execution.' },
  'T1547':     { name: 'Boot/Logon Autostart Exec.',    tactic: 'Persistence',        description: 'Establishing persistence via autostart mechanisms.' },
  'T1053.005': { name: 'Scheduled Task',                tactic: 'Persistence',        description: 'Creating or modifying scheduled tasks.' },
  'T1087.002': { name: 'Domain Account Discovery',      tactic: 'Discovery',          description: 'Enumerating domain accounts.' },
  'T1068':     { name: 'Exploitation for Priv Esc',     tactic: 'Priv. Escalation',   description: 'Exploiting vulnerabilities to escalate privileges.' },
  'T1562':     { name: 'Impair Defenses',               tactic: 'Defense Evasion',    description: 'Disabling or manipulating security tools.' },
  'T1562.001': { name: 'Disable/Modify Tools',          tactic: 'Defense Evasion',    description: 'Disabling security software.' },
  'T1021.002': { name: 'SMB/Windows Admin Shares',      tactic: 'Lateral Movement',   description: 'Moving laterally using SMB protocol.' },
  'T1560.001': { name: 'Archive via Utility',           tactic: 'Collection',         description: 'Archiving collected data using utilities like 7zip.' },
  'T1048':     { name: 'Exfil Over Alt. Protocol',      tactic: 'Exfiltration',       description: 'Exfiltrating data over non-standard channels.' },
  'T1071.001': { name: 'Web Protocols C2',              tactic: 'Command & Control',  description: 'Using HTTP/S for C2 communication.' },
  'T1486':     { name: 'Data Encrypted for Impact',     tactic: 'Impact',             description: 'Encrypting data to disrupt operations (ransomware).' },
  'T1490':     { name: 'Inhibit System Recovery',       tactic: 'Impact',             description: 'Deleting shadow copies and backups.' },
  'T1531':     { name: 'Account Access Removal',        tactic: 'Impact',             description: 'Removing or locking out accounts.' },
};

async function fetchTechnique(techniqueId) {
  if (MITRE_CACHE.has(techniqueId)) return MITRE_CACHE.get(techniqueId);
  if (PENDING_FETCHES.has(techniqueId)) {
    // Wait for the in-flight fetch
    await new Promise(resolve => setTimeout(resolve, 500));
    return MITRE_CACHE.get(techniqueId) || MITRE_STUBS[techniqueId] || null;
  }

  PENDING_FETCHES.add(techniqueId);
  try {
    const res = await fetch(`/api/mitre/technique/${techniqueId}`);
    if (res.ok) {
      const data = await res.json();
      MITRE_CACHE.set(techniqueId, data);
      return data;
    }
  } catch {
    // Network error — fall through to stub
  } finally {
    PENDING_FETCHES.delete(techniqueId);
  }

  // Use stub as fallback
  const stub = MITRE_STUBS[techniqueId] || null;
  if (stub) MITRE_CACHE.set(techniqueId, stub);
  return stub;
}

/**
 * Prefetch a list of technique IDs at component mount time.
 * Call this in the parent that knows all IDs upfront.
 */
export function prefetchTechniques(ids = []) {
  ids.forEach(id => {
    if (id && !MITRE_CACHE.has(id)) fetchTechnique(id);
  });
}

/**
 * Hook — resolves MITRE technique IDs to { name, tactic, description }.
 * Returns getTechnique(id) which is synchronous if already cached.
 */
export function useMitreLookup(initialIds = []) {
  const [version, setVersion] = useState(0);

  // Pre-fetch any IDs provided at mount
  useEffect(() => {
    if (initialIds.length === 0) return;
    const missing = initialIds.filter(id => id && !MITRE_CACHE.has(id));
    if (missing.length === 0) return;

    Promise.all(missing.map(fetchTechnique)).then(() => {
      setVersion(v => v + 1); // trigger re-render with resolved names
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIds.join(',')]);

  const getTechnique = useCallback((techniqueId) => {
    if (!techniqueId) return null;
    // Return cached immediately
    if (MITRE_CACHE.has(techniqueId)) return MITRE_CACHE.get(techniqueId);
    // Trigger async fetch and return stub in the meantime
    fetchTechnique(techniqueId).then(() => setVersion(v => v + 1));
    return MITRE_STUBS[techniqueId] || { name: techniqueId, tactic: 'Unknown', description: '' };
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const getTechniqueName = useCallback((techniqueId) => {
    const tech = getTechnique(techniqueId);
    return tech?.name || techniqueId;
  }, [getTechnique]);

  return { getTechnique, getTechniqueName };
}

export default useMitreLookup;
