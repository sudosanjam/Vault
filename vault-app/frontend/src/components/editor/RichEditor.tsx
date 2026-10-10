import React, { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { api } from '../../api/client';
import { useVault } from '../../state/VaultContext';
import { Badge } from '../ui/Badge';
import { EditorToolbar } from './EditorToolbar';

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
  const popupRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: 'bg-vault-100 dark:bg-vault-800 p-3 rounded-lg font-mono text-xs border border-vault-200 dark:border-vault-700' } },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: true }),
    ],
    content: activeNote?.content || '',
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none min-h-[500px] px-8 py-6 text-vault-800 dark:text-vault-200 text-sm leading-relaxed',
      },
      handleKeyDown: (view, event) => {
        // Intercept [[ trigger for internal linking
        if (event.key === '[' && view.state.doc.textBetween(Math.max(0, view.state.selection.from - 1), view.state.selection.from) === '[') {
          setShowLinkPopup(true);
          setLinkQuery('');
          loadSuggestions('');
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
    const url = prompt('Enter image URL or relative attachment path (e.g. attachments/images/sample.png):');
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
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
      {/* Editor Toolbar */}
      <EditorToolbar
        editor={editor}
        onInsertLink={() => {
          setShowLinkPopup(true);
          loadSuggestions('');
        }}
        onInsertImage={handleInsertImage}
      />

      {/* Editor Main Canvas */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto py-8 px-6">
          {/* Note Header: Type & Tags */}
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="primary" size="sm">
              {activeNote.metadata.note_type}
            </Badge>
            {activeNote.metadata.tags.map(t => (
              <Badge key={t} variant="default" size="sm">
                #{t}
              </Badge>
            ))}
          </div>

          {/* Editable Title */}
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="Untitled Note"
            className="w-full text-3xl font-bold text-vault-900 dark:text-vault-50 bg-transparent border-b border-transparent hover:border-vault-200 dark:hover:border-vault-800 focus:border-indigo-500 focus:outline-none pb-2 mb-4 transition-colors"
          />

          {/* Tiptap Editor Content */}
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Wikilink Autocomplete Popup */}
      {showLinkPopup && (
        <div
          ref={popupRef}
          className="absolute z-40 top-24 left-1/2 -translate-x-1/2 w-96 bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-800 rounded-xl shadow-2xl overflow-hidden animate-scale-in"
        >
          <div className="p-2 border-b border-vault-200 dark:border-vault-800 bg-vault-50 dark:bg-vault-950/60">
            <input
              type="text"
              placeholder="Search note to link [[..."
              value={linkQuery}
              onChange={e => {
                setLinkQuery(e.target.value);
                loadSuggestions(e.target.value);
              }}
              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-700 rounded-lg text-vault-900 dark:text-vault-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                  className="flex items-center justify-between px-3 py-2 text-xs rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/70 cursor-pointer text-vault-800 dark:text-vault-200"
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
