import React, { useState } from 'react';
import { useVault } from '../../state/VaultContext';
import { Badge } from '../ui/Badge';
import { Code, Eye } from 'lucide-react';

export const MarkdownPreview: React.FC = () => {
  const { activeNote, selectNode, notesSummary } = useVault();
  const [showRaw, setShowRaw] = useState(false);

  if (!activeNote) {
    return (
      <div className="flex-1 flex items-center justify-center text-vault-400 text-sm">
        Select a note to preview.
      </div>
    );
  }

  const { metadata, content } = activeNote;

  const isHtml = /<[a-z][\s\S]*>/i.test(content);

  // Simple HTML renderer for preview mode that converts [[wikilinks]] to clickable links
  const renderPreviewContent = (text: string) => {
    // If it's HTML from Tiptap, render it via dangerouslySetInnerHTML
    if (isHtml) {
      // Process wikilinks inside HTML
      const processedHtml = text.replace(
        /\[\[([^\]\|#]+)(?:#([^\]\|]+))?(?:\|([^\]]+))?\]\]/g,
        (_match, targetTitle, _anchor, display) => {
          const title = (display || targetTitle).trim();
          const target = notesSummary.find(
            n => n.title.toLowerCase() === targetTitle.trim().toLowerCase() || n.id === targetTitle.trim()
          );
          if (target) {
            return `<a href="#${target.id}" class="text-[var(--accent-primary)] font-semibold underline decoration-[var(--accent-primary)]/40 hover:opacity-80">${title}</a>`;
          }
          return `<span class="text-red-400 line-through" title="Broken link">${title}</span>`;
        }
      );

      return (
        <div
          className="prose dark:prose-invert max-w-none text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: processedHtml }}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'A' && target.getAttribute('href')?.startsWith('#')) {
              e.preventDefault();
              const id = target.getAttribute('href')?.slice(1);
              if (id) selectNode(id);
            }
          }}
        />
      );
    }

    // Markdown text renderer with wikilinks
    const parts = [];
    const regex = /\[\[([^\]\|#]+)(?:#([^\]\|]+))?(?:\|([^\]]+))?\]\]/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const targetTitle = match[1].trim();
      const display = match[3]?.trim() || targetTitle;
      const targetNote = notesSummary.find(
        n => n.title.toLowerCase() === targetTitle.toLowerCase() || n.id === targetTitle
      );

      parts.push(
        <button
          key={match.index}
          onClick={() => targetNote && selectNode(targetNote.id)}
          className={`inline font-semibold px-1 py-0.5 rounded transition-colors ${
            targetNote
              ? 'text-[var(--accent-primary)] hover:bg-[var(--accent-muted)] underline decoration-[var(--accent-primary)]/40 underline-offset-2'
              : 'text-red-400 line-through'
          }`}
          title={targetNote ? `Go to "${targetNote.title}"` : `Broken link: "${targetTitle}"`}
        >
          {display}
        </button>
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return (
      <div className="prose dark:prose-invert max-w-none text-sm text-vault-800 dark:text-vault-200 leading-relaxed whitespace-pre-wrap">
        {parts}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-vault-900 overflow-hidden">
      {/* Header bar */}
      <div className="h-10 px-6 bg-vault-50/80 dark:bg-vault-950/50 backdrop-blur-md border-b border-vault-200 dark:border-vault-800 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-muted)] text-[var(--accent-primary)] uppercase tracking-wider">
            {metadata.note_type}
          </span>
          {metadata.tags.map(t => (
            <Badge key={t} variant="default" size="sm">
              #{t}
            </Badge>
          ))}
        </div>

        <button
          onClick={() => setShowRaw(!showRaw)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-vault-600 dark:text-vault-400 hover:bg-vault-200 dark:hover:bg-vault-800 rounded-lg transition-colors"
        >
          {showRaw ? <Eye size={13} /> : <Code size={13} />}
          <span>{showRaw ? 'Rendered View' : 'Raw Content'}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 sm:p-10">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-vault-900 dark:text-vault-50 mb-6 pb-3 border-b border-vault-200 dark:border-vault-800">
            {metadata.title}
          </h1>

          {showRaw ? (
            <pre className="p-4 bg-vault-100 dark:bg-vault-800/80 rounded-2xl font-mono text-xs text-vault-800 dark:text-vault-200 border border-vault-200 dark:border-vault-700/80 overflow-x-auto whitespace-pre-wrap">
              {content}
            </pre>
          ) : (
            renderPreviewContent(content)
          )}
        </div>
      </div>
    </div>
  );
};
