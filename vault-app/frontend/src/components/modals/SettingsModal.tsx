import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useTheme } from '../../state/ThemeContext';
import { useVault } from '../../state/VaultContext';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import {
  Palette,
  FolderOpen,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  RefreshCw,
  GitBranch,
  DownloadCloud,
  Check,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { theme, setTheme, availableThemes } = useTheme();
  const {
    settingsModalOpen,
    setSettingsModalOpen,
    vaultInfo,
    refreshVault,
  } = useVault();

  const isModalOpen = isOpen !== undefined ? isOpen : settingsModalOpen;
  const handleClose = onClose || (() => setSettingsModalOpen(false));

  const [vaultPathInput, setVaultPathInput] = useState('');
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Update checking state
  const [autoCheckUpdates, setAutoCheckUpdates] = useState<boolean>(true);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    update_available: boolean;
    current_commit: string;
    latest_commit: string;
    commit_message: string;
    commit_date: string;
    repo_url: string;
  } | null>(null);
  const [updateStatusMsg, setUpdateStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isModalOpen && vaultInfo) {
      setVaultPathInput(vaultInfo.vault_path);
      setError(null);
      setSuccessMsg(null);
      // Fetch current config for update setting
      api.getConfig().then(res => {
        if (res.config && typeof res.config.auto_check_updates === 'boolean') {
          setAutoCheckUpdates(res.config.auto_check_updates);
        }
      }).catch(() => {});
    }
  }, [isModalOpen, vaultInfo]);

  const handleToggleAutoUpdate = async (enabled: boolean) => {
    setAutoCheckUpdates(enabled);
    try {
      const current = await api.getConfig();
      const updatedConfig = { ...(current.config || {}), auto_check_updates: enabled };
      await api.updateConfig(updatedConfig);
      setSuccessMsg(`Automatic update check ${enabled ? 'enabled' : 'disabled'}.`);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleCheckUpdatesNow = async () => {
    try {
      setIsCheckingUpdates(true);
      setError(null);
      setUpdateStatusMsg(null);
      const res = await api.checkUpdates();
      setUpdateInfo(res);
      if (!res.update_available) {
        setUpdateStatusMsg('Vault is currently up to date! You are running the latest version.');
      }
    } catch (err: any) {
      setError('Failed to check for updates: ' + (err.message || 'Network error'));
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleApplyUpdate = async () => {
    try {
      setIsUpdating(true);
      setError(null);
      const res = await api.applyUpdate();
      if (res.status === 'success') {
        setUpdateStatusMsg(res.message);
        setUpdateInfo(prev => prev ? { ...prev, update_available: false } : null);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError('Update failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSwitchVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultPathInput.trim()) return;

    try {
      setIsSwitching(true);
      setError(null);
      await api.setVaultPath(vaultPathInput.trim());
      setSuccessMsg('Vault directory switched successfully. Reloading data...');
      await refreshVault();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to switch vault');
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <Dialog isOpen={isModalOpen} onClose={handleClose} title="Preferences & Settings" maxWidth="lg">
      <div className="space-y-6">
        {error && (
          <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. Theme Selection Palette */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-vault-400 uppercase tracking-wider flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-[var(--accent-primary)]" /> Appearance & Color Palette
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableThemes.map((t) => {
              const isCurrent = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={`p-3.5 rounded-2xl border text-left transition-all duration-200 relative group flex flex-col justify-between ${
                    isCurrent
                      ? 'border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)] bg-vault-800/80 shadow-md'
                      : 'border-vault-200 dark:border-vault-800 bg-vault-50/50 dark:bg-vault-850/50 hover:border-vault-400 dark:hover:border-vault-700'
                  }`}
                  style={{
                    backgroundColor: isCurrent ? `${t.baseCanvas}` : undefined,
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {/* 3-Color Swatch Circles */}
                        <div className="flex items-center -space-x-1">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-xs"
                            style={{ backgroundColor: t.baseCanvas }}
                            title={`Base Canvas: ${t.canvasName} (${t.baseCanvas})`}
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-xs"
                            style={{ backgroundColor: t.accentPrimary }}
                            title={`Accent Primary: ${t.accentPrimaryName} (${t.accentPrimary})`}
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-xs"
                            style={{ backgroundColor: t.accentSecondary }}
                            title={`Accent Secondary: ${t.accentSecondaryName} (${t.accentSecondary})`}
                          />
                        </div>
                        <span className="text-xs font-bold text-vault-900 dark:text-vault-100">
                          {t.name}
                        </span>
                      </div>
                      {isCurrent && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-muted)] text-[var(--accent-primary)]">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-vault-400 dark:text-vault-400 leading-snug">
                      {t.atmosphere}
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-vault-500 font-mono">
                    {t.tagline}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. GitHub Software Updates Section */}
        <div className="space-y-3 pt-4 border-t border-vault-200 dark:border-vault-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-vault-400 uppercase tracking-wider flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-sky-400" /> Software Updates & GitHub
            </label>
            <div className="flex items-center gap-2">
              <label htmlFor="auto-updates" className="text-xs text-vault-600 dark:text-vault-400 cursor-pointer">
                Automatic update checking
              </label>
              <input
                id="auto-updates"
                type="checkbox"
                checked={autoCheckUpdates}
                onChange={(e) => handleToggleAutoUpdate(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--accent-primary)] cursor-pointer"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-vault-50 dark:bg-vault-850/70 border border-vault-200 dark:border-vault-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-vault-900 dark:text-vault-100 flex items-center gap-2">
                  <span>Vault Release Channel</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 font-mono">
                    github.com/sudosanjam/Vault
                  </span>
                </div>
                <p className="text-[11px] text-vault-400 mt-0.5">
                  Check GitHub for new commits, features, and performance patches.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw size={13} className={isCheckingUpdates ? 'animate-spin' : ''} />}
                onClick={handleCheckUpdatesNow}
                disabled={isCheckingUpdates || isUpdating}
              >
                {isCheckingUpdates ? 'Checking...' : 'Check Now'}
              </Button>
            </div>

            {/* Update details alert */}
            {updateInfo?.update_available && (
              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/25 text-xs text-sky-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-semibold text-sky-400 flex items-center gap-1.5">
                    <DownloadCloud size={14} /> New Version Available!
                  </div>
                  <div className="text-[11px] text-sky-200/80">
                    Latest commit: <span className="font-mono font-bold">{updateInfo.latest_commit}</span> — {updateInfo.commit_message}
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={isUpdating}
                  onClick={handleApplyUpdate}
                >
                  Update Vault
                </Button>
              </div>
            )}

            {updateStatusMsg && (
              <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                <Check size={14} />
                <span>{updateStatusMsg}</span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Active Vault Path Switcher */}
        <div className="space-y-3 pt-4 border-t border-vault-200 dark:border-vault-800">
          <label className="text-xs font-semibold text-vault-400 uppercase tracking-wider flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-emerald-400" /> Active Vault Directory
          </label>
          <form onSubmit={handleSwitchVault} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={vaultPathInput}
                onChange={(e) => setVaultPathInput(e.target.value)}
                placeholder="Absolute path to vault directory"
                className="flex-1 bg-vault-50 dark:bg-vault-850/80 border border-vault-200 dark:border-vault-700/80 rounded-xl px-3 py-2 text-xs font-mono text-vault-900 dark:text-vault-100 placeholder:text-vault-400 focus:outline-none focus:border-[var(--accent-primary)]"
              />
              <Button variant="primary" type="submit" isLoading={isSwitching} size="sm">
                Switch
              </Button>
            </div>
            <p className="text-[11px] text-vault-400">
              Point Vault to any folder containing markdown notes. Attachments and images are automatically linked for direct exploration.
            </p>
          </form>
        </div>

        {/* 4. Architecture and System Mode */}
        <div className="space-y-3 pt-4 border-t border-vault-200 dark:border-vault-800">
          <label className="text-xs font-semibold text-vault-400 uppercase tracking-wider flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5 text-purple-400" /> Architecture & Capabilities
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs bg-vault-50 dark:bg-vault-850/60 p-3.5 rounded-2xl border border-vault-200 dark:border-vault-800">
            <div>
              <span className="text-vault-400 block text-[10px] uppercase">Storage Mode:</span>
              <span className="font-semibold text-vault-900 dark:text-vault-100">Local-First Plaintext Markdown</span>
            </div>
            <div>
              <span className="text-vault-400 block text-[10px] uppercase">Index Engine:</span>
              <span className="font-semibold text-vault-900 dark:text-vault-100">SQLite 3 (WAL + FTS5 Full-Text)</span>
            </div>
            <div>
              <span className="text-vault-400 block text-[10px] uppercase">Executable Suite:</span>
              <span className="font-semibold text-emerald-400">setup.exe • vault.exe • update.exe</span>
            </div>
            <div>
              <span className="text-vault-400 block text-[10px] uppercase">Network Mode:</span>
              <span className="font-semibold text-emerald-400">Zero Cloud / Loopback Only</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-vault-200 dark:border-vault-800">
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
