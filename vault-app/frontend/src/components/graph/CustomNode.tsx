import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface CustomNodeData {
  id: string;
  label: string;
  title: string;
  note_type: string;
  tags: string[];
  is_orphan: boolean;
  in_degree: number;
  out_degree: number;
  isSelected?: boolean;
}

export const CustomNode = memo(({ data }: { data: CustomNodeData }) => {
  return (
    <div
      className={`px-3.5 py-2.5 rounded-xl border transition-all select-none shadow-md ${
        data.isSelected
          ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-500 ring-2 ring-indigo-500/50 scale-105'
          : 'bg-white dark:bg-vault-900 border-vault-200 dark:border-vault-700 hover:border-indigo-400'
      } min-w-[150px] max-w-[220px]`}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-indigo-500 border-none" />
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-indigo-500 border-none" />
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-indigo-500 border-none" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-indigo-500 border-none" />

      {/* Header: Note Type & Degree */}
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
          {data.note_type}
        </span>
        <div className="flex items-center gap-1 text-[10px] text-vault-400">
          <span className="flex items-center" title="Incoming Links">
            <ArrowDownLeft size={10} />
            {data.in_degree}
          </span>
          <span className="flex items-center" title="Outgoing Links">
            <ArrowUpRight size={10} />
            {data.out_degree}
          </span>
        </div>
      </div>

      {/* Title */}
      <div className="font-semibold text-xs text-vault-900 dark:text-vault-100 truncate mb-1">
        {data.title || data.label}
      </div>

      {/* Tags */}
      {data.tags && data.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {data.tags.slice(0, 2).map(t => (
            <span
              key={t}
              className="text-[9px] bg-vault-100 dark:bg-vault-800 text-vault-500 dark:text-vault-400 px-1 py-0.2 rounded"
            >
              #{t}
            </span>
          ))}
          {data.tags.length > 2 && (
            <span className="text-[9px] text-vault-400 font-medium">
              +{data.tags.length - 2}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
