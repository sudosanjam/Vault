import React, { useEffect, useRef, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  HelpCircle,
  Network,
  Plus,
  RefreshCw,
  Search,
  Settings,
  SidebarClose,
  SidebarOpen,
  SlidersHorizontal,
  Table,
  Wifi,
} from 'lucide-react';
import { useVault } from '../../state/VaultContext';
import { api } from '../../api/client';
import { Button } from '../ui/Button';

export const Header: React.FC = () => {
  const {
    activeView,
    setActiveView,
    saveStatus,
    saveError,
    vaultInfo,
    refreshVault,
    isLeftPaneOpen,
    isRightPaneOpen,
    toggleLeftPane,
    toggleRightPane,
    setSearchModalOpen,
    setExportModalOpen,
    setBackupModalOpen,
    setSettingsModalOpen,
    setDiagnosticsModalOpen,
    setCreateNoteModalOpen,
    setVaultPickerModalOpen,
    setSyncModalOpen,
  } = useVault();

  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [latestCommit, setLatestCommit] = useState<string>('');

  const toolsMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setToolsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check for GitHub updates on load if enabled
  useEffect(() => {
    let isMounted = true;
    api.checkUpdates().then(info => {
      if (isMounted && info.auto_check_updates && info.update_available) {
        setUpdateAvailable(true);
        setLatestCommit(info.latest_commit);
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const vaultFolderName = vaultInfo?.vault_path
    ? vaultInfo.vault_path.split(/[\\/]/).filter(Boolean).pop() || 'Vault'
    : 'Vault';

  return (
    <header className="h-14 bg-white/80 dark:bg-vault-900/80 backdrop-blur-xl border-b border-vault-200 dark:border-vault-800 flex items-center justify-between px-4 select-none shrink-0 z-30 transition-colors">
      {/* Left: Window / Sidebar Toggle + Brand + Vault Peek */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleLeftPane}
          title={isLeftPaneOpen ? 'Collapse Explorer (Ctrl+\\)' : 'Expand Explorer (Ctrl+\\)'}
          className="text-vault-500 hover:text-vault-900 dark:text-vault-400 dark:hover:text-vault-100 p-1.5 rounded-lg hover:bg-vault-100 dark:hover:bg-vault-800/70 transition-colors"
        >
          {isLeftPaneOpen ? <SidebarClose size={17} /> : <SidebarOpen size={17} />}
        </button>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setIsRefreshing(true);
              refreshVault().finally(() => {
                setTimeout(() => setIsRefreshing(false), 500);
              });
            }}
            className="flex items-center gap-2 cursor-pointer group focus:outline-none"
            title="Vault - Click to refresh vault"
          >
            <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center shadow-xs transition-transform group-hover:scale-105 active:scale-95">
              <img
                src="/logo.png"
                alt="Vault"
                style={{ imageRendering: 'pixelated' }}
                className={`w-6 h-6 object-contain transition-transform duration-500 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </div>
            <span className="font-extrabold text-sm tracking-tight text-vault-900 dark:text-vault-50">
              Vault
            </span>
          </button>

          {/* Clean Apple-style Vault Folder Button */}
          <button
            onClick={() => setVaultPickerModalOpen(true)}
            className="group flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-vault-100/80 hover:bg-vault-200 dark:bg-vault-800/80 dark:hover:bg-vault-700/80 border border-vault-200 dark:border-vault-700/60 text-vault-700 dark:text-vault-300 transition-all text-xs"
            title={`Active Vault:\n${vaultInfo?.vault_path || 'Loading...'}\n\nClick to switch or create vaults.`}
          >
            <Folder className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="font-medium text-[11px] max-w-[120px] truncate text-vault-800 dark:text-vault-200">
              {vaultFolderName}
            </span>
            <ChevronDown className="w-3 h-3 text-vault-400 group-hover:text-vault-200 shrink-0" />
          </button>
        </div>

        {/* Search Bar Pill */}
        <button
          onClick={() => setSearchModalOpen(true)}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs text-vault-400 dark:text-vault-400 bg-vault-100/70 dark:bg-vault-800/50 hover:bg-vault-200 dark:hover:bg-vault-700/70 border border-vault-200 dark:border-vault-700/60 rounded-full transition-all w-44 justify-between"
        >
          <span className="flex items-center gap-1.5">
            <Search size={13} />
            <span className="text-[11px]">Search notes...</span>
          </span>
          <kbd className="font-mono text-[9px] bg-white dark:bg-vault-900 px-1.5 py-0.5 rounded border border-vault-200 dark:border-vault-700 text-vault-500">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Center: Apple macOS Segmented Pill Control */}
      <div className="flex items-center p-1 bg-vault-100/80 dark:bg-vault-800/60 border border-vault-200 dark:border-vault-700/60 rounded-xl shadow-xs">
        <button
          onClick={() => setActiveView('editor')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-150 ${
            activeView === 'editor'
              ? 'bg-white dark:bg-vault-900 text-[var(--accent-primary)] shadow-sm'
              : 'text-vault-500 dark:text-vault-400 hover:text-vault-900 dark:hover:text-vault-200'
          }`}
        >
          <FileText size={13} />
          <span>Editor</span>
        </button>
        <button
          onClick={() => setActiveView('preview')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-150 ${
            activeView === 'preview'
              ? 'bg-white dark:bg-vault-900 text-[var(--accent-primary)] shadow-sm'
              : 'text-vault-500 dark:text-vault-400 hover:text-vault-900 dark:hover:text-vault-200'
          }`}
        >
          <Eye size={13} />
          <span>Preview</span>
        </button>
        <button
          onClick={() => setActiveView('graph')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-150 ${
            activeView === 'graph'
              ? 'bg-white dark:bg-vault-900 text-[var(--accent-primary)] shadow-sm'
              : 'text-vault-500 dark:text-vault-400 hover:text-vault-900 dark:hover:text-vault-200'
          }`}
        >
          <Network size={13} />
          <span>Graph</span>
        </button>
        <button
          onClick={() => setActiveView('table')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-150 ${
            activeView === 'table'
              ? 'bg-white dark:bg-vault-900 text-[var(--accent-primary)] shadow-sm'
              : 'text-vault-500 dark:text-vault-400 hover:text-vault-900 dark:hover:text-vault-200'
          }`}
        >
          <Table size={13} />
          <span>Table</span>
        </button>
      </div>

      {/* Right: GitHub Update Pill + Theme Swatch Pill + Save Status + Actions */}
      <div className="flex items-center gap-2">
        {/* GitHub Update Notification Pill */}
        {updateAvailable && (
          <button
            onClick={() => setSettingsModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400 text-xs font-semibold hover:bg-sky-500/25 transition-all shadow-xs"
            title={`New GitHub version ready (${latestCommit}). Click to view or update.`}
          >
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span>Update Available</span>
          </button>
        )}

        {/* Save Status Badge */}
        <div className="hidden md:flex items-center">
          {saveStatus === 'saved' && (
            <span className="text-[11px] text-emerald-400/90 flex items-center gap-1">
              <CheckCircle2 size={12} />
              <span>Saved</span>
            </span>
          )}
          {saveStatus === 'saving' && (
            <span className="text-[11px] text-[var(--accent-primary)] flex items-center gap-1 animate-pulse">
              <RefreshCw size={11} className="animate-spin" />
              <span>Saving...</span>
            </span>
          )}
          {saveStatus === 'unsaved' && (
            <span className="text-[11px] text-amber-400">Unsaved</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-[11px] text-red-400" title={saveError || 'Save failed'}>
              Error
            </span>
          )}
        </div>

        {/* Mobile & LAN Sync Button */}
        <button
          type="button"
          onClick={() => setSyncModalOpen(true)}
          title="Sync notes with Android / PC over local Wi-Fi"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-vault-200 dark:border-vault-700/80 bg-vault-50/80 dark:bg-vault-800/60 hover:bg-vault-100 dark:hover:bg-vault-700/70 text-vault-700 dark:text-vault-200 hover:border-teal-500/50 hover:text-teal-400 dark:hover:text-teal-300 transition-all shadow-2xs"
        >
          <Wifi size={13} className="text-teal-400" />
          <span className="hidden sm:inline">Sync</span>
        </button>

        {/* Primary New Note Action */}
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={13} />}
          onClick={() => setCreateNoteModalOpen(true)}
          className="rounded-full shadow-xs"
        >
          New Note
        </Button>

        {/* Tools Sub-Menu */}
        <div className="relative" ref={toolsMenuRef}>
          <button
            onClick={() => setToolsMenuOpen(!toolsMenuOpen)}
            className="p-2 rounded-full text-vault-500 hover:text-vault-900 dark:text-vault-400 dark:hover:text-vault-100 hover:bg-vault-100 dark:hover:bg-vault-800/70 transition-colors"
            title="Tools & System"
          >
            <SlidersHorizontal size={15} />
          </button>

          {toolsMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white/95 dark:bg-vault-900/95 backdrop-blur-2xl border border-vault-200 dark:border-vault-800 rounded-2xl shadow-2xl p-1.5 z-50 text-xs">
              <button
                onClick={() => {
                  setToolsMenuOpen(false);
                  setExportModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-vault-100 dark:hover:bg-vault-800 text-vault-700 dark:text-vault-200 transition-colors text-left"
              >
                <Download size={14} className="text-indigo-400" />
                <div>
                  <div className="font-semibold">Export Notes</div>
                  <div className="text-[10px] text-vault-400">PDF, Markdown, HTML, JSON</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setToolsMenuOpen(false);
                  setBackupModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-vault-100 dark:hover:bg-vault-800 text-vault-700 dark:text-vault-200 transition-colors text-left"
              >
                <Archive size={14} className="text-amber-400" />
                <div>
                  <div className="font-semibold">Vault Backups</div>
                  <div className="text-[10px] text-vault-400">Snapshots & ZIP restore</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setToolsMenuOpen(false);
                  setVaultPickerModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-vault-100 dark:hover:bg-vault-800 text-vault-700 dark:text-vault-200 transition-colors text-left"
              >
                <FolderOpen size={14} className="text-sky-400" />
                <div>
                  <div className="font-semibold">Switch Vault</div>
                  <div className="text-[10px] text-vault-400">Explore & manage locations</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setToolsMenuOpen(false);
                  setSyncModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-vault-100 dark:hover:bg-vault-800 text-vault-700 dark:text-vault-200 transition-colors text-left"
              >
                <Wifi size={14} className="text-teal-400" />
                <div>
                  <div className="font-semibold">Mobile & LAN Sync</div>
                  <div className="text-[10px] text-vault-400">Sync with Phone or PC over Wi-Fi</div>
                </div>
              </button>
              <div className="border-t border-vault-200 dark:border-vault-800 my-1" />
              <button
                onClick={() => {
                  setToolsMenuOpen(false);
                  setDiagnosticsModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-vault-100 dark:hover:bg-vault-800 text-vault-700 dark:text-vault-200 transition-colors text-left"
              >
                <HelpCircle size={14} className="text-purple-400" />
                <span>Health & Diagnostics</span>
              </button>
              <button
                onClick={() => {
                  setToolsMenuOpen(false);
                  setSettingsModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-vault-100 dark:hover:bg-vault-800 text-vault-700 dark:text-vault-200 transition-colors text-left"
              >
                <Settings size={14} className="text-vault-400" />
                <span>System Preferences</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Inspector Toggle */}
        <button
          onClick={toggleRightPane}
          title={isRightPaneOpen ? 'Collapse Inspector (Ctrl+]' : 'Expand Inspector (Ctrl+]'}
          className="p-1.5 rounded-lg text-vault-500 hover:text-vault-900 dark:text-vault-400 dark:hover:text-vault-100 hover:bg-vault-100 dark:hover:bg-vault-800/70 transition-colors"
        >
          {isRightPaneOpen ? (
            <SidebarClose size={17} className="rotate-180" />
          ) : (
            <SidebarOpen size={17} className="rotate-180" />
          )}
        </button>
      </div>
    </header>
  );
};
