import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Info,
  Hash,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../../api/client';
import { useVault } from '../../state/VaultContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export const InspectorPane: React.FC = () => {
  const {
    activeNote,
    backlinks,
    outgoingLinks,
    selectNode,
    updateActiveNoteMetadata,
    isRightPaneOpen,
  } = useVault();

  const [newTagInput, setNewTagInput] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);
  const [showAddRelation, setShowAddRelation] = useState(false);
  const [relTargetTitle, setRelTargetTitle] = useState('');
  const [relType, setRelType] = useState('references');
  const [relLabel, setRelLabel] = useState('');

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
    if (!relTargetTitle.trim()) return;
    try {
      // Find target note
      const searchRes = await api.search(relTargetTitle);
      if (searchRes.results.length === 0) {
        alert(`Note "${relTargetTitle}" not found.`);
        return;
      }
      const targetId = searchRes.results[0].id;
      await api.createRelationship(metadata.id, targetId, relType, relLabel || undefined);
      setShowAddRelation(false);
      setRelTargetTitle('');
      setRelLabel('');
      // Reload note
      selectNode(metadata.id);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteRelationship = async (targetId: string, type: string) => {
    await api.deleteRelationship(metadata.id, targetId, type);
    selectNode(metadata.id);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const att = await api.uploadAttachment(file);
      // Copy markdown embed link to clipboard
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

        {/* Typed Relationships */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[11px] font-semibold text-vault-400 uppercase tracking-wider">
              Relationships ({metadata.relations.length})
            </h4>
            <button
              onClick={() => setShowAddRelation(!showAddRelation)}
              className="text-vault-400 hover:text-indigo-500 p-0.5"
            >
              <Plus size={13} />
            </button>
          </div>

          {metadata.relations.length === 0 ? (
            <p className="text-vault-400 text-[11px]">No explicit relationships.</p>
          ) : (
            <div className="space-y-1.5">
              {metadata.relations.map((rel, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-1.5 bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-800 rounded-lg group"
                >
                  <div className="truncate flex-1">
                    <div className="font-medium text-vault-800 dark:text-vault-200 truncate">
                      {rel.label || rel.target_id}
                    </div>
                    <div className="text-[10px] text-indigo-600 dark:text-indigo-400">
                      {rel.type}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteRelationship(rel.target_id, rel.type)}
                    className="opacity-0 group-hover:opacity-100 text-vault-400 hover:text-red-500 p-1"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAddRelation && (
            <div className="mt-2 p-2 bg-vault-100 dark:bg-vault-800/80 rounded-lg space-y-2 border border-vault-200 dark:border-vault-700">
              <input
                type="text"
                placeholder="Target note title..."
                value={relTargetTitle}
                onChange={e => setRelTargetTitle(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded text-vault-900 dark:text-vault-100 focus:outline-none"
              />
              <select
                value={relType}
                onChange={e => setRelType(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded text-vault-900 dark:text-vault-100 focus:outline-none"
              >
                <option value="references">references</option>
                <option value="depends_on">depends_on</option>
                <option value="relates_to">relates_to</option>
                <option value="implements">implements</option>
                <option value="extends">extends</option>
              </select>
              <input
                type="text"
                placeholder="Optional label..."
                value={relLabel}
                onChange={e => setRelLabel(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded text-vault-900 dark:text-vault-100 focus:outline-none"
              />
              <div className="flex justify-end gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setShowAddRelation(false)}>
                  Cancel
                </Button>
                <Button size="sm" variant="primary" onClick={handleCreateRelationship}>
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
