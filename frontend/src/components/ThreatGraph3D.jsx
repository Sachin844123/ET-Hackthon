import React, { useRef, useState, useEffect, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';

// Map Neo4j node types to colors
const NODE_COLORS = {
  HOST: '#00b4d8',
  ACCOUNT: '#f59e0b',
  IP: '#7c3aed',
  DOMAIN: '#ec4899',
  PROCESS: '#6b7280'
};

const EDGE_COLORS = {
  COMMUNICATED_WITH: '#334155',
  AUTHENTICATED_AS: '#f59e0b',
  EXECUTED_PROCESS: '#7c3aed',
  LATERAL_MOVEMENT: '#ef4444' // animated red
};

export default function ThreatGraph3D({ graph_nodes = [], graph_edges = [], incident_id }) {
  const fgRef = useRef();
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [timeWindow, setTimeWindow] = useState(22); // Day 1 to 22
  const [onlyCompromised, setOnlyCompromised] = useState(false);
  const [nodeTypes, setNodeTypes] = useState({
    HOST: true, ACCOUNT: true, IP: true, DOMAIN: true, PROCESS: true
  });

  const handleNodeClick = useCallback(node => {
    setSelectedNode(node);
    setSelectedEdge(null);
    // Aim at node
    const distance = 60;
    const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
    fgRef.current.cameraPosition(
      { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, 
      node, 
      1500 
    );
  }, [fgRef]);

  const handleEdgeClick = useCallback(edge => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const resetCamera = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
    fgRef.current.cameraPosition({ x: 0, y: 0, z: 250 }, { x: 0, y: 0, z: 0 }, 1500);
  }, [fgRef]);

  const focusAttackPath = useCallback(() => {
    const compNodes = graph_nodes.filter(n => n.is_compromised);
    if (compNodes.length > 0) {
      fgRef.current.cameraPosition({ x: compNodes[0].x, y: compNodes[0].y, z: 150 }, compNodes[0], 2000);
    }
  }, [graph_nodes]);

  // Filtering logic based on time window and type/compromise filters
  // For demo, we simulate time revealing nodes. We assume nodes have a val or we use heuristics.
  const filteredNodes = graph_nodes.filter(node => {
    if (!nodeTypes[node.type]) return false;
    if (onlyCompromised && !node.is_compromised) return false;
    
    // Simulate time filtering (AIIMS specific heuristic for demo visual)
    if (incident_id?.includes('aiims')) {
      if (timeWindow < 3 && node.id === 'AIIMS-PATIENT-MGMT-01') return false;
      if (timeWindow < 7 && node.id === 'AIIMS-FILE-SRV-02') return false;
      if (timeWindow < 12 && (node.type === 'IP' || node.type === 'DOMAIN')) return false;
    }
    return true;
  });

  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = graph_edges.filter(edge => 
    filteredNodeIds.has(typeof edge.source === 'object' ? edge.source.id : edge.source) &&
    filteredNodeIds.has(typeof edge.target === 'object' ? edge.target.id : edge.target)
  );

  return (
    <div className="relative w-full h-[600px] bg-[#0a0e1a] rounded-lg border-2 border-slate-800 shadow-xl overflow-hidden flex animate-fade-in-up">
      
      {/* Controls Panel (Top Left) */}
      <div className="absolute top-4 left-4 z-10 bg-slate-900/85 p-4 rounded-lg border border-slate-700 backdrop-blur-md shadow-2xl text-xs w-64">
        <h3 className="text-slate-200 font-bold mb-3 tracking-widest border-b border-slate-800 pb-2">GRAPH CONTROLS</h3>
        
        <div className="mb-4">
          <div className="flex justify-between text-[11px] text-slate-300 font-semibold mb-1">
            <span>Day Threshold</span>
            <span className="text-cyan-400 font-mono">Day {timeWindow}</span>
          </div>
          <input type="range" min="1" max="22" value={timeWindow} 
                 onChange={e => setTimeWindow(parseInt(e.target.value))}
                 className="w-full accent-cyan-500 cursor-pointer" />
          <div className="flex justify-between text-[9px] text-slate-500 mt-1">
            <span>Day 1 (Initial Access)</span>
            <span>Day 22 (Impact)</span>
          </div>
        </div>

        <div className="mb-4 space-y-1">
          <label className="flex items-center text-slate-300 cursor-pointer hover:text-white transition-colors">
            <input type="checkbox" checked={onlyCompromised} onChange={e => setOnlyCompromised(e.target.checked)} className="mr-2 accent-red-500" />
            Show only compromised
          </label>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 text-[10px]">
          {Object.keys(NODE_COLORS).map(type => (
            <label key={type} className="flex items-center text-slate-400 cursor-pointer hover:text-slate-200 transition-colors">
              <input type="checkbox" checked={nodeTypes[type]} 
                     onChange={e => setNodeTypes(p => ({...p, [type]: e.target.checked}))} 
                     className="mr-2 accent-cyan-500" />
              <span style={{ color: NODE_COLORS[type] }}>●</span> &nbsp;{type}
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
          <button onClick={resetCamera} className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded font-bold tracking-wider transition-colors border border-slate-600">
            RESET CAMERA
          </button>
          <button onClick={focusAttackPath} className="bg-red-950/30 hover:bg-red-900/50 text-red-400 py-2 rounded font-bold tracking-wider transition-colors border border-red-800 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
            FOCUS ON ATTACK PATH
          </button>
        </div>
      </div>

      {/* Detail Panel (Right) */}
      {(selectedNode || selectedEdge) && (
        <div className="absolute top-4 right-4 z-10 bg-slate-900/90 p-5 rounded-lg border-2 border-slate-700 backdrop-blur-md shadow-2xl text-sm w-80 animate-slide-in-right">
          <button onClick={() => { setSelectedNode(null); setSelectedEdge(null); }} className="absolute top-2 right-3 text-slate-500 hover:text-white transition-colors">✕</button>
          
          {selectedNode && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: NODE_COLORS[selectedNode.type] || '#ccc' }} />
                <span className="text-[10px] tracking-widest text-slate-400 font-bold uppercase">{selectedNode.type}</span>
              </div>
              <h2 className="text-white font-bold text-lg mb-3 break-all font-mono border-b border-slate-800 pb-2">{selectedNode.name || selectedNode.id}</h2>
              
              {selectedNode.is_compromised && (
                <div className="bg-red-900/40 text-red-400 border border-red-500/50 px-3 py-1 rounded text-xs font-bold mb-4 inline-flex items-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.25)]">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  COMPROMISED NODE
                </div>
              )}
              
              <div className="space-y-3 mt-2">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Criticality</div>
                  <div className="text-slate-300 font-medium">{selectedNode.criticality || 'NORMAL'}</div>
                </div>
                {selectedNode.is_compromised && (
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Observed Techniques</div>
                    <ul className="text-slate-300 text-xs list-disc pl-4 mt-1 space-y-1">
                      <li>T1078 Valid Accounts</li>
                      <li>T1021.002 SMB Shares</li>
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}

          {selectedEdge && (
            <>
              <div className="text-[10px] tracking-widest text-slate-400 mb-1 font-bold">RELATIONSHIP</div>
              <h2 className="text-cyan-400 font-bold mb-3 border-b border-slate-800 pb-2">{selectedEdge.type || 'CONNECTED_TO'}</h2>
              
              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Source</div>
                  <div className="text-slate-300 font-mono break-all">{selectedEdge.source?.id || selectedEdge.source}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Target</div>
                  <div className="text-slate-300 font-mono break-all">{selectedEdge.target?.id || selectedEdge.target}</div>
                </div>
                {selectedEdge.anomalous && (
                  <div className="mt-4 bg-amber-900/30 border border-amber-500/50 p-3 rounded shadow-lg">
                    <span className="text-amber-400 font-bold block mb-1">Anomalous Activity Detected</span>
                    <span className="text-slate-300 text-[10px] leading-relaxed">Score: 0.89 | Volume spike + Off-hours</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ForceGraph3D Canvas */}
      <div className="flex-1 cursor-crosshair">
        <ForceGraph3D
          ref={fgRef}
          graphData={{ nodes: filteredNodes, links: filteredEdges }}
          nodeRelSize={4}
          nodeVal={node => Math.max(4, Math.min(20, node.val || 4))}
          nodeColor={node => NODE_COLORS[node.type] || '#ffffff'}
          nodeResolution={24}
          nodeOpacity={0.9}
          linkWidth={edge => edge.anomalous ? 2.5 : 0.8}
          linkColor={edge => edge.anomalous ? EDGE_COLORS.LATERAL_MOVEMENT : EDGE_COLORS.COMMUNICATED_WITH}
          linkDirectionalParticles={edge => edge.anomalous ? 5 : 0}
          linkDirectionalParticleSpeed={0.015}
          linkDirectionalParticleWidth={2.5}
          onNodeClick={handleNodeClick}
          onLinkClick={handleEdgeClick}
          backgroundColor="#0a0e1a"
          showNavInfo={false}
          nodeThreeObject={node => {
            const size = Math.max(4, Math.min(20, node.val || 4));
            const group = new THREE.Group();
            
            // Core sphere
            const coreGeometry = new THREE.SphereGeometry(size, 16, 16);
            const coreMaterial = new THREE.MeshLambertMaterial({
              color: NODE_COLORS[node.type] || '#ffffff',
              transparent: true,
              opacity: 0.95
            });
            const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
            group.add(coreMesh);

            // Halo for compromised nodes
            if (node.is_compromised) {
              const haloGeometry = new THREE.SphereGeometry(size * 1.5, 12, 12);
              const haloMaterial = new THREE.MeshBasicMaterial({ 
                color: '#ef4444', 
                transparent: true, 
                opacity: 0.25,
                wireframe: true
              });
              const haloMesh = new THREE.Mesh(haloGeometry, haloMaterial);
              group.add(haloMesh);
            }
            return group;
          }}
        />
      </div>
    </div>
  );
}
