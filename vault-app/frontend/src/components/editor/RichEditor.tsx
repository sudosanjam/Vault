import React, { useEffect, useRef, useState, useCallback } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Highlight from '@tiptap/extension-highlight';
import { common, createLowlight } from 'lowlight';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import { ResizableImage } from './ResizableImage';
import { api } from '../../api/client';
import { useVault } from '../../state/VaultContext';
import { Badge } from '../ui/Badge';
import { EditorToolbar } from './EditorToolbar';
import { Loader2 } from 'lucide-react';

const lowlight = createLowlight(common);

export const RichEditor: React.FC = () => {
  const {
    activeNote,
    updateActiveNoteContent,
    updateActiveNoteMetadata,
  } = useVault();

  const [title, setTitle] = useState('');
  const [showLinkPopup, setShowLinkPopup] = useState(false);
  const [linkQuery, setLinkQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  const canvasBg = activeNote?.metadata.custom_properties?.canvas_bg || 'plain';

  const handleSetCanvasBg = (bg: string) => {
    if (activeNote) {
      const updatedCustom = { ...(activeNote.metadata.custom_properties || {}), canvas_bg: bg };
      updateActiveNoteMetadata({ custom_properties: updatedCustom });
    }
  };

  const uploadAndInsertImage = useCallback(async (file: File) => {
    try {
      setIsUploadingImage(true);
      const res = await api.uploadAttachment(file);
      const url = res.url || `/api/v1/attachments/file/${encodeURIComponent(res.relative_path)}`;

      if (editor) {
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'image',
            attrs: {
              src: url,
              alt: file.name,
              width: '100%',
            },
          })
          .run();
      }
    } catch (err: any) {
      console.error('Failed to upload pasted image:', err);
      alert('Could not save pasted image: ' + (err.message || 'Network error'));
    } finally {
      setIsUploadingImage(false);
    }
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'python',
        HTMLAttributes: {
          class: 'bg-vault-100 dark:bg-vault-850 p-4 rounded-xl font-mono text-xs border border-vault-200 dark:border-vault-700/60 leading-normal hljs my-3',
        },
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      ResizableImage,
    ],
    content: activeNote?.content || '',
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none min-h-[550px] px-8 py-6 text-vault-800 dark:text-vault-200 text-sm leading-relaxed selection:bg-[var(--accent-muted)]',
      },
      handleKeyDown: (view, event) => {
        // Intercept [[ trigger for internal linking
        if (
          event.key === '[' &&
          view.state.doc.textBetween(Math.max(0, view.state.selection.from - 1), view.state.selection.from) === '['
        ) {
          setShowLinkPopup(true);
          setLinkQuery('');
          loadSuggestions('');
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.indexOf('image') !== -1) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const namedFile = new File([file], `pasted_image_${timestamp}.png`, {
                type: file.type || 'image/png',
              });
              uploadAndInsertImage(namedFile);
              return true;
            }
          }
        }
        return false;
      },
      handleDrop: (_view, event, _slice, moved) => {
        if (!moved && event.dataTransfer?.files?.length) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            event.preventDefault();
            uploadAndInsertImage(file);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      updateActiveNoteContent(html);
    },
  });

  // Keep title and content in sync when active note changes
  useEffect(() => {
    if (activeNote) {
      setTitle(activeNote.metadata.title);
      if (editor && editor.getHTML() !== activeNote.content) {
        editor.commands.setContent(activeNote.content);
      }
    }
  }, [activeNote?.metadata.id]);

  const loadSuggestions = async (q: string) => {
    try {
      const res = await api.autocompleteLinks(q);
      setSuggestions(res);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTitleBlur = () => {
    if (activeNote && title.trim() && title !== activeNote.metadata.title) {
      updateActiveNoteMetadata({ title: title.trim() });
    }
  };

  const insertWikilink = (targetTitle: string) => {
    if (!editor) return;
    const linkText = `[[${targetTitle}]]`;
    editor.chain().focus().insertContent(linkText).run();
    setShowLinkPopup(false);
  };

  const handleInsertImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        uploadAndInsertImage(file);
      }
    };
    input.click();
  };

  if (!activeNote) {
    return (
      <div className="flex-1 flex items-center justify-center text-vault-400 text-sm">
        Select or create a note to begin editing.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-vault-900 overflow-hidden relative">
      {/* Sleek Apple-inspired Editor Toolbar */}
      <EditorToolbar
        editor={editor}
        onInsertLink={() => {
          setShowLinkPopup(true);
          loadSuggestions('');
        }}
        onInsertImage={handleInsertImage}
        canvasBg={canvasBg}
        onChangeCanvasBg={handleSetCanvasBg}
      />

      {/* Editor Canvas Area with Dynamic Paper Pattern */}
      <div className={`flex-1 overflow-y-auto relative transition-colors ${
        canvasBg === 'ruled' ? 'note-bg-ruled' :
        canvasBg === 'dots' ? 'note-bg-dots' :
        canvasBg === 'grid' ? 'note-bg-grid' : 'note-bg-plain'
      }`}>
        <div className="max-w-4xl mx-auto py-8 px-6 sm:px-10">
          {/* Note Metadata Header */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-muted)] text-[var(--accent-primary)] uppercase tracking-wider">
              {activeNote.metadata.note_type}
            </span>
            {activeNote.metadata.tags.map(t => (
              <Badge key={t} variant="default" size="sm">
                #{t}
              </Badge>
            ))}
          </div>

          {/* Note Title Input with Smooth Polish */}
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="Untitled Note"
            className="w-full text-3xl sm:text-4xl font-extrabold tracking-tight text-vault-900 dark:text-vault-50 bg-transparent border-b border-transparent hover:border-vault-200 dark:hover:border-vault-800/80 focus:border-[var(--accent-primary)] focus:outline-none pb-2 mb-6 transition-all placeholder:text-vault-400/50"
          />

          {/* Tiptap Editor Content */}
          <div className="w-full">
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Uploading Image Floating Indicator */}
        {isUploadingImage && (
          <div className="fixed bottom-12 right-12 flex items-center gap-2 px-4 py-2 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 text-white text-xs shadow-2xl z-50 animate-bounce">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
            <span>Preserving image to vault attachments...</span>
          </div>
        )}
      </div>

      {/* Wikilink Autocomplete Popup */}
      {showLinkPopup && (
        <div
          ref={popupRef}
          className="absolute z-40 top-20 left-1/2 -translate-x-1/2 w-96 bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        >
          <div className="p-3 border-b border-vault-200 dark:border-vault-800 bg-vault-50 dark:bg-vault-950/60">
            <input
              type="text"
              placeholder="Search note to link [[..."
              value={linkQuery}
              onChange={e => {
                setLinkQuery(e.target.value);
                loadSuggestions(e.target.value);
              }}
              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg text-vault-900 dark:text-vault-100 focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              autoFocus
            />
          </div>

          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
            {suggestions.length === 0 ? (
              <div className="text-center py-4 text-xs text-vault-400">
                No matching notes found.
              </div>
            ) : (
              suggestions.map(s => (
                <div
                  key={s.id}
                  onClick={() => insertWikilink(s.title)}
                  className="flex items-center justify-between px-3 py-2 text-xs rounded-xl hover:bg-[var(--accent-muted)] cursor-pointer text-vault-800 dark:text-vault-200 transition-colors"
                >
                  <div className="truncate flex-1">
                    <span className="font-semibold">{s.title}</span>
                    {s.matched_alias && (
                      <span className="text-[10px] text-vault-400 ml-1.5 font-normal">
                        (alias: {s.matched_alias})
                      </span>
                    )}
                  </div>
                  <Badge variant="default" size="sm">
                    {s.note_type}
                  </Badge>
                </div>
              ))
            )}
          </div>

          <div className="p-2 border-t border-vault-200 dark:border-vault-800 bg-vault-50 dark:bg-vault-950/60 flex justify-end">
            <button
              onClick={() => setShowLinkPopup(false)}
              className="text-xs text-vault-500 hover:text-vault-700 px-2 py-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
