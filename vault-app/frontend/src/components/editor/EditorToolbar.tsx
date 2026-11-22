import React from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold,
  CheckSquare,
  Code,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Table as TableIcon,
  Trash2,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor | null;
  onInsertLink: () => void;
  onInsertImage: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  onInsertLink,
  onInsertImage,
}) => {
  if (!editor) return null;

  const btnClass = (isActive: boolean) =>
    `p-1.5 rounded-lg transition-all duration-150 flex items-center justify-center ${
      isActive
        ? 'bg-[var(--accent-muted)] text-[var(--accent-primary)] shadow-sm font-semibold'
        : 'text-vault-500 hover:text-vault-900 dark:text-vault-400 dark:hover:text-vault-100 hover:bg-vault-100 dark:hover:bg-vault-800/80'
    }`;

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
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={btnClass(editor.isActive('codeBlock'))}
          title="Code Block"
        >
          <FileCode size={14} />
        </button>
      </div>

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
