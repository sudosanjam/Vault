import React, { useState, useEffect } from 'react';
import { useVault } from '../../state/VaultContext';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { FileText, FolderTree, Tag, Sparkles } from 'lucide-react';
import type { NoteType } from '../../types';

interface CreateNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultParentId?: string | null;
}

export const CreateNoteModal: React.FC<CreateNoteModalProps> = ({
  isOpen,
  onClose,
  defaultParentId = null,
}) => {
  const { notes, createNote } = useVault();
  const [title, setTitle] = useState('');
  const [parentId, setParentId] = useState<string | null>(defaultParentId);
  const [noteType, setNoteType] = useState<NoteType>('standard');
  const [tagsInput, setTagsInput] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setParentId(defaultParentId);
      setNoteType('standard');
      setTagsInput('');
      setContent('');
      setError(null);
    }
  }, [isOpen, defaultParentId]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter((t) => t.length > 0);

      await createNote({
        title: title.trim(),
        parent_id: parentId || null,
        note_type: noteType,
        tags,
        content: content || `# ${title.trim()}\n\n`,
      });

      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to create note');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Create New Note" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-vault-400 mb-1.5 uppercase tracking-wider">
            Title *
          </label>
          <div className="relative">
            <input
              type="text"
              autoFocus
              placeholder="e.g. Zero-Trust Architecture"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-vault-50 dark:bg-vault-800/60 border border-vault-200 dark:border-vault-700 rounded-lg px-3 py-2 text-sm text-vault-900 dark:text-vault-100 placeholder:text-vault-400 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-vault-400 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5" /> Parent Note
            </label>
            <select
              value={parentId || ''}
              onChange={(e) => setParentId(e.target.value || null)}
              className="w-full bg-vault-50 dark:bg-vault-800/60 border border-vault-200 dark:border-vault-700 rounded-lg px-3 py-2 text-sm text-vault-900 dark:text-vault-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">(Root - Top Level)</option>
              {notes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-vault-400 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Note Type
            </label>
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value as NoteType)}
              className="w-full bg-vault-50 dark:bg-vault-800/60 border border-vault-200 dark:border-vault-700 rounded-lg px-3 py-2 text-sm text-vault-900 dark:text-vault-100 focus:outline-none focus:border-indigo-500 capitalize"
            >
              <option value="standard">Standard</option>
              <option value="concept">Concept</option>
              <option value="project">Project</option>
              <option value="daily">Daily</option>
              <option value="journal">Journal</option>
              <option value="reference">Reference</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-vault-400 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" /> Tags (comma separated)
          </label>
          <input
            type="text"
            placeholder="architecture, security, 2026"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            className="w-full bg-vault-50 dark:bg-vault-800/60 border border-vault-200 dark:border-vault-700 rounded-lg px-3 py-2 text-sm text-vault-900 dark:text-vault-100 placeholder:text-vault-400 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-vault-400 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Initial Content (Markdown optional)
          </label>
          <textarea
            rows={4}
            placeholder="Write initial notes or leave blank for a default header..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full bg-vault-50 dark:bg-vault-800/60 border border-vault-200 dark:border-vault-700 rounded-lg px-3 py-2 text-sm text-vault-900 dark:text-vault-100 placeholder:text-vault-400 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-vault-200 dark:border-vault-800">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isSubmitting}>
            Create Note
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
