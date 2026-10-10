import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useTheme } from '../../state/ThemeContext';
import { useVault } from '../../state/VaultContext';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import {
  Moon,
  Sun,
  Palette,
  FolderOpen,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Monitor,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { theme, setTheme } = useTheme();
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

  useEffect(() => {
    if (isModalOpen && vaultInfo) {
      setVaultPathInput(vaultInfo.vault_path);
      setError(null);
      setSuccessMsg(null);
    }
  }, [isModalOpen, vaultInfo]);

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
    <Dialog isOpen={isModalOpen} onClose={handleClose} title="Preferences & System Settings" maxWidth="lg">
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

        {/* Theme Section */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-vault-400 uppercase tracking-wider flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-indigo-500" /> Appearance & Theme
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { id: 'dark', label: 'Dark Obsidian', icon: <Moon className="w-4 h-4 text-indigo-400" /> },
              { id: 'light', label: 'Clean Light', icon: <Sun className="w-4 h-4 text-amber-400" /> },
              { id: 'cyberpunk', label: 'Neon Cyber', icon: <Cpu className="w-4 h-4 text-cyan-400" /> },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id as any)}
                className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all text-left ${
                  theme === t.id
                    ? 'border-indigo-500 bg-indigo-500/10 text-vault-900 dark:text-vault-50 shadow-sm ring-1 ring-indigo-500'
                    : 'border-vault-200 dark:border-vault-800 bg-vault-50 dark:bg-vault-800/50 text-vault-600 dark:text-vault-400 hover:border-vault-300'
                }`}
              >
                {t.icon}
                <span className="text-xs font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Vault Directory Switcher */}
        <div className="space-y-3 pt-2 border-t border-vault-200 dark:border-vault-800">
          <label className="text-xs font-semibold text-vault-400 uppercase tracking-wider flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-emerald-400" /> Active Vault Path
          </label>
          <form onSubmit={handleSwitchVault} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={vaultPathInput}
                onChange={(e) => setVaultPathInput(e.target.value)}
                placeholder="Absolute path to vault directory"
                className="flex-1 bg-vault-50 dark:bg-vault-800/60 border border-vault-200 dark:border-vault-700 rounded-lg px-3 py-2 text-xs font-mono text-vault-900 dark:text-vault-100 placeholder:text-vault-400 focus:outline-none focus:border-indigo-500"
              />
              <Button variant="primary" type="submit" isLoading={isSwitching} size="sm">
                Switch
              </Button>
            </div>
            <p className="text-[11px] text-vault-400">
              Point Vault to any folder containing or intended for markdown notes. SQLite cache is stored in <code className="text-indigo-500">.vault-cache/</code>.
            </p>
          </form>
        </div>

        {/* System & Architecture Info */}
        <div className="space-y-3 pt-2 border-t border-vault-200 dark:border-vault-800">
          <label className="text-xs font-semibold text-vault-400 uppercase tracking-wider flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5 text-purple-400" /> Architecture & Capabilities
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs bg-vault-50 dark:bg-vault-800/50 p-3 rounded-xl border border-vault-200 dark:border-vault-700">
            <div>
              <span className="text-vault-400 block text-[10px] uppercase">Storage Mode:</span>
              <span className="font-semibold text-vault-900 dark:text-vault-100">Local-First Plaintext Markdown</span>
            </div>
            <div>
              <span className="text-vault-400 block text-[10px] uppercase">Index Engine:</span>
              <span className="font-semibold text-vault-900 dark:text-vault-100">SQLite 3 (WAL + FTS5 Full-Text)</span>
            </div>
            <div>
              <span className="text-vault-400 block text-[10px] uppercase">PDF Engine:</span>
              <span className="font-semibold text-vault-900 dark:text-vault-100">Headless Chromium (Playwright)</span>
            </div>
            <div>
              <span className="text-vault-400 block text-[10px] uppercase">Network Mode:</span>
              <span className="font-semibold text-emerald-400">Zero Cloud / Loopback Only</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-vault-200 dark:border-vault-800">
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
