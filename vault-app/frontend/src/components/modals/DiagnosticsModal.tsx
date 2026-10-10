import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import type { VaultDiagnostics } from '../../types';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Trash2,
  RefreshCw,
  FileQuestion,
  Link2Off,
  HardDrive,
  Files,
} from 'lucide-react';
import { useVault } from '../../state/VaultContext';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({ isOpen, onClose }) => {
  const { refreshVault, selectNote } = useVault();
  const [diagnostics, setDiagnostics] = useState<VaultDiagnostics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadDiagnostics();
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  const loadDiagnostics = async () => {
    try {
      setIsLoading(true);
      const data = await api.getDiagnostics();
      setDiagnostics(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch diagnostics');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRebuildIndex = async () => {
    try {
      setIsRebuilding(true);
      setError(null);
      const res = await api.rebuildIndex();
      setSuccessMsg(`Index rebuilt successfully: ${res.nodes_indexed || 0} nodes indexed in ${Number(res.elapsed_ms || 0).toFixed(1)}ms`);
      await refreshVault();
      await loadDiagnostics();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to rebuild index');
    } finally {
      setIsRebuilding(false);
    }
  };

  const handleCleanupOrphans = async () => {
    if (!window.confirm('Delete all orphaned attachment files not referenced by any note?')) {
      return;
    }
    try {
      setIsCleaning(true);
      setError(null);
      const res = await api.cleanupOrphanedAttachments();
      setSuccessMsg(`Cleaned up ${res.deleted_count} orphaned attachments.`);
      await loadDiagnostics();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to clean orphaned attachments');
    } finally {
      setIsCleaning(false);
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
    <Dialog isOpen={isOpen} onClose={onClose} title="Vault Health & Diagnostics" maxWidth="xl">
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

        {isLoading ? (
          <div className="p-12 text-center text-xs text-vault-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            Running diagnostics and scanning vault storage...
          </div>
        ) : diagnostics ? (
          <>
            {/* Status Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 bg-vault-50 dark:bg-vault-800/60 border border-vault-200 dark:border-vault-700 rounded-xl">
                <div className="flex items-center justify-between text-vault-400 mb-1">
                  <span className="text-xs font-semibold uppercase">Total Notes</span>
                  <Files className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-xl font-bold text-vault-900 dark:text-vault-100">{diagnostics.total_notes || 0}</div>
                <div className="text-[11px] text-vault-400 mt-0.5">Markdown nodes</div>
              </div>

              <div className="p-3.5 bg-vault-50 dark:bg-vault-800/60 border border-vault-200 dark:border-vault-700 rounded-xl">
                <div className="flex items-center justify-between text-vault-400 mb-1">
                  <span className="text-xs font-semibold uppercase">Vault Size</span>
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-bold text-vault-900 dark:text-vault-100">{formatBytes(diagnostics.total_size_bytes)}</div>
                <div className="text-[11px] text-vault-400 mt-0.5">{diagnostics.total_attachments || 0} attachments</div>
              </div>

              <div className="p-3.5 bg-vault-50 dark:bg-vault-800/60 border border-vault-200 dark:border-vault-700 rounded-xl">
                <div className="flex items-center justify-between text-vault-400 mb-1">
                  <span className="text-xs font-semibold uppercase">Broken Links</span>
                  <Link2Off className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-xl font-bold text-vault-900 dark:text-vault-100">{diagnostics.broken_links?.length || 0}</div>
                <div className="text-[11px] text-vault-400 mt-0.5">Unresolved references</div>
              </div>

              <div className="p-3.5 bg-vault-50 dark:bg-vault-800/60 border border-vault-200 dark:border-vault-700 rounded-xl">
                <div className="flex items-center justify-between text-vault-400 mb-1">
                  <span className="text-xs font-semibold uppercase">Orphaned Files</span>
                  <FileQuestion className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-xl font-bold text-vault-900 dark:text-vault-100">{diagnostics.orphaned_attachments?.length || 0}</div>
                <div className="text-[11px] text-vault-400 mt-0.5">Unreferenced files</div>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="p-3.5 bg-vault-50 dark:bg-vault-800/60 border border-vault-200 dark:border-vault-700 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-vault-900 dark:text-vault-100 block">Maintenance Operations</span>
                <span className="text-[11px] text-vault-400">
                  Re-index SQLite cache from disk files or purge unreferenced attachments.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRebuildIndex}
                  isLoading={isRebuilding}
                  icon={<Database className="w-3.5 h-3.5 text-indigo-500" />}
                >
                  Rebuild SQLite Index
                </Button>
                {diagnostics.orphaned_attachments && diagnostics.orphaned_attachments.length > 0 && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleCleanupOrphans}
                    isLoading={isCleaning}
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Clean Orphans ({diagnostics.orphaned_attachments.length})
                  </Button>
                )}
              </div>
            </div>

            {/* Broken Links Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-vault-900 dark:text-vault-100 uppercase tracking-wider flex items-center gap-1.5">
                <Link2Off className="w-4 h-4 text-amber-400" /> Broken Links ({diagnostics.broken_links?.length || 0})
              </h4>
              {!diagnostics.broken_links || diagnostics.broken_links.length === 0 ? (
                <div className="p-3 text-xs bg-vault-50 dark:bg-vault-800/40 rounded-lg border border-vault-200 dark:border-vault-700 text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> All wiki-links resolve cleanly to active vault notes.
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5 bg-vault-50 dark:bg-vault-800/40 p-3 rounded-lg border border-vault-200 dark:border-vault-700">
                  {diagnostics.broken_links.map((link: any, i: number) => (
                    <div
                      key={i}
                      className="text-xs flex items-center justify-between p-1.5 bg-white dark:bg-vault-900 rounded hover:bg-vault-100"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <button
                          type="button"
                          onClick={() => {
                            selectNote(link.source_id);
                            onClose();
                          }}
                          className="font-medium text-indigo-500 hover:underline truncate"
                        >
                          {link.source_title}
                        </button>
                        <span className="text-vault-400">→</span>
                        <span className="text-amber-400 font-mono">[[{link.target_title}]]</span>
                      </div>
                      <span className="text-[10px] text-vault-400 uppercase">Target Missing</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Orphaned Attachments Section */}
            {diagnostics.orphaned_attachments && diagnostics.orphaned_attachments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-vault-900 dark:text-vault-100 uppercase tracking-wider flex items-center gap-1.5">
                  <FileQuestion className="w-4 h-4 text-purple-400" /> Orphaned Attachments ({diagnostics.orphaned_attachments.length})
                </h4>
                <div className="max-h-36 overflow-y-auto space-y-1 bg-vault-50 dark:bg-vault-800/40 p-3 rounded-lg border border-vault-200 dark:border-vault-700 font-mono text-xs">
                  {diagnostics.orphaned_attachments.map((file: string, i: number) => (
                    <div key={i} className="text-vault-400 flex justify-between">
                      <span className="truncate">{file}</span>
                      <span className="text-[10px] text-red-400 uppercase">Unused</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}

        <div className="flex justify-end pt-2 border-t border-vault-200 dark:border-vault-800">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
