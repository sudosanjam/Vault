import React, { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold,
  Bookmark,
  CheckSquare,
  ChevronDown,
  Code,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Layers,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
  Table as TableIcon,
  Trash2,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor | null;
  onInsertLink: () => void;
  onInsertImage: () => void;
  canvasBg?: string;
  onChangeCanvasBg?: (bg: string) => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  onInsertLink,
  onInsertImage,
  canvasBg = 'plain',
  onChangeCanvasBg,
}) => {
  const [dividerMenuOpen, setDividerMenuOpen] = useState(false);
  const [bgMenuOpen, setBgMenuOpen] = useState(false);

  const dividerRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dividerRef.current && !dividerRef.current.contains(e.target as Node)) {
        setDividerMenuOpen(false);
      }
      if (bgRef.current && !bgRef.current.contains(e.target as Node)) {
        setBgMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  if (!editor) return null;

  const btnClass = (isActive: boolean) =>
    `p-1.5 rounded-lg transition-all duration-150 flex items-center justify-center ${
      isActive
        ? 'bg-[var(--accent-muted)] text-[var(--accent-primary)] shadow-sm font-semibold'
        : 'text-vault-500 hover:text-vault-900 dark:text-vault-400 dark:hover:text-vault-100 hover:bg-vault-100 dark:hover:bg-vault-800/80'
    }`;

  const insertDivider = (type: 'solid' | 'dashed' | 'dotted' | 'block') => {
    if (!editor) return;
    setDividerMenuOpen(false);
    if (type === 'solid') {
      editor.chain().focus().setHorizontalRule().run();
    } else if (type === 'dashed') {
      editor.chain().focus().insertContent('<hr class="divider-dashed" /><p></p>').run();
    } else if (type === 'dotted') {
      editor.chain().focus().insertContent('<hr class="divider-dotted" /><p></p>').run();
    } else if (type === 'block') {
      editor.chain().focus().insertContent('<hr class="divider-block" /><p></p>').run();
    }
  };

  const insertSectionBanner = () => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent(
        '<div class="section-banner"><h2>Section Title</h2><p>Key highlights and thoughts for this section...</p></div><p></p>'
      )
      .run();
  };

  const bgOptions = [
    { id: 'plain', label: 'Blank / Plain', hint: 'Default clean canvas' },
    { id: 'ruled', label: 'Notebook Ruled', hint: 'Horizontal notebook lines' },
    { id: 'dots', label: 'Dot Matrix', hint: 'Subtle bullet grid' },
    { id: 'grid', label: 'Graph Paper', hint: 'Squared engineering grid' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 px-4 py-2 bg-vault-50/70 dark:bg-vault-900/70 backdrop-blur-md border-b border-vault-200 dark:border-vault-800 text-xs shrink-0 select-none">
      {/* Headings Group */}
      <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-vault-200/40 dark:bg-vault-800/40 border border-vault-200/60 dark:border-vault-700/40">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={btnClass(editor.isActive('heading', { level: 1 }))}
          title="Heading 1"
        >
          <Heading1 size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btnClass(editor.isActive('heading', { level: 2 }))}
          title="Heading 2"
        >
          <Heading2 size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={btnClass(editor.isActive('heading', { level: 3 }))}
          title="Heading 3"
        >
          <Heading3 size={14} />
        </button>
        <button
          type="button"
          onClick={insertSectionBanner}
          className={btnClass(false)}
          title="Insert Section Banner Callout"
        >
          <Bookmark size={14} className="text-[var(--accent-primary)]" />
        </button>
      </div>

      <div className="w-[1px] h-4 bg-vault-200 dark:bg-vault-800 mx-1" />

      {/* Inline Formatting Group */}
      <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-vault-200/40 dark:bg-vault-800/40 border border-vault-200/60 dark:border-vault-700/40">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btnClass(editor.isActive('bold'))}
          title="Bold (Ctrl+B)"
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btnClass(editor.isActive('italic'))}
          title="Italic (Ctrl+I)"
        >
          <Italic size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={btnClass(editor.isActive('strike'))}
          title="Strikethrough"
        >
          <Strikethrough size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={btnClass(editor.isActive('highlight'))}
          title="Highlight Text"
        >
          <Highlighter size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={btnClass(editor.isActive('code'))}
          title="Inline Code"
        >
          <Code size={14} />
        </button>
      </div>

      <div className="w-[1px] h-4 bg-vault-200 dark:bg-vault-800 mx-1" />

      {/* Lists & Tasks Group */}
      <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-vault-200/40 dark:bg-vault-800/40 border border-vault-200/60 dark:border-vault-700/40">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btnClass(editor.isActive('bulletList'))}
          title="Bullet List"
        >
          <List size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btnClass(editor.isActive('orderedList'))}
          title="Numbered List"
        >
          <ListOrdered size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={btnClass(editor.isActive('taskList'))}
          title="Checklist"
        >
          <CheckSquare size={14} />
        </button>
      </div>

      <div className="w-[1px] h-4 bg-vault-200 dark:bg-vault-800 mx-1" />

      {/* Quotes & Blocks */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={btnClass(editor.isActive('blockquote'))}
          title="Blockquote"
        >
          <Quote size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock({ language: 'python' }).run()}
          className={btnClass(editor.isActive('codeBlock'))}
          title="Code Block (Python auto-highlighted)"
        >
          <FileCode size={14} />
        </button>
      </div>

      <div className="w-[1px] h-4 bg-vault-200 dark:bg-vault-800 mx-1" />

      {/* Dividers Popover Menu */}
      <div className="relative" ref={dividerRef}>
        <button
          type="button"
          onClick={() => setDividerMenuOpen(!dividerMenuOpen)}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-vault-600 dark:text-vault-300 hover:bg-vault-100 dark:hover:bg-vault-800/80 transition-colors"
          title="Insert Section Divider"
        >
          <Minus size={14} />
          <span className="text-[11px] font-medium hidden sm:inline">Divider</span>
          <ChevronDown size={10} className="text-vault-400" />
        </button>

        {dividerMenuOpen && (
          <div className="absolute left-0 mt-1.5 w-44 bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-800 rounded-xl shadow-xl p-1.5 z-50 text-xs space-y-1 animate-scale-in">
            <button
              type="button"
              onClick={() => insertDivider('solid')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-vault-100 dark:hover:bg-vault-800 text-left text-vault-800 dark:text-vault-200"
            >
              <span>Solid Line</span>
              <span className="w-10 h-[1px] bg-vault-400" />
            </button>
            <button
              type="button"
              onClick={() => insertDivider('dashed')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-vault-100 dark:hover:bg-vault-800 text-left text-vault-800 dark:text-vault-200"
            >
              <span>Dashed Line</span>
              <span className="w-10 border-t border-dashed border-vault-400" />
            </button>
            <button
              type="button"
              onClick={() => insertDivider('dotted')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-vault-100 dark:hover:bg-vault-800 text-left text-vault-800 dark:text-vault-200"
            >
              <span>Dotted Line</span>
              <span className="w-10 border-t-2 border-dotted border-vault-400" />
            </button>
            <button
              type="button"
              onClick={() => insertDivider('block')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-vault-100 dark:hover:bg-vault-800 text-left text-vault-800 dark:text-vault-200"
            >
              <span>Accent Ribbon</span>
              <span className="w-10 h-1.5 rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)]" />
            </button>
          </div>
        )}
      </div>

      <div className="w-[1px] h-4 bg-vault-200 dark:bg-vault-800 mx-1" />

      {/* Note Background Pattern Popover */}
      {onChangeCanvasBg && (
        <div className="relative" ref={bgRef}>
          <button
            type="button"
            onClick={() => setBgMenuOpen(!bgMenuOpen)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-vault-600 dark:text-vault-300 hover:bg-vault-100 dark:hover:bg-vault-800/80 transition-colors"
            title="Note Canvas Pattern Background"
          >
            <Layers size={14} className="text-[var(--accent-primary)]" />
            <span className="text-[11px] font-medium hidden sm:inline">Background</span>
            <ChevronDown size={10} className="text-vault-400" />
          </button>

          {bgMenuOpen && (
            <div className="absolute left-0 mt-1.5 w-48 bg-white dark:bg-vault-900 border border-vault-200 dark:border-vault-800 rounded-xl shadow-xl p-1.5 z-50 text-xs space-y-1 animate-scale-in">
              <div className="px-2 py-1 text-[10px] font-bold text-vault-400 uppercase tracking-wider">
                Note Background
              </div>
              {bgOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChangeCanvasBg(opt.id);
                    setBgMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    canvasBg === opt.id
                      ? 'bg-[var(--accent-muted)] text-[var(--accent-primary)] font-semibold'
                      : 'text-vault-700 dark:text-vault-300 hover:bg-vault-100 dark:hover:bg-vault-800'
                  }`}
                >
                  <div>
                    <div className="text-xs">{opt.label}</div>
                    <div className="text-[9px] text-vault-400">{opt.hint}</div>
                  </div>
                  {canvasBg === opt.id && <span className="text-xs">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="w-[1px] h-4 bg-vault-200 dark:bg-vault-800 mx-1" />

      {/* Tables & Media */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
          className={btnClass(editor.isActive('table'))}
          title="Insert Table"
        >
          <TableIcon size={14} />
        </button>

        {editor.isActive('table') && (
          <div className="flex items-center gap-1 bg-vault-100 dark:bg-vault-800 px-1.5 py-0.5 rounded-lg border border-vault-200 dark:border-vault-700">
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className="px-1.5 py-0.5 text-[10px] font-medium text-vault-600 dark:text-vault-400 hover:text-white hover:bg-vault-700 rounded transition-colors"
            >
              +Row
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              className="px-1.5 py-0.5 text-[10px] font-medium text-vault-600 dark:text-vault-400 hover:text-white hover:bg-vault-700 rounded transition-colors"
            >
              +Col
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteTable().run()}
              className="p-1 hover:text-red-400 text-vault-400 rounded transition-colors"
              title="Delete Table"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onInsertLink}
          className={btnClass(false)}
          title="Insert [[Wikilink]]"
        >
          <Link size={14} />
        </button>
        <button
          type="button"
          onClick={onInsertImage}
          className={btnClass(false)}
          title="Insert / Upload Image"
        >
          <ImageIcon size={14} />
        </button>
      </div>
    </div>
  );
};
