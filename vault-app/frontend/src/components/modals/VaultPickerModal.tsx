import React, { useEffect, useState } from 'react';
import {
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { api } from '../../api/client';
import { useVault } from '../../state/VaultContext';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';

interface VaultPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BrowseData {
  current_path: string;
  parent_path: string | null;
  is_current_vault: boolean;
  active_vault_path: string;
  folders: { name: string; path: string; is_vault: boolean }[];
  drives: string[];
}

export const VaultPickerModal: React.FC<VaultPickerModalProps> = ({ isOpen, onClose }) => {
  const { vaultInfo, refreshVault } = useVault();
  const [browseData, setBrowseData] = useState<BrowseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [copied, setCopied] = useState(false);

  // Mode: 'browse' | 'create' | 'direct'
  const [activeTab, setActiveTab] = useState<'browse' | 'create' | 'direct'>('browse');

  // Create new vault
  const [newVaultName, setNewVaultName] = useState('');
  // Direct input
  const [directPath, setDirectPath] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Recent vaults saved in localStorage
  const [recentVaults, setRecentVaults] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vault_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveToHistory = (path: string) => {
    try {
      const updated = Array.from(new Set([path, ...recentVaults])).slice(0, 5);
      setRecentVaults(updated);
      localStorage.setItem('vault_history', JSON.stringify(updated));
    } catch {}
  };

  const loadDirectory = async (path?: string) => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const data = await api.browseFolders(path);
      setBrowseData(data);
      setDirectPath(data.current_path);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to load directory.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDirectory(vaultInfo?.vault_path);
      if (vaultInfo?.vault_path) {
        saveToHistory(vaultInfo.vault_path);
      }
    }
  }, [isOpen, vaultInfo?.vault_path]);

  const handleCopyPath = () => {
    if (vaultInfo?.vault_path) {
      navigator.clipboard.writeText(vaultInfo.vault_path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSelectFolder = async (folderPath: string) => {
    setSwitching(true);
    setStatusMsg(null);
    try {
      await api.switchVault(folderPath);
      saveToHistory(folderPath);
      setStatusMsg({ type: 'success', text: `Switched vault to: ${folderPath}` });
      await refreshVault();
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to switch vault.' });
    } finally {
      setSwitching(false);
    }
  };

  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVaultName.trim() || !browseData) return;
    setSwitching(true);
    setStatusMsg(null);
    try {
      const res = await api.createVault(browseData.current_path, newVaultName.trim());
      saveToHistory(res.vault_path);
      setStatusMsg({ type: 'success', text: `Vault "${newVaultName.trim()}" created and active!` });
      setNewVaultName('');
      await refreshVault();
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to create vault.' });
    } finally {
      setSwitching(false);
    }
  };

  // Breadcrumbs calculation
  const pathParts = browseData?.current_path
    ? browseData.current_path.split(/[\\/]/).filter(Boolean)
    : [];

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Vault Location & Manager" maxWidth="lg">
      <div className="space-y-4">
        {/* Active Vault Location Card (Peek Banner) */}
        <div className="p-3 bg-gradient-to-r from-sky-950/40 via-vault-800/40 to-indigo-950/40 border border-sky-800/30 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-sky-400 shrink-0" />
              <div>
                <span className="text-xs font-semibold text-vault-200">Current Active Vault</span>
                <span className="ml-2 text-[10px] font-mono font-bold text-sky-300 bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800/50">
                  ONLINE
                </span>
              </div>
            </div>
            <button
              onClick={handleCopyPath}
              className="flex items-center gap-1 px-2 py-1 text-[11px] bg-vault-100 dark:bg-vault-800 hover:bg-vault-200 dark:hover:bg-vault-700/80 rounded border border-vault-200 dark:border-vault-700 text-vault-600 dark:text-vault-300 transition-colors"
              title="Copy full path"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy Path'}</span>
            </button>
          </div>
          <div className="mt-2 font-mono text-[11px] text-vault-300 dark:text-vault-300 bg-vault-950/70 p-2 rounded border border-vault-800/60 select-all break-all">
            {vaultInfo?.vault_path || 'Loading vault path...'}
          </div>
        </div>

        {/* Status notification */}
        {statusMsg && (
          <div
            className={`p-2.5 text-xs rounded-lg flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}
          >
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Tab selection */}
        <div className="flex items-center border-b border-vault-200 dark:border-vault-800 text-xs">
          <button
            onClick={() => setActiveTab('browse')}
            className={`flex items-center gap-1.5 px-3 py-2 font-medium border-b-2 transition-all ${
              activeTab === 'browse'
                ? 'border-sky-500 text-sky-400 font-semibold'
                : 'border-transparent text-vault-400 hover:text-vault-200'
            }`}
          >
            <Folder size={14} />
            <span>Select Existing Folder</span>
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-1.5 px-3 py-2 font-medium border-b-2 transition-all ${
              activeTab === 'create'
                ? 'border-sky-500 text-sky-400 font-semibold'
                : 'border-transparent text-vault-400 hover:text-vault-200'
            }`}
          >
            <FolderPlus size={14} />
            <span>Create New Vault</span>
          </button>
          <button
            onClick={() => setActiveTab('direct')}
            className={`flex items-center gap-1.5 px-3 py-2 font-medium border-b-2 transition-all ${
              activeTab === 'direct'
                ? 'border-sky-500 text-sky-400 font-semibold'
                : 'border-transparent text-vault-400 hover:text-vault-200'
            }`}
          >
            <ExternalLink size={14} />
            <span>Enter Exact Path</span>
          </button>
        </div>

        {/* TAB 1: BROWSE FOLDERS */}
        {activeTab === 'browse' && (
          <div className="space-y-3">
            {/* Windows Drives row if available */}
            {browseData?.drives && browseData.drives.length > 1 && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[10px] text-vault-400 uppercase font-semibold mr-1">Drives:</span>
                {browseData.drives.map(drive => (
                  <button
                    key={drive}
                    onClick={() => loadDirectory(drive)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-vault-100 dark:bg-vault-800 hover:bg-vault-200 dark:hover:bg-vault-700 border border-vault-200 dark:border-vault-700 text-[11px] font-mono text-vault-300"
                  >
                    <HardDrive size={11} className="text-vault-400" />
                    <span>{drive}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Breadcrumb Path Bar */}
            <div className="flex items-center gap-1 text-xs bg-vault-50 dark:bg-vault-900/80 p-2 rounded-lg border border-vault-200 dark:border-vault-800 overflow-x-auto">
              {browseData?.parent_path && (
                <button
                  onClick={() => loadDirectory(browseData.parent_path!)}
                  title="Go up one folder"
                  className="p-1 hover:bg-vault-200 dark:hover:bg-vault-700 rounded text-vault-400 hover:text-vault-100 transition-colors shrink-0 mr-1"
                >
                  <ArrowUp size={14} />
                </button>
              )}
              <span className="font-mono text-vault-500 text-[11px] shrink-0">Path:</span>
              <div className="flex items-center flex-wrap gap-1 font-mono text-[11px]">
                {pathParts.map((part, idx) => {
                  const partialPath = pathParts.slice(0, idx + 1).join('\\');
                  const isWindowsRoot = idx === 0 && part.endsWith(':');
                  const fullPartial = isWindowsRoot ? `${part}\\` : partialPath;
                  return (
                    <React.Fragment key={idx}>
                      <button
                        onClick={() => loadDirectory(fullPartial)}
                        className="hover:underline text-vault-300 hover:text-sky-400"
                      >
                        {part}
                      </button>
                      {idx < pathParts.length - 1 && <ChevronRight size={12} className="text-vault-600" />}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Current folder actions */}
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-[11px] text-vault-400">
                {browseData?.folders.length || 0} subfolders found
              </span>
              <Button
                variant="primary"
                size="sm"
                isLoading={switching}
                icon={<Check size={13} />}
                onClick={() => browseData?.current_path && handleSelectFolder(browseData.current_path)}
              >
                Use Current Folder as Vault
              </Button>
            </div>

            {/* Directory Browser List */}
            <div className="border border-vault-200 dark:border-vault-800 rounded-xl overflow-hidden bg-white dark:bg-vault-900/40 divide-y divide-vault-200 dark:divide-vault-800/60 max-h-56 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-vault-400 text-xs flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-sky-400" />
                  <span>Loading folders...</span>
                </div>
              ) : browseData?.folders.length === 0 ? (
                <div className="p-6 text-center text-vault-400 text-xs">
                  No subdirectories found in this folder.
                </div>
              ) : (
                browseData?.folders.map(f => (
                  <div
                    key={f.path}
                    className="flex items-center justify-between p-2.5 hover:bg-vault-100 dark:hover:bg-vault-800/60 transition-colors group"
                  >
                    <button
                      onClick={() => loadDirectory(f.path)}
                      className="flex items-center gap-2 flex-1 text-left truncate"
                    >
                      <Folder className={`w-4 h-4 shrink-0 ${f.is_vault ? 'text-emerald-400' : 'text-vault-400'}`} />
                      <span className="font-mono text-xs text-vault-800 dark:text-vault-200 truncate group-hover:text-sky-400">
                        {f.name}
                      </span>
                      {f.is_vault && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 uppercase tracking-wider shrink-0">
                          Vault
                        </span>
                      )}
                    </button>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSelectFolder(f.path)}
                        isLoading={switching}
                      >
                        Select
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Recent Vaults History */}
            {recentVaults.length > 0 && (
              <div className="pt-2">
                <span className="text-[10px] font-semibold text-vault-400 uppercase tracking-wider block mb-1.5">
                  Recent Vaults
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {recentVaults.map(rv => (
                    <button
                      key={rv}
                      onClick={() => handleSelectFolder(rv)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-vault-100 dark:bg-vault-800 border border-vault-200 dark:border-vault-700 text-vault-700 dark:text-vault-300 hover:border-sky-500 transition-colors"
                    >
                      <Folder size={12} className="text-sky-400" />
                      <span className="font-mono text-[11px] truncate max-w-[200px]">{rv.split(/[\\/]/).pop()}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CREATE NEW VAULT */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreateVault} className="space-y-4">
            <div className="p-3 bg-vault-50 dark:bg-vault-800/40 rounded-xl border border-vault-200 dark:border-vault-700 space-y-1">
              <span className="text-xs font-semibold text-vault-300 flex items-center gap-1.5">
                <Sparkles size={14} className="text-sky-400" /> Destination Location
              </span>
              <p className="font-mono text-[11px] text-vault-400 break-all">
                {browseData?.current_path || 'Loading...'}
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('browse')}
                className="text-[11px] text-sky-400 hover:underline pt-1 inline-block"
              >
                Change destination folder...
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-vault-400 uppercase tracking-wider">
                New Vault Name
              </label>
              <input
                type="text"
                placeholder="e.g. ResearchNotes or SecondBrain"
                value={newVaultName}
                onChange={e => setNewVaultName(e.target.value)}
                className="w-full bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg px-3 py-2 text-xs font-mono text-vault-900 dark:text-vault-100 placeholder:text-vault-500 focus:outline-none focus:border-sky-500"
                autoFocus
              />
              <p className="text-[11px] text-vault-400">
                A new folder will be created at this location, initialized with default metadata and an isolated SQLite cache.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={switching}
                disabled={!newVaultName.trim()}
                icon={<FolderPlus size={14} />}
              >
                Create & Switch to Vault
              </Button>
            </div>
          </form>
        )}

        {/* TAB 3: DIRECT EXACT PATH INPUT */}
        {activeTab === 'direct' && (
          <form
            onSubmit={e => {
              e.preventDefault();
              if (directPath.trim()) handleSelectFolder(directPath.trim());
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-vault-400 uppercase tracking-wider">
                Absolute Folder Path
              </label>
              <input
                type="text"
                value={directPath}
                onChange={e => setDirectPath(e.target.value)}
                placeholder="e.g. C:\Users\YourUser\Documents\MyNotes"
                className="w-full bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg px-3 py-2 text-xs font-mono text-vault-900 dark:text-vault-100 focus:outline-none focus:border-sky-500"
              />
              <p className="text-[11px] text-vault-400">
                Paste any local folder path. If the folder does not exist, it will be automatically initialized.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={switching}
                disabled={!directPath.trim()}
              >
                Switch Vault
              </Button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
};
