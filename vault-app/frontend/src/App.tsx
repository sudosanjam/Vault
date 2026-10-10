import React, { useEffect } from 'react';
import { VaultProvider, useVault } from './state/VaultContext';
import { ThemeProvider } from './state/ThemeContext';
import { Header } from './components/layout/Header';
import { ExplorerPane } from './components/layout/ExplorerPane';
import { InspectorPane } from './components/layout/InspectorPane';
import { TabsBar } from './components/layout/TabsBar';
import { RichEditor } from './components/editor/RichEditor';
import { GraphView } from './components/graph/GraphView';
import { TableView } from './components/table/TableView';

// Modals
import { GlobalSearchModal } from './components/modals/GlobalSearchModal';
import { CreateNoteModal } from './components/modals/CreateNoteModal';
import { ExportModal } from './components/modals/ExportModal';
import { BackupModal } from './components/modals/BackupModal';
import { ImportModal } from './components/modals/ImportModal';
import { DiagnosticsModal } from './components/modals/DiagnosticsModal';
import { SettingsModal } from './components/modals/SettingsModal';

import {
  Plus,
  Search,
  CheckCircle2,
  HardDrive,
  Activity,
  Sparkles,
} from 'lucide-react';

const MainLayout: React.FC = () => {
  const {
    activeNote,
    activeNoteId,
    activeTab,
    setActiveTab,
    notes,
    saveActiveNote,
    isSaving,
    lastSavedTime,
    vaultInfo,
    isLeftPaneOpen,
    isRightPaneOpen,
    toggleLeftPane,
    toggleRightPane,
    searchModalOpen,
    setSearchModalOpen,
    createNoteModalOpen,
    setCreateNoteModalOpen,
    exportModalOpen,
    setExportModalOpen,
    backupModalOpen,
    setBackupModalOpen,
    importModalOpen,
    setImportModalOpen,
    diagnosticsModalOpen,
    setDiagnosticsModalOpen,
    settingsModalOpen,
    setSettingsModalOpen,
  } = useVault();

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen(!searchModalOpen);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setCreateNoteModalOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveActiveNote();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setExportModalOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setBackupModalOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        setActiveTab('editor');
      } else if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault();
        setActiveTab('graph');
      } else if ((e.ctrlKey || e.metaKey) && e.key === '3') {
        e.preventDefault();
        setActiveTab('table');
      } else if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        toggleLeftPane();
      } else if ((e.ctrlKey || e.metaKey) && e.key === ']') {
        e.preventDefault();
        toggleRightPane();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveActiveNote, setActiveTab, searchModalOpen, setSearchModalOpen, setCreateNoteModalOpen, setExportModalOpen, setBackupModalOpen, toggleLeftPane, toggleRightPane]);

  // Dynamic Browser Tab Title
  useEffect(() => {
    if (activeNote?.metadata?.title) {
      document.title = `${activeNote.metadata.title} — Vault`;
    } else {
      document.title = 'Vault — Personal Knowledge Graph';
    }
  }, [activeNote?.metadata?.title]);


  return (
    <div className="flex flex-col h-screen w-screen bg-white dark:bg-vault-950 text-vault-900 dark:text-vault-100 overflow-hidden select-none">
      {/* Top Application Header */}
      <Header />

      {/* Main 3-Pane Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Pane: Explorer & Hierarchy */}
        {isLeftPaneOpen && (
          <aside className="w-64 md:w-72 lg:w-80 flex-shrink-0 border-r border-vault-200 dark:border-vault-800 bg-vault-50/50 dark:bg-vault-900/50 flex flex-col z-10 transition-all duration-200">
            <ExplorerPane />
          </aside>
        )}

        {/* Center Pane: Workspace (Editor, Graph, or Table) */}
        <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-vault-900 relative overflow-hidden">
          {/* Note Tabs & Mode Navigation Bar */}
          <TabsBar />

          {/* Active Workspace View */}
          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'editor' && (
              <div className="h-full w-full overflow-hidden">
                {activeNote ? (
                  <RichEditor />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-vault-50/30 dark:bg-vault-950/30">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4 text-indigo-500 border border-indigo-500/20">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <h2 className="text-lg font-bold text-vault-900 dark:text-vault-100 mb-2">
                      Welcome to your Personal Knowledge Graph
                    </h2>
                    <p className="text-xs text-vault-500 max-w-md mb-6 leading-relaxed">
                      Select a note from the explorer, explore the interactive graph, or create a new node to start mapping ideas and relationships.
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setCreateNoteModalOpen(true)}
                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
                      >
                        <Plus className="w-4 h-4" /> Create New Note (Ctrl+N)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSearchModalOpen(true)}
                        className="px-4 py-2 rounded-lg bg-vault-100 dark:bg-vault-800 border border-vault-200 dark:border-vault-700 text-vault-900 dark:text-vault-100 font-semibold text-xs hover:bg-vault-200 dark:hover:bg-vault-700 transition-colors flex items-center gap-2"
                      >
                        <Search className="w-4 h-4" /> Quick Search (Ctrl+K)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'graph' && (
              <div className="h-full w-full">
                <GraphView />
              </div>
            )}

            {activeTab === 'table' && (
              <div className="h-full w-full">
                <TableView />
              </div>
            )}
          </div>
        </main>

        {/* Right Pane: Inspector & Graph Metadata */}
        {isRightPaneOpen && (
          <aside className="w-72 md:w-80 lg:w-96 flex-shrink-0 border-l border-vault-200 dark:border-vault-800 bg-vault-50/50 dark:bg-vault-900/50 flex flex-col z-10 transition-all duration-200">
            <InspectorPane />
          </aside>
        )}
      </div>

      {/* Bottom Global Status Bar */}
      <footer className="h-7 bg-vault-100/60 dark:bg-vault-950/80 border-t border-vault-200 dark:border-vault-800 px-4 flex items-center justify-between text-[11px] text-vault-500 select-none flex-shrink-0 z-20">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-vault-700 dark:text-vault-300 font-medium">
            <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
            <span>Vault:</span>
            <span className="font-mono text-vault-900 dark:text-vault-100">
              {vaultInfo?.name || 'Local Vault'}
            </span>
          </span>
          <span className="text-vault-300 dark:text-vault-700">|</span>
          <span>{notes.length} Notes</span>
          <span className="text-vault-300 dark:text-vault-700">|</span>
          <span className="flex items-center gap-1 text-emerald-500">
            <CheckCircle2 className="w-3 h-3" /> Local-First Plaintext
          </span>
        </div>

        <div className="flex items-center gap-4">
          {isSaving ? (
            <span className="text-indigo-500 animate-pulse flex items-center gap-1">
              Saving changes to disk...
            </span>
          ) : lastSavedTime ? (
            <span>Saved {lastSavedTime.toLocaleTimeString()}</span>
          ) : (
            <span>All changes saved locally</span>
          )}
          <span className="text-vault-300 dark:text-vault-700">|</span>
          <button
            type="button"
            onClick={() => setDiagnosticsModalOpen(true)}
            className="hover:text-indigo-500 transition-colors flex items-center gap-1"
          >
            <Activity className="w-3 h-3" /> Diagnostics
          </button>
        </div>
      </footer>

      {/* Global Modals */}
      <GlobalSearchModal isOpen={searchModalOpen} onClose={() => setSearchModalOpen(false)} />
      <CreateNoteModal
        isOpen={createNoteModalOpen}
        onClose={() => setCreateNoteModalOpen(false)}
        defaultParentId={activeNoteId}
      />
      <ExportModal isOpen={exportModalOpen} onClose={() => setExportModalOpen(false)} />
      <BackupModal isOpen={backupModalOpen} onClose={() => setBackupModalOpen(false)} />
      <ImportModal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} />
      <DiagnosticsModal isOpen={diagnosticsModalOpen} onClose={() => setDiagnosticsModalOpen(false)} />
      <SettingsModal isOpen={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <VaultProvider>
        <MainLayout />
      </VaultProvider>
    </ThemeProvider>
  );
}
