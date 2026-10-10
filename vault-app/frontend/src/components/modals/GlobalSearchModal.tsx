import React, { useEffect, useState } from 'react';
import { FileText, Search } from 'lucide-react';
import { api } from '../../api/client';
import { useVault } from '../../state/VaultContext';
import { Badge } from '../ui/Badge';
import { Dialog } from '../ui/Dialog';

interface GlobalSearchModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const { searchModalOpen, setSearchModalOpen, selectNode } = useVault();
  const isModalOpen = isOpen !== undefined ? isOpen : searchModalOpen;
  const handleClose = onClose || (() => setSearchModalOpen(false));

  const [query, setQuery] = useState('');
  const [tag] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!isModalOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isModalOpen]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await api.search(query, tag || undefined);
        setResults(res.results);
        setTotal(res.total);
        setSelectedIndex(0);
      } catch (e) {
        console.error(e);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, tag]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      selectNode(results[selectedIndex].id);
      handleClose();
    }
  };

  return (
    <Dialog
      isOpen={isModalOpen}
      onClose={handleClose}
      title="Global Search"
      maxWidth="2xl"
    >
      <div className="space-y-3" onKeyDown={handleKeyDown}>
        {/* Search Input Bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-3 text-vault-400" />
          <input
            type="text"
            placeholder="Search notes, aliases, tags, or full-text content..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-vault-50 dark:bg-vault-800/80 border border-vault-200 dark:border-vault-700 rounded-xl text-vault-900 dark:text-vault-100 placeholder-vault-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            autoFocus
          />
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto space-y-1 pr-1">
          {results.length === 0 ? (
            <div className="text-center py-10 text-xs text-vault-400">
              {query ? 'No matching notes found.' : 'Type a query to search across the entire vault.'}
            </div>
          ) : (
            results.map((r, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={r.id}
                  onClick={() => {
                    selectNode(r.id);
                    handleClose();
                  }}
                  className={`p-3 rounded-xl cursor-pointer transition-colors border ${
                    isSelected
                      ? 'bg-brand-50/80 dark:bg-brand-950/80 border-brand-300 dark:border-brand-800'
                      : 'border-transparent hover:bg-vault-100 dark:hover:bg-vault-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-sm text-vault-900 dark:text-vault-100 flex items-center gap-1.5 truncate">
                      <FileText size={14} className="text-brand-500 shrink-0" />
                      <span>{r.title}</span>
                    </span>
                    <Badge variant="primary" size="sm">
                      {r.note_type}
                    </Badge>
                  </div>

                  {r.tags && r.tags.length > 0 && (
                    <div className="flex gap-1 mb-1.5">
                      {r.tags.map((t: string) => (
                        <span
                          key={t}
                          className="text-[10px] text-vault-500 bg-vault-200/60 dark:bg-vault-800 px-1.5 py-0.2 rounded"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}

                  {r.snippet && (
                    <p
                      className="text-xs text-vault-600 dark:text-vault-400 leading-relaxed font-sans line-clamp-2 [&>mark]:bg-amber-200 dark:[&>mark]:bg-amber-500/40 dark:[&>mark]:text-amber-100 [&>mark]:px-0.5 [&>mark]:rounded"
                      dangerouslySetInnerHTML={{ __html: r.snippet }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-vault-200 dark:border-vault-800 flex items-center justify-between text-[11px] text-vault-400">
          <span>Found {total} notes</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-vault-100 dark:bg-vault-800 rounded border border-vault-200 dark:border-vault-700">
              ↑↓
            </kbd>{' '}
            Navigate •{' '}
            <kbd className="px-1.5 py-0.5 bg-vault-100 dark:bg-vault-800 rounded border border-vault-200 dark:border-vault-700">
              Enter
            </kbd>{' '}
            Open
          </span>
        </div>
      </div>
    </Dialog>
  );
};
