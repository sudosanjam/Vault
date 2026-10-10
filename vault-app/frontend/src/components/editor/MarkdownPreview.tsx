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

  // Simple HTML renderer for preview mode that converts [[wikilinks]] to clickable links
  const renderPreviewContent = (text: string) => {
    // Replace [[Title]] with clickable span
    const parts = [];
    const regex = /\[\[([^\]\|#]+)(?:#([^\]\|]+))?(?:\|([^\]]+))?\]\]/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Push preceding text
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
              ? 'text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/80 underline decoration-brand-400/40 underline-offset-2'
              : 'text-red-500 line-through'
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

    return parts;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-vault-900 overflow-hidden">
      {/* Header bar */}
      <div className="h-10 px-6 bg-vault-50 dark:bg-vault-950/60 border-b border-vault-200 dark:border-vault-800 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <Badge variant="primary" size="sm">
            {metadata.note_type}
          </Badge>
          {metadata.tags.map(t => (
            <Badge key={t} variant="default" size="sm">
              #{t}
            </Badge>
          ))}
        </div>

        <button
          onClick={() => setShowRaw(!showRaw)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-vault-600 dark:text-vault-400 hover:bg-vault-200 dark:hover:bg-vault-800 rounded-md transition-colors"
        >
          {showRaw ? <Eye size={13} /> : <Code size={13} />}
          <span>{showRaw ? 'Rendered View' : 'Raw Markdown'}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-vault-900 dark:text-vault-50 mb-6 pb-2 border-b border-vault-200 dark:border-vault-800">
            {metadata.title}
          </h1>

          {showRaw ? (
            <pre className="p-4 bg-vault-100 dark:bg-vault-800/80 rounded-xl font-mono text-xs text-vault-800 dark:text-vault-200 border border-vault-200 dark:border-vault-700 overflow-x-auto whitespace-pre-wrap">
              {content}
            </pre>
          ) : (
            <div className="prose dark:prose-invert max-w-none text-sm text-vault-800 dark:text-vault-200 leading-relaxed whitespace-pre-wrap">
              {renderPreviewContent(content)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
