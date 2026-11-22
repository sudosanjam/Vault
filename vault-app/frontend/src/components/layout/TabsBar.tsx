import React from 'react';
import { FileText, Plus, X } from 'lucide-react';
import { useVault } from '../../state/VaultContext';

export const TabsBar: React.FC = () => {
  const { openTabs, selectedNodeId, selectNode, closeTab, notesSummary, setCreateNoteModalOpen } =
    useVault();

  if (openTabs.length === 0) return null;

  const getTitle = (id: string) => {
    const found = notesSummary.find(n => n.id === id);
    return found ? found.title : id;
  };

  return (
    <div className="h-9 bg-vault-100/50 dark:bg-vault-950/40 backdrop-blur-md border-b border-vault-200 dark:border-vault-800 flex items-center px-2 gap-1 overflow-x-auto select-none shrink-0 scrollbar-none">
      {openTabs.map(tabId => {
        const isActive = tabId === selectedNodeId;
        const title = getTitle(tabId);

        return (
          <div
            key={tabId}
            onClick={() => selectNode(tabId)}
            className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-all max-w-[190px] ${
              isActive
                ? 'bg-white dark:bg-vault-850 text-[var(--accent-primary)] shadow-xs ring-1 ring-black/5 dark:ring-white/10'
                : 'text-vault-500 hover:text-vault-900 dark:text-vault-400 dark:hover:text-vault-200 hover:bg-vault-200/50 dark:hover:bg-vault-800/40'
            }`}
          >
            <FileText size={13} className={isActive ? 'text-[var(--accent-primary)]' : 'text-vault-400'} />
            <span className="truncate flex-1">{title}</span>
            <button
              onClick={e => {
                e.stopPropagation();
                closeTab(tabId);
              }}
              className="opacity-0 group-hover:opacity-100 hover:bg-vault-200 dark:hover:bg-vault-700/80 rounded p-0.5 text-vault-400 hover:text-vault-700 dark:hover:text-vault-200 transition-all"
            >
              <X size={11} />
            </button>
          </div>
        );
      })}

      <button
        onClick={() => setCreateNoteModalOpen(true)}
        title="New Note Tab"
        className="text-vault-400 hover:text-vault-700 dark:hover:text-vault-200 p-1.5 rounded-lg hover:bg-vault-200/50 dark:hover:bg-vault-800 transition-colors ml-1"
      >
        <Plus size={13} />
      </button>
    </div>
  );
};
