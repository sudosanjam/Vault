import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Info,
  Hash,
  Plus,
  Trash2,
  Upload,
  X,
  Edit2,
  Check,
  ExternalLink,
  Search,
  ArrowRight,
  ArrowLeft,
  Link as LinkIcon,
} from 'lucide-react';
import { api } from '../../api/client';
import { useVault } from '../../state/VaultContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

const RELATION_TYPES = [
  'references',
  'depends_on',
  'relates_to',
  'implements',
  'extends',
  'parent_of',
  'child_of',
  'derived_from',
  'contradicts',
  'mentions',
];

export const InspectorPane: React.FC = () => {
  const {
    activeNote,
    backlinks,
    outgoingLinks,
    notesSummary,
    selectNode,
    refreshVault,
    updateActiveNoteMetadata,
    isRightPaneOpen,
  } = useVault();

  // Tags state
  const [newTagInput, setNewTagInput] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);

  // Add Relationship state
  const [showAddRelation, setShowAddRelation] = useState(false);
  const [relDirection, setRelDirection] = useState<'outgoing' | 'incoming'>('outgoing');
  const [relTargetTitle, setRelTargetTitle] = useState('');
  const [relTargetId, setRelTargetId] = useState<string | null>(null);
  const [relType, setRelType] = useState('references');
  const [relLabel, setRelLabel] = useState('');
  const [showRelSuggestions, setShowRelSuggestions] = useState(false);

  // Edit Relationship state
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editOldTargetId, setEditOldTargetId] = useState<string>('');
  const [editOldRelType, setEditOldRelType] = useState<string>('references');
  const [editTargetTitle, setEditTargetTitle] = useState<string>('');
  const [editTargetId, setEditTargetId] = useState<string>('');
  const [editRelType, setEditRelType] = useState<string>('references');
  const [editRelLabel, setEditRelLabel] = useState<string>('');
  const [showEditSuggestions, setShowEditSuggestions] = useState<boolean>(false);

  const addFormRef = useRef<HTMLDivElement>(null);
  const editFormRef = useRef<HTMLDivElement>(null);

  // Close suggestion dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addFormRef.current && !addFormRef.current.contains(e.target as Node)) {
        setShowRelSuggestions(false);
      }
      if (editFormRef.current && !editFormRef.current.contains(e.target as Node)) {
        setShowEditSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isRightPaneOpen) return null;

  if (!activeNote) {
    return (
      <aside className="w-full bg-vault-50/50 dark:bg-vault-900/50 border-l border-vault-200 dark:border-vault-800 p-4 text-center text-xs text-vault-400 flex flex-col items-center justify-center select-none shrink-0 h-full">
        <Info size={24} className="mb-2 text-vault-300 dark:text-vault-600" />
        <p>No note selected.</p>
        <p className="text-[11px] mt-1 text-vault-400">Select a note from the tree or graph to inspect properties and relationships.</p>
      </aside>
    );
  }

  const { metadata } = activeNote;

  // Helper to resolve note title from ID
  const getNoteTitle = (id: string) => {
    const found = notesSummary.find(n => n.id === id);
    return found?.title || id;
  };

  // Filter note suggestions for Add Relationship
  const addSuggestions = notesSummary
    .filter(n => n.id !== metadata.id)
    .filter(n => {
      if (!relTargetTitle.trim()) return true;
      const q = relTargetTitle.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        n.tags?.some(t => t.toLowerCase().includes(q))
      );
    })
    .slice(0, 8);

  // Filter note suggestions for Edit Relationship
  const editSuggestions = notesSummary
    .filter(n => n.id !== metadata.id)
    .filter(n => {
      if (!editTargetTitle.trim()) return true;
      const q = editTargetTitle.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        n.tags?.some(t => t.toLowerCase().includes(q))
      );
    })
    .slice(0, 8);

  const handleAddTag = async () => {
    const cleanTag = newTagInput.trim().toLowerCase().replace(/^#/, '');
    if (cleanTag && !metadata.tags.includes(cleanTag)) {
      const updatedTags = [...metadata.tags, cleanTag];
      await updateActiveNoteMetadata({ tags: updatedTags });
      setNewTagInput('');
      setShowAddTag(false);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const updatedTags = metadata.tags.filter(t => t !== tagToRemove);
    await updateActiveNoteMetadata({ tags: updatedTags });
  };

  const handleCreateRelationship = async () => {
    let targetId = relTargetId;
    if (!targetId) {
      if (!relTargetTitle.trim()) {
        alert('Please specify a target note.');
        return;
      }
      const match = notesSummary.find(
        n => n.title.toLowerCase() === relTargetTitle.trim().toLowerCase()
      );
      if (match) {
        targetId = match.id;
      } else {
        try {
          const searchRes = await api.search(relTargetTitle.trim());
          if (searchRes.results.length === 0) {
            alert(`Note "${relTargetTitle}" not found in vault.`);
            return;
          }
          targetId = searchRes.results[0].id;
        } catch {
          alert(`Note "${relTargetTitle}" not found.`);
          return;
        }
      }
    }

    if (!targetId) {
      alert(`Note "${relTargetTitle}" not found in vault.`);
      return;
    }

    try {
      if (relDirection === 'outgoing') {
        await api.createRelationship(metadata.id, targetId, relType, relLabel.trim() || undefined);
      } else {
        await api.createRelationship(targetId, metadata.id, relType, relLabel.trim() || undefined);
      }
      setShowAddRelation(false);
      setRelTargetTitle('');
      setRelTargetId(null);
      setRelLabel('');
      setShowRelSuggestions(false);
      await selectNode(metadata.id);
      await refreshVault();
    } catch (e: any) {
      alert(e.message || 'Failed to create relationship');
    }
  };

  const startEditing = (idx: number, rel: { target_id: string; type: string; label?: string | null }) => {
    setEditingIdx(idx);
    setEditOldTargetId(rel.target_id);
    setEditOldRelType(rel.type);
    const found = notesSummary.find(n => n.id === rel.target_id);
    setEditTargetTitle(found?.title || rel.label || rel.target_id);
    setEditTargetId(rel.target_id);
    setEditRelType(rel.type);
    setEditRelLabel(rel.label || '');
    setShowEditSuggestions(false);
  };

  const handleSaveEdit = async () => {
    let finalTargetId = editTargetId;
    if (!finalTargetId || !notesSummary.some(n => n.id === finalTargetId)) {
      const match = notesSummary.find(
        n => n.title.toLowerCase() === editTargetTitle.trim().toLowerCase()
      );
      if (match) {
        finalTargetId = match.id;
      } else {
        try {
          const searchRes = await api.search(editTargetTitle.trim());
          if (searchRes.results.length > 0) {
            finalTargetId = searchRes.results[0].id;
          } else {
            alert(`Note "${editTargetTitle}" not found in vault.`);
            return;
          }
        } catch {
          alert(`Note "${editTargetTitle}" not found in vault.`);
          return;
        }
      }
    }

    try {
      await api.updateRelationship(
        metadata.id,
        editOldTargetId,
        editOldRelType,
        finalTargetId,
        editRelType,
        editRelLabel.trim() || undefined
      );
      setEditingIdx(null);
      await selectNode(metadata.id);
      await refreshVault();
    } catch (e: any) {
      alert(e.message || 'Failed to update relationship');
    }
  };

  const handleDeleteRelationship = async (targetId: string, type: string) => {
    await api.deleteRelationship(metadata.id, targetId, type);
    await selectNode(metadata.id);
    await refreshVault();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const att = await api.uploadAttachment(file);
      const mdSnippet = att.subfolder === 'images' ? `![${att.original_name}](${att.relative_path})` : `[${att.original_name}](${att.relative_path})`;
      navigator.clipboard.writeText(mdSnippet);
      alert(`Uploaded "${att.original_name}". Markdown snippet copied to clipboard!`);
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    }
  };

  return (
    <aside className="w-full bg-vault-50/50 dark:bg-vault-900/50 border-l border-vault-200 dark:border-vault-800 flex flex-col shrink-0 text-xs select-none overflow-y-auto h-full">
      {/* Pane Title */}
      <div className="px-4 py-3 border-b border-vault-200 dark:border-vault-800 flex items-center justify-between">
        <span className="font-semibold text-vault-900 dark:text-vault-100 flex items-center gap-1.5">
          <Info size={14} className="text-indigo-500" />
          Inspector
        </span>
        <Badge variant="primary" size="sm">
          {metadata.note_type}
        </Badge>
      </div>

      <div className="p-4 space-y-5">
        {/* Note Metadata Details */}
        <div>
          <h4 className="text-[11px] font-semibold text-vault-400 uppercase tracking-wider mb-2">
            Details
          </h4>
          <div className="space-y-1.5 text-vault-600 dark:text-vault-400">
            <div className="flex justify-between">
              <span className="text-vault-400">Node ID</span>
              <span className="font-mono text-[10px] text-vault-700 dark:text-vault-300 truncate max-w-[150px]">
                {metadata.id}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-vault-400">Modified</span>
              <span>{new Date(metadata.modified_at).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-vault-400">Created</span>
              <span>{new Date(metadata.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Tags Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[11px] font-semibold text-vault-400 uppercase tracking-wider">
              Tags
            </h4>
            <button
              onClick={() => setShowAddTag(!showAddTag)}
              className="text-vault-400 hover:text-indigo-500 p-0.5"
              title="Add Tag"
            >
              <Plus size={13} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {metadata.tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-vault-200/70 dark:bg-vault-800 text-vault-700 dark:text-vault-300 text-xs font-medium"
              >
                <Hash size={11} className="text-vault-400" />
                <span>{tag}</span>
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-red-500 ml-0.5"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>

          {showAddTag && (
            <div className="flex gap-1 mt-2">
              <input
                type="text"
                placeholder="tag name..."
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                className="flex-1 px-2 py-1 text-xs bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded text-vault-900 dark:text-vault-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                autoFocus
              />
              <Button size="sm" variant="primary" onClick={handleAddTag}>
                Add
              </Button>
            </div>
          )}
        </div>

        {/* Typed Relationships Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[11px] font-semibold text-vault-400 uppercase tracking-wider">
              Relationships ({metadata.relations.length})
            </h4>
            <button
              onClick={() => {
                setShowAddRelation(!showAddRelation);
                setEditingIdx(null);
              }}
              className="text-vault-400 hover:text-indigo-500 p-0.5"
              title="Define Relationship"
            >
              <Plus size={13} />
            </button>
          </div>

          {metadata.relations.length === 0 && !showAddRelation && (
            <p className="text-vault-400 text-[11px]">No explicit relationships.</p>
          )}

          {/* List of Relationships with In-Place Editing */}
          <div className="space-y-1.5">
            {metadata.relations.map((rel, idx) => {
              const isEditing = editingIdx === idx;

              if (isEditing) {
                return (
                  <div
                    key={idx}
                    ref={editFormRef}
                    className="p-2.5 bg-vault-100 dark:bg-vault-800/90 border border-indigo-500 dark:border-indigo-500/80 rounded-lg space-y-2 shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                      <span className="flex items-center gap-1">
                        <Edit2 size={11} /> Edit Relationship
                      </span>
                      <button
                        onClick={() => setEditingIdx(null)}
                        className="text-vault-400 hover:text-vault-600 dark:hover:text-vault-200"
                      >
                        <X size={12} />
                      </button>
                    </div>

                    {/* Target Note Autocomplete Input */}
                    <div className="relative">
                      <label className="text-[10px] text-vault-400 block mb-0.5">Target Note</label>
                      <div className="flex items-center bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded px-2 py-1 focus-within:ring-1 focus-within:ring-indigo-500">
                        <Search size={11} className="text-vault-400 mr-1.5 shrink-0" />
                        <input
                          type="text"
                          value={editTargetTitle}
                          onChange={e => {
                            setEditTargetTitle(e.target.value);
                            setEditTargetId('');
                            setShowEditSuggestions(true);
                          }}
                          onFocus={() => setShowEditSuggestions(true)}
                          placeholder="Search target note in vault..."
                          className="w-full text-xs bg-transparent text-vault-900 dark:text-vault-100 focus:outline-none"
                        />
                      </div>

                      {showEditSuggestions && (
                        <div className="absolute z-30 left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg shadow-xl divide-y divide-vault-100 dark:divide-vault-800">
                          {editSuggestions.length === 0 ? (
                            <div className="px-2.5 py-2 text-[10px] text-vault-400 text-center">
                              No matching notes
                            </div>
                          ) : (
                            editSuggestions.map(n => (
                              <div
                                key={n.id}
                                onClick={() => {
                                  setEditTargetTitle(n.title);
                                  setEditTargetId(n.id);
                                  setShowEditSuggestions(false);
                                }}
                                className="px-2.5 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/70 cursor-pointer flex items-center justify-between text-xs"
                              >
                                <span className="truncate font-medium text-vault-800 dark:text-vault-200">
                                  {n.title}
                                </span>
                                <span className="text-[9px] uppercase tracking-wider font-mono px-1 py-0.5 bg-vault-100 dark:bg-vault-800 text-vault-500 rounded shrink-0">
                                  {n.note_type}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Relationship Type */}
                    <div>
                      <label className="text-[10px] text-vault-400 block mb-0.5">Type</label>
                      <select
                        value={editRelType}
                        onChange={e => setEditRelType(e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded text-vault-900 dark:text-vault-100 focus:outline-none"
                      >
                        {RELATION_TYPES.map(t => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Optional Label */}
                    <div>
                      <label className="text-[10px] text-vault-400 block mb-0.5">Label (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. core dependency, parent node..."
                        value={editRelLabel}
                        onChange={e => setEditRelLabel(e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded text-vault-900 dark:text-vault-100 focus:outline-none"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-1.5 pt-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditingIdx(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" variant="primary" onClick={handleSaveEdit}>
                        <Check size={12} className="mr-1" />
                        Save
                      </Button>
                    </div>
                  </div>
                );
              }

              // Normal Card View
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-800 rounded-lg group hover:border-vault-300 dark:hover:border-vault-700 transition-colors"
                >
                  <div className="truncate flex-1 pr-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        onClick={() => selectNode(rel.target_id)}
                        className="font-medium text-vault-900 dark:text-vault-100 truncate hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                        title={`Open ${getNoteTitle(rel.target_id)}`}
                      >
                        {getNoteTitle(rel.target_id)}
                      </span>
                      <ExternalLink
                        size={10}
                        onClick={() => selectNode(rel.target_id)}
                        className="text-vault-400 opacity-60 hover:opacity-100 cursor-pointer shrink-0"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] uppercase tracking-wider font-mono px-1 py-0.2 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 rounded border border-indigo-200 dark:border-indigo-900/60">
                        {rel.type}
                      </span>
                      {rel.label && (
                        <span className="text-[10px] text-vault-500 dark:text-vault-400 italic truncate">
                          "{rel.label}"
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEditing(idx, rel)}
                      className="p-1 text-vault-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded hover:bg-vault-100 dark:hover:bg-vault-800 transition-colors"
                      title="Edit Relationship"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteRelationship(rel.target_id, rel.type)}
                      className="p-1 text-vault-400 hover:text-red-500 rounded hover:bg-vault-100 dark:hover:bg-vault-800 transition-colors"
                      title="Delete Relationship"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Relationship Form */}
          {showAddRelation && (
            <div
              ref={addFormRef}
              className="mt-2.5 p-3 bg-vault-100 dark:bg-vault-800/85 rounded-lg space-y-2.5 border border-vault-200 dark:border-vault-700 shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-vault-800 dark:text-vault-200 flex items-center gap-1.5">
                  <LinkIcon size={12} className="text-indigo-500" />
                  Define Relationship
                </span>
                <button
                  onClick={() => setShowAddRelation(false)}
                  className="text-vault-400 hover:text-vault-600 dark:hover:text-vault-200"
                >
                  <X size={12} />
                </button>
              </div>

              {/* Direction Toggle: From this note vs To this note */}
              <div>
                <label className="text-[10px] text-vault-400 block mb-1">Direction</label>
                <div className="grid grid-cols-2 gap-1 bg-vault-200/60 dark:bg-vault-900 p-0.5 rounded border border-vault-200 dark:border-vault-800">
                  <button
                    type="button"
                    onClick={() => setRelDirection('outgoing')}
                    className={`flex items-center justify-center gap-1 py-1 px-1.5 text-[10px] font-medium rounded transition-colors ${
                      relDirection === 'outgoing'
                        ? 'bg-white dark:bg-vault-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-vault-500 hover:text-vault-700 dark:hover:text-vault-300'
                    }`}
                  >
                    <ArrowRight size={10} /> Outgoing (From this)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRelDirection('incoming')}
                    className={`flex items-center justify-center gap-1 py-1 px-1.5 text-[10px] font-medium rounded transition-colors ${
                      relDirection === 'incoming'
                        ? 'bg-white dark:bg-vault-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-vault-500 hover:text-vault-700 dark:hover:text-vault-300'
                    }`}
                  >
                    <ArrowLeft size={10} /> Incoming (To this)
                  </button>
                </div>
              </div>

              {/* Note Autocomplete Search Input */}
              <div className="relative">
                <label className="text-[10px] text-vault-400 block mb-0.5">
                  {relDirection === 'outgoing' ? 'Target Note' : 'Source Note'}
                </label>
                <div className="flex items-center bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded px-2 py-1 focus-within:ring-1 focus-within:ring-indigo-500">
                  <Search size={11} className="text-vault-400 mr-1.5 shrink-0" />
                  <input
                    type="text"
                    placeholder="Type note name across vault..."
                    value={relTargetTitle}
                    onChange={e => {
                      setRelTargetTitle(e.target.value);
                      setRelTargetId(null);
                      setShowRelSuggestions(true);
                    }}
                    onFocus={() => setShowRelSuggestions(true)}
                    className="w-full text-xs bg-transparent text-vault-900 dark:text-vault-100 focus:outline-none"
                  />
                  {relTargetTitle && (
                    <button
                      type="button"
                      onClick={() => {
                        setRelTargetTitle('');
                        setRelTargetId(null);
                      }}
                      className="text-vault-400 hover:text-vault-600 dark:hover:text-vault-200 p-0.5"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>

                {/* Suggestions Dropdown */}
                {showRelSuggestions && (
                  <div className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg shadow-xl divide-y divide-vault-100 dark:divide-vault-800">
                    {addSuggestions.length === 0 ? (
                      <div className="px-3 py-2 text-[10px] text-vault-400 text-center">
                        No matching notes found
                      </div>
                    ) : (
                      addSuggestions.map(n => (
                        <div
                          key={n.id}
                          onClick={() => {
                            setRelTargetTitle(n.title);
                            setRelTargetId(n.id);
                            setShowRelSuggestions(false);
                          }}
                          className="px-2.5 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/70 cursor-pointer flex items-center justify-between group transition-colors"
                        >
                          <div className="truncate mr-2">
                            <div className="font-medium text-vault-800 dark:text-vault-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                              {n.title}
                            </div>
                            {n.tags && n.tags.length > 0 && (
                              <div className="text-[10px] text-vault-400 truncate">
                                #{n.tags.join(' #')}
                              </div>
                            )}
                          </div>
                          <span className="text-[9px] uppercase tracking-wider font-mono px-1 py-0.5 bg-vault-100 dark:bg-vault-800 text-vault-500 rounded shrink-0">
                            {n.note_type}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Relationship Type */}
              <div>
                <label className="text-[10px] text-vault-400 block mb-0.5">Type</label>
                <select
                  value={relType}
                  onChange={e => setRelType(e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded text-vault-900 dark:text-vault-100 focus:outline-none"
                >
                  {RELATION_TYPES.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional Label */}
              <div>
                <label className="text-[10px] text-vault-400 block mb-0.5">Label (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. references, depends_on, subcomponent..."
                  value={relLabel}
                  onChange={e => setRelLabel(e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded text-vault-900 dark:text-vault-100 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-1.5 pt-1">
                <Button size="sm" variant="ghost" onClick={() => setShowAddRelation(false)}>
                  Cancel
                </Button>
                <Button size="sm" variant="primary" onClick={handleCreateRelationship}>
                  <Plus size={12} className="mr-1" />
                  Connect
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Backlinks (Incoming Links) */}
        <div>
          <h4 className="text-[11px] font-semibold text-vault-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <ArrowDownLeft size={13} className="text-emerald-500" />
            Backlinks ({backlinks.length})
          </h4>

          {backlinks.length === 0 ? (
            <p className="text-vault-400 text-[11px]">No incoming backlinks.</p>
          ) : (
            <div className="space-y-1">
              {backlinks.map((b, i) => (
                <div
                  key={i}
                  onClick={() => selectNode(b.source_id)}
                  className="p-1.5 bg-white dark:bg-vault-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-vault-200 dark:border-vault-800 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="font-medium text-vault-800 dark:text-vault-200 truncate">
                    {b.source_title}
                  </div>
                  {b.relation_type && (
                    <div className="text-[10px] text-vault-400 capitalize">{b.relation_type}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Outgoing Links */}
        <div>
          <h4 className="text-[11px] font-semibold text-vault-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <ArrowUpRight size={13} className="text-indigo-500" />
            Outgoing Links ({outgoingLinks.length})
          </h4>

          {outgoingLinks.length === 0 ? (
            <p className="text-vault-400 text-[11px]">No outgoing links.</p>
          ) : (
            <div className="space-y-1">
              {outgoingLinks.map((o, i) => (
                <div
                  key={i}
                  onClick={() => o.target_id && selectNode(o.target_id)}
                  className={`p-1.5 bg-white dark:bg-vault-900 border rounded-lg transition-colors ${
                    o.is_broken
                      ? 'border-red-300 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20'
                      : 'border-vault-200 dark:border-vault-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-vault-800 dark:text-vault-200 truncate">
                      {o.target_title}
                    </span>
                    {o.is_broken && (
                      <Badge variant="danger" size="sm">
                        Broken
                      </Badge>
                    )}
                  </div>
                  {o.label && <div className="text-[10px] text-vault-400">{o.label}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attach File Section */}
        <div className="pt-2 border-t border-vault-200 dark:border-vault-800">
          <label className="flex items-center justify-center gap-1.5 w-full py-2 border-2 border-dashed border-vault-300 dark:border-vault-700 hover:border-indigo-500 rounded-lg cursor-pointer text-vault-500 hover:text-indigo-600 transition-colors">
            <Upload size={14} />
            <span className="font-medium">Attach File to Vault</span>
            <input type="file" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>
    </aside>
  );
};
