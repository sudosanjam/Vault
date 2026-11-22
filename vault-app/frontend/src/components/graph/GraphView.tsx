import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api } from '../../api/client';
import { useVault } from '../../state/VaultContext';
import { CustomNode } from './CustomNode';
import { Button } from '../ui/Button';
import {
  Bookmark,
  Compass,
  FolderTree,
  Grid,
  Maximize2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react';

const nodeTypes = {
  customNode: CustomNode,
};

const GraphViewInner: React.FC = () => {
  const { selectedNodeId, selectNode, notesSummary } = useVault();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const reactFlowInstance = useReactFlow();

  const [isLocalMode, setIsLocalMode] = useState(false);
  const [depth, setDepth] = useState(2);
  const [tagFilter, setTagFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Layout Management State
  const [currentLayout, setCurrentLayout] = useState<string>('default');
  const [availableLayouts, setAvailableLayouts] = useState<string[]>(['default']);
  const [savingLayout, setSavingLayout] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Fetch available layouts from backend
  const refreshLayoutsList = useCallback(async () => {
    try {
      const data = await api.getGraphLayouts();
      const names = Object.keys(data.layouts || {});
      if (!names.includes('default')) names.unshift('default');
      setAvailableLayouts(names);
      if (data.active_layout && names.includes(data.active_layout)) {
        setCurrentLayout(data.active_layout);
      }
    } catch {
      // Fallback
      setAvailableLayouts(['default']);
    }
  }, []);

  useEffect(() => {
    refreshLayoutsList();
  }, [refreshLayoutsList]);

  // Unique tags and types for filters
  const allTags = useMemo(() => {
    const s = new Set<string>();
    notesSummary.forEach(n => n.tags.forEach(t => s.add(t)));
    return Array.from(s);
  }, [notesSummary]);

  const allTypes = useMemo(() => {
    const s = new Set<string>();
    notesSummary.forEach(n => s.add(n.note_type));
    return Array.from(s);
  }, [notesSummary]);

  const loadGraphData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getGraph({
        root_id: isLocalMode && selectedNodeId ? selectedNodeId : undefined,
        depth: depth,
        tag: tagFilter || undefined,
        note_type: typeFilter || undefined,
        include_broken: true,
        layout: currentLayout,
      });

      // Position nodes: use stored x/y or compute smooth procedural arrangement
      const flowNodes: Node[] = data.nodes.map((n, idx) => {
        let x = n.x;
        let y = n.y;

        if (x === undefined || y === undefined || x === null || y === null) {
          // Distributed spiral / radial arrangement that expands infinitely for any amount of notes
          const goldenAngle = Math.PI * (3 - Math.sqrt(5));
          const distance = Math.sqrt(idx + 1) * 110;
          x = 500 + distance * Math.cos(idx * goldenAngle);
          y = 400 + distance * Math.sin(idx * goldenAngle);
        }

        return {
          id: n.id,
          type: 'customNode',
          position: { x, y },
          data: {
            ...n,
            isSelected: n.id === selectedNodeId,
          },
        };
      });

      const flowEdges: Edge[] = data.edges.map(e => {
        let strokeColor = '#94a3b8';
        let strokeDasharray = undefined;

        if (e.relation_type === 'parent_child') {
          strokeColor = '#3b82f6';
        } else if (e.relation_type === 'depends_on') {
          strokeColor = '#f59e0b';
          strokeDasharray = '5 5';
        } else if (e.relation_type === 'implements') {
          strokeColor = '#8b5cf6';
        } else if (e.is_broken) {
          strokeColor = '#ef4444';
          strokeDasharray = '3 3';
        }

        return {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label || (e.relation_type !== 'inline_link' ? e.relation_type : undefined),
          animated: e.relation_type === 'parent_child',
          style: { stroke: strokeColor, strokeWidth: 1.5, strokeDasharray },
          labelStyle: { fontSize: 10, fill: '#64748b' },
        };
      });

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (e) {
      console.error('Error loading graph:', e);
    } finally {
      setLoading(false);
    }
  }, [isLocalMode, selectedNodeId, depth, tagFilter, typeFilter, currentLayout]);

  useEffect(() => {
    loadGraphData();
  }, [loadGraphData]);

  // Sync selection highlight
  useEffect(() => {
    setNodes(nds =>
      nds.map(node => ({
        ...node,
        data: {
          ...node.data,
          isSelected: node.id === selectedNodeId,
        },
      }))
    );
  }, [selectedNodeId]);

  const onNodeClick = (_: any, node: Node) => {
    selectNode(node.id);
  };

  // Save current node positions to the active layout
  const handleSavePositions = async () => {
    setSavingLayout(true);
    try {
      const positions: Record<string, { x: number; y: number }> = {};
      nodes.forEach(n => {
        positions[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
      });
      await api.saveGraphLayout(positions, currentLayout, true);
      showToast(`Saved layout "${currentLayout}" (${nodes.length} nodes)`);
      refreshLayoutsList();
    } catch (err: any) {
      alert(`Failed to save layout: ${err.message}`);
    } finally {
      setSavingLayout(false);
    }
  };

  // Save current positions under a new named layout
  const handleCreateNewLayout = async () => {
    const layoutName = prompt('Enter a name for this custom graph layout:');
    if (!layoutName || !layoutName.trim()) return;
    const cleanName = layoutName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    setSavingLayout(true);
    try {
      const positions: Record<string, { x: number; y: number }> = {};
      nodes.forEach(n => {
        positions[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
      });
      await api.saveGraphLayout(positions, cleanName, true);
      setCurrentLayout(cleanName);
      await refreshLayoutsList();
      showToast(`Created and saved new layout: "${cleanName}"`);
    } catch (err: any) {
      alert(`Failed to create layout: ${err.message}`);
    } finally {
      setSavingLayout(false);
    }
  };

  // Auto-arrange layout: Grid Board
  const applyGridLayout = () => {
    const cols = Math.max(3, Math.ceil(Math.sqrt(nodes.length * 1.5)));
    const colWidth = 260;
    const rowHeight = 150;

    setNodes(prev =>
      prev.map((node, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        return {
          ...node,
          position: {
            x: col * colWidth,
            y: row * rowHeight,
          },
        };
      })
    );
    showToast('Applied Grid Board arrangement');
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.15 }), 50);
  };

  // Auto-arrange layout: Radial / Concentric Clusters
  const applyRadialLayout = () => {
    const total = nodes.length;
    if (total === 0) return;

    // Place connected nodes closer to center
    setNodes(prev => {
      const sorted = [...prev].sort((a, b) => {
        const bDeg = Number((b.data as any)?.in_degree || 0) + Number((b.data as any)?.out_degree || 0);
        const aDeg = Number((a.data as any)?.in_degree || 0) + Number((a.data as any)?.out_degree || 0);
        return bDeg - aDeg;
      });
      const posMap = new Map<string, { x: number; y: number }>();
      const centerX = 600;
      const centerY = 500;

      sorted.forEach((node, i) => {
        if (i === 0) {
          posMap.set(node.id, { x: centerX, y: centerY });
        } else {
          const ring = Math.floor(Math.sqrt(i));
          const itemsInRing = Math.max(6, ring * 6);
          const angle = ((i % itemsInRing) / itemsInRing) * 2 * Math.PI;
          const radius = 180 + ring * 160;
          posMap.set(node.id, {
            x: Math.round(centerX + radius * Math.cos(angle)),
            y: Math.round(centerY + radius * Math.sin(angle)),
          });
        }
      });

      return prev.map(n => ({
        ...n,
        position: posMap.get(n.id) || n.position,
      }));
    });
    showToast('Applied Radial Cluster arrangement');
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.15 }), 50);
  };

  // Auto-arrange layout: Hierarchical Tree
  const applyHierarchyLayout = () => {
    const rootNodes = nodes.filter(n => !n.data?.parent_id);
    const childNodes = nodes.filter(n => n.data?.parent_id);

    const levelMap = new Map<string, number>();
    rootNodes.forEach(n => levelMap.set(n.id, 0));

    let changed = true;
    let iteration = 0;
    while (changed && iteration < 10) {
      changed = false;
      iteration++;
      childNodes.forEach(n => {
        const pId = (n.data as any)?.parent_id as string | undefined;
        if (pId && levelMap.has(pId)) {
          const expected = (levelMap.get(pId) || 0) + 1;
          if (levelMap.get(n.id) !== expected) {
            levelMap.set(n.id, expected);
            changed = true;
          }
        }
      });
    }

    // Default remaining to level 1
    nodes.forEach(n => {
      if (!levelMap.has(n.id)) levelMap.set(n.id, 1);
    });

    const levelBuckets: Record<number, Node[]> = {};
    nodes.forEach(n => {
      const lvl = levelMap.get(n.id) || 0;
      if (!levelBuckets[lvl]) levelBuckets[lvl] = [];
      levelBuckets[lvl].push(n);
    });

    const newPos = new Map<string, { x: number; y: number }>();
    Object.keys(levelBuckets).forEach(lvlStr => {
      const lvl = parseInt(lvlStr);
      const items = levelBuckets[lvl];
      const spacingX = 260;
      const startX = -((items.length - 1) * spacingX) / 2 + 500;
      items.forEach((item, idx) => {
        newPos.set(item.id, {
          x: Math.round(startX + idx * spacingX),
          y: Math.round(lvl * 200 + 100),
        });
      });
    });

    setNodes(prev =>
      prev.map(n => ({
        ...n,
        position: newPos.get(n.id) || n.position,
      }))
    );
    showToast('Applied Hierarchical Tree arrangement');
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.15 }), 50);
  };

  const onConnect = async (params: any) => {
    const relType = prompt(
      'Enter relationship type (references, depends_on, relates_to, implements, extends):',
      'references'
    );
    if (!relType) return;
    try {
      await api.createRelationship(params.source, params.target, relType);
      loadGraphData();
      showToast('Created new relationship edge');
    } catch (e: any) {
      alert(`Could not create edge: ${e.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-vault-50/30 dark:bg-vault-950/80 relative overflow-hidden">
      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 p-2 bg-white/95 dark:bg-vault-900/95 backdrop-blur-md border border-vault-200 dark:border-vault-800 rounded-xl shadow-xl text-xs max-w-[calc(100vw-300px)]">
        {/* Local vs Global mode */}
        <div className="flex bg-vault-100 dark:bg-vault-800 rounded-lg p-0.5">
          <button
            onClick={() => setIsLocalMode(false)}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              !isLocalMode
                ? 'bg-white dark:bg-vault-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-vault-500 hover:text-vault-800 dark:text-vault-400'
            }`}
          >
            Global Graph
          </button>
          <button
            onClick={() => setIsLocalMode(true)}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              isLocalMode
                ? 'bg-white dark:bg-vault-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-vault-500 hover:text-vault-800 dark:text-vault-400'
            }`}
          >
            Local Subgraph
          </button>
        </div>

        {/* Depth slider if local mode */}
        {isLocalMode && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-vault-100 dark:bg-vault-800 rounded-lg text-vault-600 dark:text-vault-300">
            <span>Depth:</span>
            <input
              type="range"
              min="1"
              max="4"
              value={depth}
              onChange={e => setDepth(parseInt(e.target.value))}
              className="w-14 accent-brand-500 cursor-pointer"
            />
            <span className="font-bold">{depth}</span>
          </div>
        )}

        {/* Tag Filter */}
        <select
          value={tagFilter}
          onChange={e => setTagFilter(e.target.value)}
          className="px-2 py-1 bg-vault-100 dark:bg-vault-800 border border-vault-200 dark:border-vault-700 rounded-lg text-vault-700 dark:text-vault-300 focus:outline-none"
        >
          <option value="">All Tags ({allTags.length})</option>
          {allTags.map(t => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>

        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-2 py-1 bg-vault-100 dark:bg-vault-800 border border-vault-200 dark:border-vault-700 rounded-lg text-vault-700 dark:text-vault-300 focus:outline-none"
        >
          <option value="">All Types</option>
          {allTypes.map(t => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <div className="h-4 w-px bg-vault-200 dark:border-vault-700 mx-0.5" />

        {/* Named Layout Selector */}
        <div className="flex items-center gap-1">
          <Bookmark size={13} className="text-amber-500" />
          <select
            value={currentLayout}
            onChange={e => setCurrentLayout(e.target.value)}
            className="px-2 py-1 bg-vault-100 dark:bg-vault-800 border border-vault-200 dark:border-vault-700 rounded-lg font-mono text-[11px] text-vault-800 dark:text-vault-200 focus:outline-none"
            title="Saved Graph Layouts"
          >
            {availableLayouts.map(l => (
              <option key={l} value={l}>
                Layout: {l}
              </option>
            ))}
          </select>
        </div>

        {/* Save Current Layout */}
        <Button
          size="sm"
          variant="secondary"
          icon={<Save size={13} />}
          onClick={handleSavePositions}
          isLoading={savingLayout}
          title="Save node coordinates to active layout"
        >
          Save
        </Button>

        {/* Save As New Layout */}
        <button
          onClick={handleCreateNewLayout}
          className="p-1.5 text-vault-500 hover:text-vault-800 dark:text-vault-400 dark:hover:text-vault-100 hover:bg-vault-100 dark:hover:bg-vault-800 rounded-lg transition-colors"
          title="Save as new custom layout"
        >
          <Plus size={14} />
        </button>

        <div className="h-4 w-px bg-vault-200 dark:border-vault-700 mx-0.5" />

        {/* Procedural Layout Tools */}
        <div className="flex items-center gap-1 bg-vault-100 dark:bg-vault-800/80 p-0.5 rounded-lg">
          <button
            onClick={applyRadialLayout}
            className="p-1 rounded text-vault-600 dark:text-vault-300 hover:bg-white dark:hover:bg-vault-700 transition-colors"
            title="Auto-Arrange: Radial Clusters"
          >
            <Compass size={14} />
          </button>
          <button
            onClick={applyHierarchyLayout}
            className="p-1 rounded text-vault-600 dark:text-vault-300 hover:bg-white dark:hover:bg-vault-700 transition-colors"
            title="Auto-Arrange: Hierarchical Tree"
          >
            <FolderTree size={14} />
          </button>
          <button
            onClick={applyGridLayout}
            className="p-1 rounded text-vault-600 dark:text-vault-300 hover:bg-white dark:hover:bg-vault-700 transition-colors"
            title="Auto-Arrange: Grid Board"
          >
            <Grid size={14} />
          </button>
          <button
            onClick={() => reactFlowInstance.fitView({ padding: 0.2 })}
            className="p-1 rounded text-vault-600 dark:text-vault-300 hover:bg-white dark:hover:bg-vault-700 transition-colors"
            title="Fit All Nodes in View"
          >
            <Maximize2 size={14} />
          </button>
        </div>

        {/* Reload */}
        <button
          onClick={loadGraphData}
          title="Reload Graph"
          className="p-1.5 text-vault-500 hover:text-vault-800 dark:text-vault-400 hover:bg-vault-100 dark:hover:bg-vault-800 rounded-lg"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 bg-vault-900/90 text-vault-100 border border-vault-700 rounded-full text-xs shadow-xl backdrop-blur-md animate-fade-in flex items-center gap-1.5">
          <Sparkles size={12} className="text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Canvas Stats / Info Overlay */}
      <div className="absolute bottom-3 right-3 z-10 px-2.5 py-1 bg-white/80 dark:bg-vault-900/80 backdrop-blur-md border border-vault-200 dark:border-vault-800 rounded-lg text-[10px] font-mono text-vault-500 select-none pointer-events-none">
        Infinite Canvas · {nodes.length} notes · {edges.length} edges · Layout: {currentLayout}
      </div>

      {/* Infinitely Expanding React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.01}
        maxZoom={6}
        translateExtent={[
          [-Infinity, -Infinity],
          [Infinity, Infinity],
        ]}
        nodeExtent={[
          [-Infinity, -Infinity],
          [Infinity, Infinity],
        ]}
        panOnScroll={true}
        zoomOnScroll={true}
        panOnDrag={true}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#94a3b8" />
        <Controls className="bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-800 rounded-xl shadow-lg fill-vault-600 dark:fill-vault-300" />
        <MiniMap
          nodeStrokeColor="#3b82f6"
          nodeColor="#1e293b"
          nodeBorderRadius={8}
          className="bg-white/80 dark:bg-vault-900/80 border border-vault-200 dark:border-vault-800 rounded-xl shadow-lg"
        />
      </ReactFlow>
    </div>
  );
};

export const GraphView: React.FC = () => {
  return (
    <ReactFlowProvider>
      <GraphViewInner />
    </ReactFlowProvider>
  );
};
