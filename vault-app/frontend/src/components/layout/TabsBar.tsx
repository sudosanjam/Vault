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
    <div className="h-9 bg-vault-100/70 dark:bg-vault-950/60 border-b border-vault-200 dark:border-vault-800 flex items-center px-2 gap-1 overflow-x-auto select-none shrink-0 scrollbar-none">
      {openTabs.map(tabId => {
        const isActive = tabId === selectedNodeId;
        const title = getTitle(tabId);

        return (
          <div
            key={tabId}
            onClick={() => selectNode(tabId)}
            className={`group flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-t-lg border-t-2 cursor-pointer transition-all max-w-[180px] ${
              isActive
                ? 'bg-white dark:bg-vault-900 border-brand-500 text-vault-900 dark:text-vault-100 shadow-sm'
                : 'border-transparent text-vault-500 hover:text-vault-800 dark:text-vault-400 dark:hover:text-vault-200 hover:bg-vault-200/50 dark:hover:bg-vault-800/40'
            }`}
          >
            <FileText size={13} className={isActive ? 'text-brand-500' : 'text-vault-400'} />
            <span className="truncate flex-1">{title}</span>
            <button
              onClick={e => {
                e.stopPropagation();
                closeTab(tabId);
              }}
              className="opacity-0 group-hover:opacity-100 hover:bg-vault-200 dark:hover:bg-vault-800 rounded p-0.5 text-vault-400 hover:text-vault-700 transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}

      <button
        onClick={() => setCreateNoteModalOpen(true)}
        title="New Note Tab"
        className="text-vault-400 hover:text-vault-700 dark:hover:text-vault-200 p-1 rounded hover:bg-vault-200 dark:hover:bg-vault-800 ml-1 transition-colors"
      >
        <Plus size={14} />
      </button>
    </div>
  );
};
