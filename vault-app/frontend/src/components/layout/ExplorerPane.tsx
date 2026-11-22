import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  FilePlus,
  FolderOpen,
  Hash,
  Image as ImageIcon,
  Search,
  Trash2,
  Upload,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { useVault } from '../../state/VaultContext';
import { api } from '../../api/client';
import type { TreeNode } from '../../types';

export const ExplorerPane: React.FC = () => {
  const {
    treeNodes,
    notesSummary,
    selectedNodeId,
    selectNode,
    deleteCurrentNote,
    setCreateNoteModalOpen,
    setImportModalOpen,
    isLeftPaneOpen,
  } = useVault();

  const [activeTab, setActiveTab] = useState<'tree' | 'tags' | 'recent' | 'media'>('tree');
  const [filterText, setFilterText] = useState('');
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Media attachments tab state
  const [mediaList, setMediaList] = useState<{
    name: string;
    relative_path: string;
    url: string;
    size_bytes: number;
    modified_at: number;
  }[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'media') {
      loadMedia();
    }
  }, [activeTab]);

  const loadMedia = async () => {
    try {
      setLoadingMedia(true);
      const res = await api.listAttachments();
      setMediaList(res);
    } catch (e) {
      console.error('Failed to load media attachments:', e);
    } finally {
      setLoadingMedia(false);
    }
  };

  const handleOpenMediaFolder = async () => {
    try {
      await api.openAttachmentsFolder();
    } catch (e: any) {
      alert('Could not open folder: ' + (e.message || 'Unknown error'));
    }
  };

  const handleCopyLink = (relPath: string) => {
    const md = `![Image](${relPath})`;
    navigator.clipboard.writeText(md);
    setCopiedPath(relPath);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  if (!isLeftPaneOpen) return null;

  const toggleCollapse = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // Collect all unique tags and counts
  const tagCounts: Record<string, number> = {};
  notesSummary.forEach(n => {
    n.tags.forEach(t => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  });

  // Recent notes
  const recentNotes = [...notesSummary].sort(
    (a, b) => new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime()
  );

  const renderTreeItem = (node: TreeNode, depth: number = 0) => {
    const isSelected = node.id === selectedNodeId;
    const isCollapsed = !!collapsedNodes[node.id];
    const hasChildren = node.children && node.children.length > 0;

    // Filter check
    if (
      filterText &&
      !node.title.toLowerCase().includes(filterText.toLowerCase()) &&
      !node.children?.some(c => c.title.toLowerCase().includes(filterText.toLowerCase()))
    ) {
      return null;
    }

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => selectNode(node.id)}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          className={`group flex items-center justify-between py-1.5 pr-2.5 rounded-xl cursor-pointer text-xs font-medium transition-all ${
            isSelected
              ? 'bg-[var(--accent-muted)] text-[var(--accent-primary)] font-semibold shadow-xs'
              : 'text-vault-700 dark:text-vault-300 hover:bg-vault-100 dark:hover:bg-vault-800/60'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {hasChildren ? (
              <button
                onClick={e => toggleCollapse(node.id, e)}
                className="p-0.5 text-vault-400 hover:text-vault-700 dark:hover:text-vault-200 rounded"
              >
                {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
              </button>
            ) : (
              <span className="w-4 inline-block" />
            )}

            <span className="truncate">{node.title}</span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {node.descendant_count > 0 && (
              <span className="text-[10px] text-vault-400 font-normal px-1.5 py-0.5 bg-vault-200/50 dark:bg-vault-800 rounded-full">
                {node.descendant_count}
              </span>
            )}
            <button
              title="Delete note"
              onClick={e => {
                e.stopPropagation();
                if (confirm(`Delete note "${node.title}"?`)) {
                  deleteCurrentNote(node.id);
                }
              }}
              className="p-1 hover:text-red-500 rounded transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {hasChildren && !isCollapsed && (
          <div className="border-l border-vault-200 dark:border-vault-800/80 ml-4">
            {node.children.map(child => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-full bg-vault-50/40 dark:bg-vault-900/40 backdrop-blur-md border-r border-vault-200 dark:border-vault-800 flex flex-col shrink-0 select-none h-full">
      {/* Explorer Header Segmented Tabs */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-vault-200 dark:border-vault-800">
        <div className="flex items-center gap-0.5 p-0.5 bg-vault-200/50 dark:bg-vault-800/60 rounded-xl text-xs">
          <button
            onClick={() => {
              setActiveTab('tree');
              setSelectedTag(null);
            }}
            className={`px-2 py-1 rounded-lg font-semibold transition-all ${
              activeTab === 'tree'
                ? 'bg-white dark:bg-vault-900 text-vault-900 dark:text-vault-100 shadow-xs'
                : 'text-vault-500 hover:text-vault-800 dark:text-vault-400 dark:hover:text-vault-200'
            }`}
          >
            Tree
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`px-2 py-1 rounded-lg font-semibold transition-all ${
              activeTab === 'tags'
                ? 'bg-white dark:bg-vault-900 text-vault-900 dark:text-vault-100 shadow-xs'
                : 'text-vault-500 hover:text-vault-800 dark:text-vault-400 dark:hover:text-vault-200'
            }`}
          >
            Tags
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className={`px-2 py-1 rounded-lg font-semibold transition-all ${
              activeTab === 'recent'
                ? 'bg-white dark:bg-vault-900 text-vault-900 dark:text-vault-100 shadow-xs'
                : 'text-vault-500 hover:text-vault-800 dark:text-vault-400 dark:hover:text-vault-200'
            }`}
          >
            Recent
          </button>
          <button
            onClick={() => setActiveTab('media')}
            className={`px-2 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
              activeTab === 'media'
                ? 'bg-white dark:bg-vault-900 text-[var(--accent-primary)] shadow-xs'
                : 'text-vault-500 hover:text-vault-800 dark:text-vault-400 dark:hover:text-vault-200'
            }`}
          >
            <ImageIcon size={11} />
            <span>Media</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setImportModalOpen(true)}
            title="Import Markdown or ZIP"
            className="text-vault-400 hover:text-vault-700 dark:hover:text-vault-200 p-1.5 rounded-lg hover:bg-vault-200/50 dark:hover:bg-vault-800 transition-colors"
          >
            <Upload size={14} />
          </button>
          <button
            onClick={() => setCreateNoteModalOpen(true)}
            title="Create New Note"
            className="text-vault-400 hover:text-vault-700 dark:hover:text-vault-200 p-1.5 rounded-lg hover:bg-vault-200/50 dark:hover:bg-vault-800 transition-colors"
          >
            <FilePlus size={14} />
          </button>
        </div>
      </div>

      {/* Filter search bar inside Explorer */}
      {activeTab !== 'media' && (
        <div className="p-2 border-b border-vault-200 dark:border-vault-800">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-vault-400" />
            <input
              type="text"
              placeholder="Filter notes..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 text-xs bg-white dark:bg-vault-900/80 border border-vault-200 dark:border-vault-800 rounded-xl text-vault-800 dark:text-vault-200 placeholder-vault-400 focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
          </div>
        </div>
      )}

      {/* Pane Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeTab === 'tree' && (
          <div>
            {treeNodes.length === 0 ? (
              <div className="text-center py-8 px-4 text-xs text-vault-400">
                <p>No notes in vault.</p>
                <button
                  onClick={() => setCreateNoteModalOpen(true)}
                  className="mt-2 text-[var(--accent-primary)] font-semibold hover:underline"
                >
                  Create your first note
                </button>
              </div>
            ) : (
              treeNodes.map(node => renderTreeItem(node, 0))
            )}
          </div>
        )}

        {activeTab === 'tags' && (
          <div className="space-y-1">
            {Object.keys(tagCounts).length === 0 ? (
              <p className="text-xs text-vault-400 text-center py-6">No tags defined yet.</p>
            ) : (
              Object.entries(tagCounts).map(([tag, count]) => (
                <div
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`flex items-center justify-between px-2.5 py-1.5 text-xs rounded-xl cursor-pointer transition-colors ${
                    selectedTag === tag
                      ? 'bg-[var(--accent-muted)] text-[var(--accent-primary)] font-semibold'
                      : 'hover:bg-vault-100 dark:hover:bg-vault-800 text-vault-700 dark:text-vault-300'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Hash size={12} className="text-vault-400" />
                    <span>{tag}</span>
                  </span>
                  <span className="text-[10px] bg-vault-200 dark:bg-vault-800 px-1.5 py-0.5 rounded-full text-vault-500">
                    {count}
                  </span>
                </div>
              ))
            )}

            {selectedTag && (
              <div className="mt-3 pt-3 border-t border-vault-200 dark:border-vault-800">
                <div className="text-[11px] font-semibold text-vault-400 uppercase tracking-wider mb-2 px-1">
                  Notes with #{selectedTag}
                </div>
                {notesSummary
                  .filter(n => n.tags.includes(selectedTag))
                  .map(n => (
                    <div
                      key={n.id}
                      onClick={() => selectNode(n.id)}
                      className={`px-2.5 py-1.5 text-xs rounded-lg cursor-pointer truncate ${
                        n.id === selectedNodeId
                          ? 'bg-[var(--accent-muted)] text-[var(--accent-primary)] font-semibold'
                          : 'hover:bg-vault-100 dark:hover:bg-vault-800 text-vault-600 dark:text-vault-400'
                      }`}
                    >
                      {n.title}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'recent' && (
          <div className="space-y-1">
            {recentNotes.slice(0, 25).map(n => (
              <div
                key={n.id}
                onClick={() => selectNode(n.id)}
                className={`px-2.5 py-1.5 text-xs rounded-xl cursor-pointer transition-colors ${
                  n.id === selectedNodeId
                    ? 'bg-[var(--accent-muted)] text-[var(--accent-primary)] font-semibold'
                    : 'hover:bg-vault-100 dark:hover:bg-vault-800 text-vault-700 dark:text-vault-300'
                }`}
              >
                <div className="truncate font-medium">{n.title}</div>
                <div className="flex items-center gap-1 text-[10px] text-vault-400 mt-0.5">
                  <Clock size={10} />
                  <span>{new Date(n.modified_at).toLocaleDateString()}</span>
                  {n.tags.length > 0 && <span className="ml-1">#{n.tags[0]}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Media & Attachments Tab */}
        {activeTab === 'media' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-vault-400 uppercase tracking-wider">
                Saved Note Media ({mediaList.length})
              </span>
              <button
                type="button"
                onClick={handleOpenMediaFolder}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-vault-200/50 dark:bg-vault-800 text-[10px] font-semibold text-vault-300 hover:text-white hover:bg-vault-700 transition-colors"
                title="Open attachments folder in Windows Explorer"
              >
                <FolderOpen size={11} className="text-amber-400" />
                <span>Open Folder</span>
              </button>
            </div>

            {loadingMedia ? (
              <div className="text-center py-6 text-xs text-vault-400">Loading images...</div>
            ) : mediaList.length === 0 ? (
              <div className="text-center py-8 px-4 text-xs text-vault-400">
                <ImageIcon size={24} className="mx-auto mb-2 opacity-30" />
                <p>No images pasted yet.</p>
                <p className="text-[10px] mt-1 text-vault-500">
                  Paste any screenshot or image into an active note to save it here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {mediaList.map((m) => (
                  <div
                    key={m.name}
                    className="group relative rounded-xl border border-vault-200 dark:border-vault-800 overflow-hidden bg-vault-100 dark:bg-vault-850 hover:border-[var(--accent-primary)] transition-all"
                  >
                    <div className="aspect-video w-full bg-black/40 overflow-hidden flex items-center justify-center">
                      <img
                        src={m.url}
                        alt={m.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-1.5 text-[10px]">
                      <div className="truncate font-mono font-medium text-vault-800 dark:text-vault-200">
                        {m.name}
                      </div>
                      <div className="text-vault-500 text-[9px] mt-0.5 flex items-center justify-between">
                        <span>{(m.size_bytes / 1024).toFixed(0)} KB</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(m.relative_path)}
                            title="Copy Markdown Link"
                            className="p-1 hover:text-[var(--accent-primary)] transition-colors"
                          >
                            {copiedPath === m.relative_path ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => window.open(m.url, '_blank')}
                            title="View Full Size"
                            className="p-1 hover:text-[var(--accent-primary)] transition-colors"
                          >
                            <ExternalLink size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
