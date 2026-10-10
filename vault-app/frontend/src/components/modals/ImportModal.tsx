import React, { useState } from 'react';
import { api } from '../../api/client';
import type { ImportResult } from '../../types';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import {
  Upload,
  FolderInput,
  AlertTriangle,
  CheckCircle2,
  FolderTree,
  ShieldAlert,
} from 'lucide-react';
import { useVault } from '../../state/VaultContext';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose }) => {
  const { notes, refreshVault } = useVault();
  const [importMode, setImportMode] = useState<'file' | 'directory'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dirPath, setDirPath] = useState('');
  const [targetParentId, setTargetParentId] = useState<string | null>(null);
  const [collisionPolicy, setCollisionPolicy] = useState<'rename' | 'overwrite' | 'skip'>('rename');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    try {
      setIsLoading(true);
      let res: ImportResult;

      if (importMode === 'file') {
        if (!selectedFile) {
          setError('Please select a .md or .zip file to import.');
          return;
        }
        res = await api.importFile(
          selectedFile,
          targetParentId || undefined,
          collisionPolicy
        );
      } else {
        if (!dirPath.trim()) {
          setError('Please enter a valid directory path.');
          return;
        }
        res = await api.importDirectory({
          source_path: dirPath.trim(),
          target_parent_id: targetParentId || undefined,
          collision_policy: collisionPolicy,
        });
      }

      setResult(res);
      await refreshVault();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Import failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Import Notes & Documents" maxWidth="lg">
      <div className="space-y-5">
        {/* Mode Switcher */}
        <div className="flex border-b border-vault-200 dark:border-vault-800">
          <button
            type="button"
            onClick={() => {
              setImportMode('file');
              setResult(null);
              setError(null);
            }}
            className={`flex items-center gap-2 pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
              importMode === 'file'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-vault-400 hover:text-vault-700'
            }`}
          >
            <Upload className="w-4 h-4" /> Upload .md / .zip
          </button>
          <button
            type="button"
            onClick={() => {
              setImportMode('directory');
              setResult(null);
              setError(null);
            }}
            className={`flex items-center gap-2 pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
              importMode === 'directory'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-vault-400 hover:text-vault-700'
            }`}
          >
            <FolderInput className="w-4 h-4" /> Import from Local Directory
          </button>
        </div>

        {error && (
          <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              Import Completed Successfully!
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-vault-600 dark:text-vault-400 pt-1">
              <div className="p-2 bg-vault-50 dark:bg-vault-800/50 rounded border border-vault-200 dark:border-vault-700">
                <span className="text-vault-400 block">Notes Imported:</span>
                <span className="text-sm font-semibold text-vault-900 dark:text-vault-100">{result.notes_imported}</span>
              </div>
              <div className="p-2 bg-vault-50 dark:bg-vault-800/50 rounded border border-vault-200 dark:border-vault-700">
                <span className="text-vault-400 block">Notes Updated:</span>
                <span className="text-sm font-semibold text-vault-900 dark:text-vault-100">{result.notes_updated}</span>
              </div>
              <div className="p-2 bg-vault-50 dark:bg-vault-800/50 rounded border border-vault-200 dark:border-vault-700">
                <span className="text-vault-400 block">Notes Skipped:</span>
                <span className="text-sm font-semibold text-vault-900 dark:text-vault-100">{result.notes_skipped}</span>
              </div>
              <div className="p-2 bg-vault-50 dark:bg-vault-800/50 rounded border border-vault-200 dark:border-vault-700">
                <span className="text-vault-400 block">Attachments:</span>
                <span className="text-sm font-semibold text-vault-900 dark:text-vault-100">{result.attachments_imported}</span>
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div className="mt-2 text-[11px] text-amber-400 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                <span className="font-semibold block mb-1">Warnings / Errors:</span>
                <ul className="list-disc list-inside space-y-0.5">
                  {result.errors.map((err: string, i: number) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleImport} className="space-y-4">
          {importMode === 'file' ? (
            <div>
              <label className="block text-xs font-semibold text-vault-400 mb-1.5 uppercase tracking-wider">
                Select File (.md Markdown or .zip Archive)
              </label>
              <div className="border-2 border-dashed border-vault-200 dark:border-vault-700 rounded-xl p-6 text-center hover:border-indigo-500 transition-colors cursor-pointer relative bg-vault-50 dark:bg-vault-800/40">
                <input
                  type="file"
                  accept=".md,.markdown,.zip"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-8 h-8 text-vault-400 mx-auto mb-2 opacity-60" />
                {selectedFile ? (
                  <div>
                    <span className="text-xs font-semibold text-indigo-500 block">
                      {selectedFile.name}
                    </span>
                    <span className="text-[11px] text-vault-400">
                      ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs text-vault-600 dark:text-vault-300 block">
                      Click to choose or drag and drop markdown file or zip archive
                    </span>
                    <span className="text-[11px] text-vault-400">
                      Preserves internal links and attachments
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-vault-400 mb-1.5 uppercase tracking-wider">
                Absolute Directory Path on Host
              </label>
              <input
                type="text"
                placeholder="e.g. C:\Users\Username\Documents\ObsidianVault"
                value={dirPath}
                onChange={(e) => setDirPath(e.target.value)}
                className="w-full bg-vault-50 dark:bg-vault-800/60 border border-vault-200 dark:border-vault-700 rounded-lg px-3 py-2 text-xs text-vault-900 dark:text-vault-100 placeholder:text-vault-400 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-vault-400 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5" /> Target Parent Note
              </label>
              <select
                value={targetParentId || ''}
                onChange={(e) => setTargetParentId(e.target.value || null)}
                className="w-full bg-vault-50 dark:bg-vault-800/60 border border-vault-200 dark:border-vault-700 rounded-lg px-3 py-2 text-xs text-vault-900 dark:text-vault-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="">(Root - Top Level)</option>
                {notes.map((n: any) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-vault-400 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Collision Policy
              </label>
              <select
                value={collisionPolicy}
                onChange={(e) =>
                  setCollisionPolicy(e.target.value as 'rename' | 'overwrite' | 'skip')
                }
                className="w-full bg-vault-50 dark:bg-vault-800/60 border border-vault-200 dark:border-vault-700 rounded-lg px-3 py-2 text-xs text-vault-900 dark:text-vault-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="rename">Rename on conflict (Note (1).md)</option>
                <option value="overwrite">Overwrite existing notes</option>
                <option value="skip">Skip conflicting notes</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-vault-200 dark:border-vault-800">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={isLoading}
              icon={<Upload className="w-4 h-4" />}
            >
              Start Import
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
};
