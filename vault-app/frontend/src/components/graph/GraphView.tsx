import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api } from '../../api/client';
import { useVault } from '../../state/VaultContext';
import { CustomNode } from './CustomNode';
import { Button } from '../ui/Button';
import { RefreshCw, Save } from 'lucide-react';

const nodeTypes = {
  customNode: CustomNode,
};

export const GraphView: React.FC = () => {
  const { selectedNodeId, selectNode, notesSummary } = useVault();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [depth, setDepth] = useState(2);
  const [tagFilter, setTagFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Collect unique tags and types for filters
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
      });

      // Calculate simple circular / grid layout if x, y are null
      const flowNodes: Node[] = data.nodes.map((n, idx) => {
        let x = n.x;
        let y = n.y;

        if (x === undefined || y === undefined || x === null || y === null) {
          const angle = (idx / (data.nodes.length || 1)) * 2 * Math.PI;
          const radius = 250 + (idx % 3) * 60;
          x = 400 + radius * Math.cos(angle);
          y = 300 + radius * Math.sin(angle);
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
  }, [isLocalMode, selectedNodeId, depth, tagFilter, typeFilter]);

  useEffect(() => {
    loadGraphData();
  }, [loadGraphData]);

  // Synchronize selection highlight in graph
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

  const handleSavePositions = async () => {
    const positions: Record<string, { x: number; y: number }> = {};
    nodes.forEach(n => {
      positions[n.id] = { x: n.position.x, y: n.position.y };
    });
    await api.saveGraphLayout(positions);
    alert('Graph layout saved successfully!');
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
    } catch (e: any) {
      alert(`Could not create edge: ${e.message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-vault-50/30 dark:bg-vault-950/60 relative overflow-hidden">
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 p-2 bg-white/90 dark:bg-vault-900/90 backdrop-blur-md border border-vault-200 dark:border-vault-800 rounded-xl shadow-lg text-xs">
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
              className="w-16 accent-brand-500 cursor-pointer"
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
          <option value="">All Tags</option>
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

        {/* Save Layout Action */}
        <Button size="sm" variant="secondary" icon={<Save size={13} />} onClick={handleSavePositions}>
          Save Layout
        </Button>

        {/* Refresh */}
        <button
          onClick={loadGraphData}
          title="Reload Graph"
          className="p-1.5 text-vault-500 hover:text-vault-800 dark:text-vault-400 hover:bg-vault-100 dark:hover:bg-vault-800 rounded-lg"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#94a3b8" />
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
