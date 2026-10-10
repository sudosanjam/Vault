import React from 'react';
import {
  Archive,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  HelpCircle,
  Moon,
  Network,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  SidebarClose,
  SidebarOpen,
  Sun,
  Table,
} from 'lucide-react';
import { useTheme } from '../../state/ThemeContext';
import { useVault } from '../../state/VaultContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const {
    activeView,
    setActiveView,
    saveStatus,
    saveError,
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
  } = useVault();

  return (
    <header className="h-14 bg-white dark:bg-vault-900 border-b border-vault-200 dark:border-vault-800 flex items-center justify-between px-4 select-none shrink-0 z-20">
      {/* Left section: Logo & Pane toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleLeftPane}
          title={isLeftPaneOpen ? 'Collapse Explorer' : 'Expand Explorer'}
          className="text-vault-500 hover:text-vault-800 dark:text-vault-400 dark:hover:text-vault-100 p-1.5 rounded-lg hover:bg-vault-100 dark:hover:bg-vault-800 transition-colors"
        >
          {isLeftPaneOpen ? <SidebarClose size={18} /> : <SidebarOpen size={18} />}
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20">
            <Shield size={18} className="stroke-[2.5]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-base tracking-tight text-vault-900 dark:text-vault-50">
              Vault
            </span>
            <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-1.5 py-0.2 rounded uppercase tracking-wider">
              Local
            </span>
          </div>
        </div>

        {/* Global Search Bar Trigger */}
        <button
          onClick={() => setSearchModalOpen(true)}
          className="ml-3 flex items-center gap-2 px-3 py-1.5 text-xs text-vault-400 dark:text-vault-400 bg-vault-100 dark:bg-vault-800 hover:bg-vault-200 dark:hover:bg-vault-700/80 border border-vault-200 dark:border-vault-700 rounded-lg transition-all w-52 justify-between"
        >
          <span className="flex items-center gap-1.5">
            <Search size={14} />
            <span>Search Vault...</span>
          </span>
          <kbd className="font-mono text-[10px] bg-white dark:bg-vault-900 px-1.5 py-0.5 rounded border border-vault-200 dark:border-vault-700 text-vault-500">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Center section: View Switcher */}
      <div className="flex items-center p-0.5 bg-vault-100 dark:bg-vault-800/80 border border-vault-200 dark:border-vault-700 rounded-lg">
        <button
          onClick={() => setActiveView('editor')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
            activeView === 'editor'
              ? 'bg-white dark:bg-vault-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-vault-600 dark:text-vault-400 hover:text-vault-900 dark:hover:text-vault-200'
          }`}
        >
          <FileText size={14} />
          <span>Editor</span>
        </button>
        <button
          onClick={() => setActiveView('preview')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
            activeView === 'preview'
              ? 'bg-white dark:bg-vault-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-vault-600 dark:text-vault-400 hover:text-vault-900 dark:hover:text-vault-200'
          }`}
        >
          <Eye size={14} />
          <span>Preview</span>
        </button>
        <button
          onClick={() => setActiveView('graph')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
            activeView === 'graph'
              ? 'bg-white dark:bg-vault-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-vault-600 dark:text-vault-400 hover:text-vault-900 dark:hover:text-vault-200'
          }`}
        >
          <Network size={14} />
          <span>Graph</span>
        </button>
        <button
          onClick={() => setActiveView('table')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
            activeView === 'table'
              ? 'bg-white dark:bg-vault-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-vault-600 dark:text-vault-400 hover:text-vault-900 dark:hover:text-vault-200'
          }`}
        >
          <Table size={14} />
          <span>Table</span>
        </button>
      </div>

      {/* Right section: Save Status, Actions, Tools, Settings, Theme */}
      <div className="flex items-center gap-2">
        {/* Save Status Indicator */}
        <div className="mr-2">
          {saveStatus === 'saved' && (
            <Badge variant="success" size="sm">
              <CheckCircle2 size={12} />
              <span>Saved</span>
            </Badge>
          )}
          {saveStatus === 'saving' && (
            <Badge variant="primary" size="sm">
              <RefreshCw size={12} className="animate-spin" />
              <span>Saving...</span>
            </Badge>
          )}
          {saveStatus === 'unsaved' && (
            <Badge variant="warning" size="sm">
              <span>Unsaved</span>
            </Badge>
          )}
          {saveStatus === 'conflict' && (
            <Badge variant="danger" size="sm" title={saveError || 'Conflict detected'}>
              <span>Conflict</span>
            </Badge>
          )}
          {saveStatus === 'error' && (
            <Badge variant="danger" size="sm" title={saveError || 'Save failed'}>
              <span>Error</span>
            </Badge>
          )}
        </div>

        {/* Primary New Note Action */}
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={14} />}
          onClick={() => setCreateNoteModalOpen(true)}
        >
          New Note
        </Button>

        {/* Export Modal Trigger */}
        <Button
          variant="secondary"
          size="sm"
          icon={<Download size={14} />}
          onClick={() => setExportModalOpen(true)}
        >
          Export
        </Button>

        {/* Backups Modal Trigger */}
        <Button
          variant="secondary"
          size="sm"
          icon={<Archive size={14} />}
          onClick={() => setBackupModalOpen(true)}
        >
          Backups
        </Button>

        {/* Health Diagnostics Trigger */}
        <button
          onClick={() => setDiagnosticsModalOpen(true)}
          title="System Health & Diagnostics"
          className="text-vault-500 hover:text-vault-800 dark:text-vault-400 dark:hover:text-vault-100 p-1.5 rounded-lg hover:bg-vault-100 dark:hover:bg-vault-800 transition-colors"
        >
          <HelpCircle size={18} />
        </button>

        {/* Settings */}
        <button
          onClick={() => setSettingsModalOpen(true)}
          title="Vault Settings"
          className="text-vault-500 hover:text-vault-800 dark:text-vault-400 dark:hover:text-vault-100 p-1.5 rounded-lg hover:bg-vault-100 dark:hover:bg-vault-800 transition-colors"
        >
          <Settings size={18} />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          className="text-vault-500 hover:text-vault-800 dark:text-vault-400 dark:hover:text-vault-100 p-1.5 rounded-lg hover:bg-vault-100 dark:hover:bg-vault-800 transition-colors"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Right Pane Toggle */}
        <button
          onClick={toggleRightPane}
          title={isRightPaneOpen ? 'Collapse Inspector' : 'Expand Inspector'}
          className="text-vault-500 hover:text-vault-800 dark:text-vault-400 dark:hover:text-vault-100 p-1.5 rounded-lg hover:bg-vault-100 dark:hover:bg-vault-800 transition-colors ml-1"
        >
          {isRightPaneOpen ? <SidebarClose size={18} className="rotate-180" /> : <SidebarOpen size={18} className="rotate-180" />}
        </button>
      </div>
    </header>
  );
};
