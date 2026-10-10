import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import type { BackupSummary, BackupManifest } from '../../types';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import {
  Archive,
  Plus,
  RefreshCw,
  Trash2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Calendar,
  HardDrive,
} from 'lucide-react';
import { useVault } from '../../state/VaultContext';

interface BackupModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose }) => {
  const { backupModalOpen, setBackupModalOpen, refreshVault } = useVault();
  const isModalOpen = isOpen !== undefined ? isOpen : backupModalOpen;
  const handleClose = onClose || (() => setBackupModalOpen(false));

  const [backups, setBackups] = useState<BackupSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [description, setDescription] = useState('');
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Selected manifest for inspection
  const [inspectingBackup, setInspectingBackup] = useState<string | null>(null);
  const [manifestData, setManifestData] = useState<BackupManifest | null>(null);
  const [isLoadingManifest, setIsLoadingManifest] = useState(false);

  // Restore state
  const [restoringBackup, setRestoringBackup] = useState<string | null>(null);
  const [clearExisting, setClearExisting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (isModalOpen) {
      loadBackups();
      setError(null);
      setSuccessMsg(null);
    }
  }, [isModalOpen]);

  const loadBackups = async () => {
    try {
      setIsLoading(true);
      const data = await api.listBackups();
      setBackups(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load backups');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreating(true);
      setError(null);
      const res = await api.createBackup({
        description: description.trim() || undefined,
        include_attachments: includeAttachments,
      });
      setSuccessMsg(`Backup created successfully: ${res.filename} (${res.note_count || 0} notes)`);
      setDescription('');
      await loadBackups();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to create backup');
    } finally {
      setIsCreating(false);
    }
  };

  const handleInspectManifest = async (filename: string) => {
    try {
      setInspectingBackup(filename);
      setIsLoadingManifest(true);
      const manifest = await api.getBackupManifest(filename);
      setManifestData(manifest);
    } catch (err: any) {
      setError(`Failed to read manifest for ${filename}: ${err.message}`);
      setInspectingBackup(null);
    } finally {
      setIsLoadingManifest(false);
    }
  };

  const handleRestore = async () => {
    if (!restoringBackup) return;
    try {
      setIsRestoring(true);
      setError(null);
      const res = await api.restoreBackup(restoringBackup, {
        clear_existing: clearExisting,
      });
      setSuccessMsg(
        `Successfully restored ${res.restored_files_count || 0} files (${res.notes_restored || 0} notes, ${res.attachments_restored || 0} attachments).`
      );
      setRestoringBackup(null);
      await refreshVault();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to restore backup');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete backup "${filename}"?`)) {
      return;
    }
    try {
      await api.deleteBackup(filename);
      setSuccessMsg(`Backup ${filename} deleted.`);
      await loadBackups();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to delete backup');
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog isOpen={isModalOpen} onClose={handleClose} title="Vault Backups & Snapshots" maxWidth="xl">
      <div className="space-y-6">
        {error && (
          <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Create Backup Form */}
        <div className="p-4 rounded-xl bg-vault-50 dark:bg-vault-800/60 border border-vault-200 dark:border-vault-700 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-vault-900 dark:text-vault-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-500" /> Create New Snapshot
            </h3>
            <span className="text-xs text-vault-400">SHA-256 Manifest Verified</span>
          </div>

          <form onSubmit={handleCreateBackup} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-6">
              <label className="block text-xs font-semibold text-vault-400 mb-1">
                Description / Memo (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Pre-migration snapshot or milestone"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg px-3 py-1.5 text-xs text-vault-900 dark:text-vault-100 placeholder:text-vault-400 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-3 flex items-center gap-2 pb-1.5">
              <input
                type="checkbox"
                id="includeAttachments"
                checked={includeAttachments}
                onChange={(e) => setIncludeAttachments(e.target.checked)}
                className="rounded border-vault-300 dark:border-vault-700 text-indigo-600 focus:ring-0"
              />
              <label htmlFor="includeAttachments" className="text-xs text-vault-600 dark:text-vault-300 select-none cursor-pointer">
                Include Attachments
              </label>
            </div>

            <div className="md:col-span-3">
              <Button
                variant="primary"
                type="submit"
                isLoading={isCreating}
                icon={<Archive className="w-4 h-4" />}
                className="w-full text-xs"
              >
                Create Backup
              </Button>
            </div>
          </form>
        </div>

        {/* Backup List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-vault-900 dark:text-vault-100 flex items-center gap-2">
              <Archive className="w-4 h-4 text-vault-400" /> Available Backups ({backups.length})
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadBackups}
              isLoading={isLoading}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
          </div>

          {backups.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-vault-200 dark:border-vault-700 rounded-xl">
              <HardDrive className="w-8 h-8 text-vault-400 mx-auto mb-2 opacity-50" />
              <p className="text-xs text-vault-600 dark:text-vault-400">No backups found in vault/backups directory.</p>
              <p className="text-[11px] text-vault-400 mt-1">Create your first full vault snapshot above.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {backups.map((b) => (
                <div
                  key={b.filename}
                  className="p-3 bg-vault-50 dark:bg-vault-800/60 border border-vault-200 dark:border-vault-700 rounded-lg flex items-center justify-between gap-4 hover:border-vault-300 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-vault-900 dark:text-vault-100 truncate">
                        {b.filename}
                      </span>
                      {b.description && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-vault-200/60 dark:bg-vault-700 text-vault-600 dark:text-vault-300 truncate max-w-xs">
                          {b.description}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-[11px] text-vault-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(b.created_at).toLocaleString()}
                      </span>
                      <span>{formatBytes(b.size_bytes || (b as any).file_size_bytes)}</span>
                      <span>{b.file_count || (b as any).note_count || 0} files</span>
                      {b.has_manifest && (
                        <span className="text-emerald-400 font-medium">Manifest Signed</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Inspect SHA-256 Manifest"
                      onClick={() => handleInspectManifest(b.filename)}
                      icon={<FileCode className="w-3.5 h-3.5 text-indigo-500" />}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      title="Restore Vault from Snapshot"
                      onClick={() => setRestoringBackup(b.filename)}
                      icon={<RotateCcw className="w-3.5 h-3.5 text-amber-400" />}
                    >
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Delete Snapshot"
                      onClick={() => handleDelete(b.filename)}
                      icon={<Trash2 className="w-3.5 h-3.5 text-red-400" />}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Restore Confirmation Section */}
        {restoringBackup && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
              <AlertTriangle className="w-4 h-4" />
              Confirm Staged Restore: {restoringBackup}
            </div>
            <p className="text-xs text-vault-600 dark:text-vault-300 leading-relaxed">
              Restoring will stage the contents into a temporary directory, verify integrity against the
              included SHA-256 manifest, and update the live vault nodes and attachments.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="clearExisting"
                checked={clearExisting}
                onChange={(e) => setClearExisting(e.target.checked)}
                className="rounded border-vault-300 dark:border-vault-700 text-red-500 focus:ring-0"
              />
              <label htmlFor="clearExisting" className="text-xs text-red-400 font-medium cursor-pointer">
                Wipe existing notes prior to restore (Complete In-Place Overwrite)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRestoringBackup(null)}
                disabled={isRestoring}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleRestore}
                isLoading={isRestoring}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Proceed with Restore
              </Button>
            </div>
          </div>
        )}

        {/* Manifest Inspector Section */}
        {inspectingBackup && (
          <div className="p-4 rounded-xl bg-vault-50 dark:bg-vault-800/60 border border-vault-200 dark:border-vault-700 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-vault-900 dark:text-vault-100">
                <FileCode className="w-4 h-4 text-indigo-500" />
                Manifest for {inspectingBackup}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInspectingBackup(null)}
              >
                Close Inspector
              </Button>
            </div>

            {isLoadingManifest ? (
              <div className="p-4 text-center text-xs text-vault-400">Loading manifest data...</div>
            ) : manifestData ? (
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-[11px] text-vault-400">
                  <span>Created: {new Date(manifestData.created_at).toLocaleString()}</span>
                  <span>Total Files: {manifestData.total_files || Object.keys(manifestData.files || {}).length}</span>
                  <span>Manifest SHA-256: {(manifestData.manifest_hash || '').slice(0, 16)}...</span>
                </div>
                <div className="max-h-48 overflow-y-auto bg-white dark:bg-vault-900 p-3 rounded-lg border border-vault-200 dark:border-vault-700 font-mono text-[11px] space-y-1">
                  {manifestData.files &&
                    Object.entries(manifestData.files).map(([path, fileInfo]: [string, any]) => (
                      <div key={path} className="flex justify-between items-center text-vault-700 dark:text-vault-300">
                        <span className="truncate pr-4">{path}</span>
                        <span className="text-vault-400 flex-shrink-0">
                          {(fileInfo.sha256 || '').slice(0, 12)}... ({formatBytes(fileInfo.size_bytes)})
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-vault-400">No manifest found in this archive.</div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-vault-200 dark:border-vault-800">
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
