import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  FileText,
  Network,
  Paperclip,
  Search,
  Trash2,
} from 'lucide-react';
import { useVault } from '../../state/VaultContext';
import { Badge } from '../ui/Badge';

type SortField =
  | 'title'
  | 'note_type'
  | 'created_at'
  | 'modified_at'
  | 'descendant_count'
  | 'incoming_link_count'
  | 'outgoing_link_count'
  | 'attachment_count';

export const TableView: React.FC = () => {
  const { notesSummary, selectedNodeId, selectNode, setActiveView, deleteCurrentNote } = useVault();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('modified_at');
  const [sortAsc, setSortAsc] = useState(false);

  const filteredAndSortedNotes = useMemo(() => {
    return notesSummary
      .filter(n => {
        const matchesSearch =
          !searchTerm ||
          n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          n.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesType = !typeFilter || n.note_type === typeFilter;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === 'string') {
          return sortAsc
            ? (valA as string).localeCompare(valB as string)
            : (valB as string).localeCompare(valA as string);
        }

        return sortAsc
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number);
      });
  }, [notesSummary, searchTerm, typeFilter, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="opacity-40" />;
    return sortAsc ? <ArrowUp size={12} className="text-indigo-500" /> : <ArrowDown size={12} className="text-indigo-500" />;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-vault-900 overflow-hidden">
      {/* Table Controls */}
      <div className="p-4 border-b border-vault-200 dark:border-vault-800 bg-vault-50 dark:bg-vault-950/60 flex flex-wrap items-center justify-between gap-3 shrink-0 select-none">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-vault-400" />
            <input
              type="text"
              placeholder="Search table notes or tags..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg text-vault-900 dark:text-vault-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg text-vault-700 dark:text-vault-300 focus:outline-none"
          >
            <option value="">All Note Types</option>
            <option value="concept">Concept</option>
            <option value="project">Project</option>
            <option value="reference">Reference</option>
            <option value="daily">Daily</option>
            <option value="journal">Journal</option>
            <option value="standard">Standard</option>
          </select>
        </div>

        <div className="text-xs text-vault-500 dark:text-vault-400 font-medium">
          Showing {filteredAndSortedNotes.length} of {notesSummary.length} notes
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-vault-100/80 dark:bg-vault-800/80 sticky top-0 z-10 border-b border-vault-200 dark:border-vault-700 select-none">
            <tr>
              <th
                onClick={() => handleSort('title')}
                className="py-2.5 px-4 font-semibold text-vault-700 dark:text-vault-300 cursor-pointer hover:bg-vault-200/60 dark:hover:bg-vault-700"
              >
                <div className="flex items-center gap-1.5">
                  <span>Title</span>
                  {renderSortIcon('title')}
                </div>
              </th>
              <th
                onClick={() => handleSort('note_type')}
                className="py-2.5 px-3 font-semibold text-vault-700 dark:text-vault-300 cursor-pointer hover:bg-vault-200/60 dark:hover:bg-vault-700"
              >
                <div className="flex items-center gap-1.5">
                  <span>Type</span>
                  {renderSortIcon('note_type')}
                </div>
              </th>
              <th className="py-2.5 px-3 font-semibold text-vault-700 dark:text-vault-300">
                Tags
              </th>
              <th
                onClick={() => handleSort('modified_at')}
                className="py-2.5 px-3 font-semibold text-vault-700 dark:text-vault-300 cursor-pointer hover:bg-vault-200/60 dark:hover:bg-vault-700"
              >
                <div className="flex items-center gap-1.5">
                  <span>Modified</span>
                  {renderSortIcon('modified_at')}
                </div>
              </th>
              <th
                onClick={() => handleSort('incoming_link_count')}
                className="py-2.5 px-3 font-semibold text-vault-700 dark:text-vault-300 cursor-pointer hover:bg-vault-200/60 dark:hover:bg-vault-700 text-center"
              >
                <div className="flex items-center justify-center gap-1" title="Incoming Backlinks">
                  <ArrowDownLeft size={12} className="text-emerald-500" />
                  <span>In</span>
                  {renderSortIcon('incoming_link_count')}
                </div>
              </th>
              <th
                onClick={() => handleSort('outgoing_link_count')}
                className="py-2.5 px-3 font-semibold text-vault-700 dark:text-vault-300 cursor-pointer hover:bg-vault-200/60 dark:hover:bg-vault-700 text-center"
              >
                <div className="flex items-center justify-center gap-1" title="Outgoing Links">
                  <ArrowUpRight size={12} className="text-indigo-500" />
                  <span>Out</span>
                  {renderSortIcon('outgoing_link_count')}
                </div>
              </th>
              <th
                onClick={() => handleSort('attachment_count')}
                className="py-2.5 px-3 font-semibold text-vault-700 dark:text-vault-300 cursor-pointer hover:bg-vault-200/60 dark:hover:bg-vault-700 text-center"
              >
                <div className="flex items-center justify-center gap-1" title="Attachments">
                  <Paperclip size={12} />
                  <span>Files</span>
                  {renderSortIcon('attachment_count')}
                </div>
              </th>
              <th className="py-2.5 px-4 font-semibold text-vault-700 dark:text-vault-300 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-vault-200 dark:divide-vault-800/60">
            {filteredAndSortedNotes.map(n => {
              const isSelected = n.id === selectedNodeId;
              return (
                <tr
                  key={n.id}
                  onClick={() => selectNode(n.id)}
                  className={`group cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-indigo-50/80 dark:bg-indigo-950/50'
                      : 'hover:bg-vault-50 dark:hover:bg-vault-800/40'
                  }`}
                >
                  <td className="py-2.5 px-4 font-medium text-vault-900 dark:text-vault-100 flex items-center gap-2">
                    <FileText size={14} className={isSelected ? 'text-indigo-500' : 'text-vault-400'} />
                    <span className="truncate max-w-xs">{n.title}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge variant="primary" size="sm">
                      {n.note_type}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex flex-wrap gap-1">
                      {n.tags.map(t => (
                        <span
                          key={t}
                          className="text-[10px] bg-vault-100 dark:bg-vault-800 px-1.5 py-0.5 rounded text-vault-600 dark:text-vault-400"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-vault-500 dark:text-vault-400">
                    {new Date(n.modified_at).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-vault-700 dark:text-vault-300">
                    {n.incoming_link_count}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-vault-700 dark:text-vault-300">
                    {n.outgoing_link_count}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-vault-700 dark:text-vault-300">
                    {n.attachment_count}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        title="View in Graph"
                        onClick={e => {
                          e.stopPropagation();
                          selectNode(n.id);
                          setActiveView('graph');
                        }}
                        className="p-1 hover:bg-vault-200 dark:hover:bg-vault-700 rounded text-vault-500"
                      >
                        <Network size={14} />
                      </button>
                      <button
                        title="Delete Note"
                        onClick={e => {
                          e.stopPropagation();
                          if (confirm(`Delete "${n.title}"?`)) {
                            deleteCurrentNote(n.id);
                          }
                        }}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-950/60 rounded text-vault-400 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
