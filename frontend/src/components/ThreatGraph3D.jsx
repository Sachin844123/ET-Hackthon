import React, { useRef, useState, useEffect, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';

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
    <div className="relative w-full h-[600px] bg-[#0a0e1a] rounded-lg border-2 border-slate-800 shadow-xl overflow-hidden flex">
      
      {/* Controls Panel (Top Left) */}
      <div className="absolute top-4 left-4 z-10 bg-slate-900/80 p-4 rounded-lg border border-slate-700 backdrop-blur shadow-lg text-xs w-64">
        <h3 className="text-slate-300 font-bold mb-3 tracking-widest">GRAPH CONTROLS</h3>
        
        <div className="mb-4">
          <label className="text-slate-400 mb-1 block">Time Window (Day {timeWindow})</label>
          <input type="range" min="1" max="22" value={timeWindow} 
                 onChange={e => setTimeWindow(parseInt(e.target.value))}
                 className="w-full accent-cyan-500" />
          <div className="flex justify-between text-[9px] text-slate-500 mt-1">
            <span>Day 1 (Initial Access)</span>
            <span>Day 22 (Impact)</span>
          </div>
        </div>

        <div className="mb-4 space-y-1">
          <label className="flex items-center text-slate-300 cursor-pointer">
            <input type="checkbox" checked={onlyCompromised} onChange={e => setOnlyCompromised(e.target.checked)} className="mr-2" />
            Show only compromised
          </label>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 text-[10px]">
          {Object.keys(NODE_COLORS).map(type => (
            <label key={type} className="flex items-center text-slate-400 cursor-pointer">
              <input type="checkbox" checked={nodeTypes[type]} 
                     onChange={e => setNodeTypes(p => ({...p, [type]: e.target.checked}))} 
                     className="mr-2" />
              <span style={{ color: NODE_COLORS[type] }}>●</span> {type}
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <button onClick={resetCamera} className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded transition-colors border border-slate-600">
            RESET CAMERA
          </button>
          <button onClick={focusAttackPath} className="bg-red-900/30 hover:bg-red-900/50 text-red-400 py-1.5 rounded transition-colors border border-red-900">
            FOCUS ON ATTACK PATH
          </button>
        </div>
      </div>

      {/* Detail Panel (Right) */}
      {(selectedNode || selectedEdge) && (
        <div className="absolute top-4 right-4 z-10 bg-slate-900/90 p-5 rounded-lg border-2 border-slate-700 backdrop-blur shadow-2xl text-sm w-80 animate-in fade-in slide-in-from-right-4">
          <button onClick={() => { setSelectedNode(null); setSelectedEdge(null); }} className="absolute top-2 right-3 text-slate-500 hover:text-white">✕</button>
          
          {selectedNode && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS[selectedNode.type] || '#ccc' }} />
                <span className="text-[10px] tracking-widest text-slate-400">{selectedNode.type}</span>
              </div>
              <h2 className="text-white font-bold text-lg mb-3 break-all">{selectedNode.name || selectedNode.id}</h2>
              
              {selectedNode.is_compromised && (
                <div className="bg-red-900/40 text-red-400 border border-red-500/50 px-2 py-1 rounded text-xs font-bold mb-4 inline-block">
                  COMPROMISED NODE
                </div>
              )}
              
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Criticality</div>
                  <div className="text-slate-300">{selectedNode.criticality || 'NORMAL'}</div>
                </div>
                {selectedNode.is_compromised && (
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Observed Techniques</div>
                    <ul className="text-slate-300 text-xs list-disc pl-4 mt-1">
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
              <div className="text-[10px] tracking-widest text-slate-400 mb-1">RELATIONSHIP</div>
              <h2 className="text-cyan-400 font-bold mb-3">{selectedEdge.type || 'CONNECTED_TO'}</h2>
              
              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Source</div>
                  <div className="text-slate-300">{selectedEdge.source?.id || selectedEdge.source}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Target</div>
                  <div className="text-slate-300">{selectedEdge.target?.id || selectedEdge.target}</div>
                </div>
                {selectedEdge.anomalous && (
                  <div className="mt-4 bg-amber-900/30 border border-amber-500/50 p-2 rounded">
                    <span className="text-amber-400 font-bold block mb-1">Anomalous Activity Detected</span>
                    <span className="text-slate-300 text-[10px]">Score: 0.89 | Volume spike + Off-hours</span>
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
          nodeResolution={16}
          nodeOpacity={0.9}
          linkWidth={edge => edge.anomalous ? 2 : 0.5}
          linkColor={edge => edge.anomalous ? EDGE_COLORS.LATERAL_MOVEMENT : EDGE_COLORS.COMMUNICATED_WITH}
          linkDirectionalParticles={edge => edge.anomalous ? 4 : 0}
          linkDirectionalParticleSpeed={0.01}
          linkDirectionalParticleWidth={2}
          onNodeClick={handleNodeClick}
          onLinkClick={handleEdgeClick}
          backgroundColor="#0a0e1a"
          showNavInfo={false}
          nodeThreeObjectExtend={true}
          nodeThreeObject={node => {
            if (node.is_compromised) {
              // Add a red halo for compromised nodes
              import('three').then(THREE => {
                const material = new THREE.MeshBasicMaterial({ 
                  color: '#ef4444', 
                  transparent: true, 
                  opacity: 0.3 
                });
                const size = Math.max(4, Math.min(20, node.val || 4));
                const geometry = new THREE.SphereGeometry(size * 1.5, 16, 16);
                const halo = new THREE.Mesh(geometry, material);
                node.__threeObj.add(halo);
              });
            }
          }}
        />
      </div>
    </div>
  );
}
