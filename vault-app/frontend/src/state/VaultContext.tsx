import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type {
  ActiveView,
  BacklinkItem,
  Note,
  NoteMetadata,
  NoteSummary,
  OutgoingLinkItem,
  SaveStatus,
  SystemDiagnostics,
  TreeNode,
  VaultInfo,
} from '../types';

export interface VaultContextType {
  // Navigation & Selection
  selectedNodeId: string | null;
  activeNoteId: string | null;
  activeNote: Note | null;
  treeNodes: TreeNode[];
  hierarchyTree: TreeNode[];
  notesSummary: NoteSummary[];
  notes: NoteSummary[];
  openTabs: string[];
  activeView: ActiveView;
  activeTab: 'editor' | 'preview' | 'graph' | 'table';
  saveStatus: SaveStatus;
  saveError: string | null;
  isLoading: boolean;
  isSaving: boolean;
  lastSavedTime: Date | null;
  vaultInfo: VaultInfo | null;

  // Panes
  isLeftPaneOpen: boolean;
  isRightPaneOpen: boolean;
  toggleLeftPane: () => void;
  toggleRightPane: () => void;

  // Inspector details
  backlinks: BacklinkItem[];
  outgoingLinks: OutgoingLinkItem[];
  systemHealth: SystemDiagnostics | null;

  // Modals
  searchModalOpen: boolean;
  setSearchModalOpen: (open: boolean) => void;
  exportModalOpen: boolean;
  setExportModalOpen: (open: boolean) => void;
  backupModalOpen: boolean;
  setBackupModalOpen: (open: boolean) => void;
  importModalOpen: boolean;
  setImportModalOpen: (open: boolean) => void;
  settingsModalOpen: boolean;
  setSettingsModalOpen: (open: boolean) => void;
  diagnosticsModalOpen: boolean;
  setDiagnosticsModalOpen: (open: boolean) => void;
  createNoteModalOpen: boolean;
  setCreateNoteModalOpen: (open: boolean) => void;

  // Actions
  selectNode: (id: string | null) => Promise<void>;
  selectNote: (id: string | null) => Promise<void>;
  openTab: (id: string) => void;
  closeTab: (id: string) => void;
  setActiveView: (view: ActiveView) => void;
  setActiveTab: (tab: 'editor' | 'preview' | 'graph' | 'table') => void;
  updateActiveNoteContent: (content: string) => void;
  updateActiveNoteMetadata: (meta: Partial<NoteMetadata>) => Promise<void>;
  saveCurrentNote: () => Promise<void>;
  saveActiveNote: () => Promise<void>;
  createNewNote: (
    title: string,
    parent_id?: string | null,
    content?: string,
    tags?: string[],
    note_type?: string
  ) => Promise<Note>;
  createNote: (data: {
    title: string;
    parent_id?: string | null;
    content?: string;
    tags?: string[];
    note_type?: string;
  }) => Promise<Note>;
  deleteCurrentNote: (id?: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  moveNote: (id: string, new_parent_id: string | null) => Promise<void>;
  refreshAllData: () => Promise<void>;
  refreshVault: () => Promise<void>;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [notesSummary, setNotesSummary] = useState<NoteSummary[]>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>('editor');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null);

  const [isLeftPaneOpen, setIsLeftPaneOpen] = useState(true);
  const [isRightPaneOpen, setIsRightPaneOpen] = useState(true);

  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([]);
  const [outgoingLinks, setOutgoingLinks] = useState<OutgoingLinkItem[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemDiagnostics | null>(null);

  // Modals
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [diagnosticsModalOpen, setDiagnosticsModalOpen] = useState(false);
  const [createNoteModalOpen, setCreateNoteModalOpen] = useState(false);

  // Debounced autosave timer
  const autosaveTimerRef = useRef<any>(null);
  const pendingContentRef = useRef<string | null>(null);

  const refreshTreeAndSummaries = async () => {
    try {
      const [tree, summaries, cfg] = await Promise.all([
        api.getHierarchyTree(),
        api.getNotesSummary(),
        api.getConfig().catch(() => ({ vault_path: '', config: {} })),
      ]);
      setTreeNodes(tree);
      setNotesSummary(summaries);
      setVaultInfo({
        name: cfg.config?.vault_name || 'Local Vault',
        vault_path: cfg.vault_path || '',
        note_count: summaries.length,
        attachment_count: 0,
      });
    } catch (e) {
      console.error('Error refreshing tree and summaries:', e);
    }
  };

  const refreshSystemHealth = async () => {
    try {
      const diag = await api.getDiagnostics();
      setSystemHealth(diag);
    } catch (e) {
      console.error('Error fetching diagnostics:', e);
    }
  };

  const refreshAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([refreshTreeAndSummaries(), refreshSystemHealth()]);
      if (selectedNodeId) {
        await loadNoteDetails(selectedNodeId);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadNoteDetails = async (id: string) => {
    try {
      const [note, bLinks, oLinks] = await Promise.all([
        api.getNote(id),
        api.getBacklinks(id),
        api.getOutgoingLinks(id),
      ]);
      setActiveNote(note);
      setBacklinks(bLinks);
      setOutgoingLinks(oLinks);
      setSaveStatus('saved');
      setSaveError(null);
    } catch (e: any) {
      console.error(`Error loading note ${id}:`, e);
      setSaveError(e.message);
    }
  };

  const selectNode = async (id: string | null) => {
    if (id === selectedNodeId) return;

    // If there's unsaved pending content, flush save before navigating
    if (pendingContentRef.current !== null && activeNote && selectedNodeId) {
      await saveCurrentNote();
    }

    setSelectedNodeId(id);
    if (id) {
      if (!openTabs.includes(id)) {
        setOpenTabs(prev => [...prev, id]);
      }
      await loadNoteDetails(id);
    } else {
      setActiveNote(null);
      setBacklinks([]);
      setOutgoingLinks([]);
    }
  };

  const openTab = (id: string) => {
    if (!openTabs.includes(id)) {
      setOpenTabs(prev => [...prev, id]);
    }
    selectNode(id);
  };

  const closeTab = (id: string) => {
    const nextTabs = openTabs.filter(t => t !== id);
    setOpenTabs(nextTabs);
    if (selectedNodeId === id) {
      if (nextTabs.length > 0) {
        selectNode(nextTabs[nextTabs.length - 1]);
      } else {
        selectNode(null);
      }
    }
  };

  const saveCurrentNote = async () => {
    if (!activeNote) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const contentToSave = pendingContentRef.current ?? activeNote.content;
    setSaveStatus('saving');

    try {
      const updated = await api.updateNote(activeNote.metadata.id, {
        content: contentToSave,
        expected_hash: activeNote.metadata.content_hash,
      });
      setActiveNote(updated);
      pendingContentRef.current = null;
      setSaveStatus('saved');
      setSaveError(null);
      setLastSavedTime(new Date());

      // Refresh inspector links
      const [bLinks, oLinks] = await Promise.all([
        api.getBacklinks(updated.metadata.id),
        api.getOutgoingLinks(updated.metadata.id),
      ]);
      setBacklinks(bLinks);
      setOutgoingLinks(oLinks);
    } catch (e: any) {
      console.error('Save failed:', e);
      if (e.message?.includes('Conflict')) {
        setSaveStatus('conflict');
      } else {
        setSaveStatus('error');
      }
      setSaveError(e.message);
    }
  };

  const updateActiveNoteContent = (newContent: string) => {
    if (!activeNote) return;
    pendingContentRef.current = newContent;
    setSaveStatus('unsaved');

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      saveCurrentNote();
    }, 2000);
  };

  const updateActiveNoteMetadata = async (metaUpdates: Partial<NoteMetadata>) => {
    if (!activeNote) return;
    setSaveStatus('saving');
    try {
      const updated = await api.updateNote(activeNote.metadata.id, {
        title: metaUpdates.title,
        tags: metaUpdates.tags,
        aliases: metaUpdates.aliases,
        note_type: metaUpdates.note_type,
        relations: metaUpdates.relations,
        custom_properties: metaUpdates.custom_properties,
        expected_hash: activeNote.metadata.content_hash,
      });
      setActiveNote(updated);
      setSaveStatus('saved');
      setLastSavedTime(new Date());
      await refreshTreeAndSummaries();
    } catch (e: any) {
      console.error('Metadata update failed:', e);
      setSaveStatus('error');
      setSaveError(e.message);
    }
  };

  const createNewNote = async (
    title: string,
    parent_id?: string | null,
    content: string = '',
    tags: string[] = [],
    note_type: string = 'standard'
  ) => {
    const note = await api.createNote({
      title,
      parent_id,
      content,
      tags,
      note_type,
    });
    await refreshTreeAndSummaries();
    await selectNode(note.metadata.id);
    return note;
  };

  const deleteCurrentNote = async (targetId?: string) => {
    const id = targetId || selectedNodeId;
    if (!id) return;
    await api.deleteNote(id);
    closeTab(id);
    await refreshTreeAndSummaries();
  };

  const moveNote = async (id: string, new_parent_id: string | null) => {
    await api.moveNote(id, new_parent_id);
    await refreshTreeAndSummaries();
    if (selectedNodeId === id) {
      await loadNoteDetails(id);
    }
  };

  // Initial load
  useEffect(() => {
    refreshAllData().then(() => {
      api.getNotesSummary().then(summaries => {
        if (summaries.length > 0 && !selectedNodeId) {
          selectNode(summaries[0].id);
        }
      });
    });
  }, []);

  return (
    <VaultContext.Provider
      value={{
        selectedNodeId,
        activeNoteId: selectedNodeId,
        activeNote,
        treeNodes,
        hierarchyTree: treeNodes,
        notesSummary,
        notes: notesSummary,
        openTabs,
        activeView,
        activeTab: activeView,
        saveStatus,
        saveError,
        isLoading,
        isSaving: saveStatus === 'saving',
        lastSavedTime,
        vaultInfo,
        isLeftPaneOpen,
        isRightPaneOpen,
        toggleLeftPane: () => setIsLeftPaneOpen(p => !p),
        toggleRightPane: () => setIsRightPaneOpen(p => !p),
        backlinks,
        outgoingLinks,
        systemHealth,
        searchModalOpen,
        setSearchModalOpen,
        exportModalOpen,
        setExportModalOpen,
        backupModalOpen,
        setBackupModalOpen,
        importModalOpen,
        setImportModalOpen,
        settingsModalOpen,
        setSettingsModalOpen,
        diagnosticsModalOpen,
        setDiagnosticsModalOpen,
        createNoteModalOpen,
        setCreateNoteModalOpen,
        selectNode,
        selectNote: selectNode,
        openTab,
        closeTab,
        setActiveView,
        setActiveTab: setActiveView,
        updateActiveNoteContent,
        updateActiveNoteMetadata,
        saveCurrentNote,
        saveActiveNote: saveCurrentNote,
        createNewNote,
        createNote: (data) =>
          createNewNote(
            data.title,
            data.parent_id,
            data.content,
            data.tags,
            data.note_type
          ),
        deleteCurrentNote,
        deleteNote: deleteCurrentNote,
        moveNote,
        refreshAllData,
        refreshVault: refreshAllData,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = () => {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be used within VaultProvider');
  return ctx;
};
