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
    `p-1.5 rounded hover:bg-vault-200 dark:hover:bg-vault-700 transition-colors ${
      isActive
        ? 'bg-vault-200 dark:bg-vault-700 text-brand-600 dark:text-brand-400 font-bold'
        : 'text-vault-600 dark:text-vault-400'
    }`;

  return (
    <div className="flex flex-wrap items-center gap-1 p-1.5 bg-vault-50 dark:bg-vault-950/60 border-b border-vault-200 dark:border-vault-800 text-xs shrink-0 select-none">
      {/* Headings */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={btnClass(editor.isActive('heading', { level: 1 }))}
        title="Heading 1"
      >
        <Heading1 size={15} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btnClass(editor.isActive('heading', { level: 2 }))}
        title="Heading 2"
      >
        <Heading2 size={15} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btnClass(editor.isActive('heading', { level: 3 }))}
        title="Heading 3"
      >
        <Heading3 size={15} />
      </button>

      <div className="w-[1px] h-4 bg-vault-300 dark:bg-vault-700 mx-1" />

      {/* Inline Formatting */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btnClass(editor.isActive('bold'))}
        title="Bold (Ctrl+B)"
      >
        <Bold size={15} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btnClass(editor.isActive('italic'))}
        title="Italic (Ctrl+I)"
      >
        <Italic size={15} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btnClass(editor.isActive('strike'))}
        title="Strikethrough"
      >
        <Strikethrough size={15} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={btnClass(editor.isActive('code'))}
        title="Inline Code"
      >
        <Code size={15} />
      </button>

      <div className="w-[1px] h-4 bg-vault-300 dark:bg-vault-700 mx-1" />

      {/* Lists & Tasks */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btnClass(editor.isActive('bulletList'))}
        title="Bullet List"
      >
        <List size={15} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btnClass(editor.isActive('orderedList'))}
        title="Numbered List"
      >
        <ListOrdered size={15} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        className={btnClass(editor.isActive('taskList'))}
        title="Checklist"
      >
        <CheckSquare size={15} />
      </button>

      <div className="w-[1px] h-4 bg-vault-300 dark:bg-vault-700 mx-1" />

      {/* Blocks */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btnClass(editor.isActive('blockquote'))}
        title="Blockquote"
      >
        <Quote size={15} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={btnClass(editor.isActive('codeBlock'))}
        title="Code Block"
      >
        <FileCode size={15} />
      </button>

      <div className="w-[1px] h-4 bg-vault-300 dark:bg-vault-700 mx-1" />

      {/* Table */}
      <button
        type="button"
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
        className={btnClass(editor.isActive('table'))}
        title="Insert Table"
      >
        <TableIcon size={15} />
      </button>

      {editor.isActive('table') && (
        <>
          <button
            type="button"
            onClick={() => editor.chain().focus().addRowAfter().run()}
            className="px-1.5 py-0.5 text-[11px] font-medium text-vault-600 dark:text-vault-400 hover:bg-vault-200 dark:hover:bg-vault-700 rounded"
          >
            +Row
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            className="px-1.5 py-0.5 text-[11px] font-medium text-vault-600 dark:text-vault-400 hover:bg-vault-200 dark:hover:bg-vault-700 rounded"
          >
            +Col
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteTable().run()}
            className="p-1 hover:text-red-600 text-vault-400 rounded"
            title="Delete Table"
          >
            <Trash2 size={13} />
          </button>
        </>
      )}

      <div className="w-[1px] h-4 bg-vault-300 dark:bg-vault-700 mx-1" />

      {/* Links & Attachments */}
      <button
        type="button"
        onClick={onInsertLink}
        className={btnClass(false)}
        title="Insert [[Wikilink]]"
      >
        <Link size={15} />
      </button>
      <button
        type="button"
        onClick={onInsertImage}
        className={btnClass(false)}
        title="Insert Image"
      >
        <ImageIcon size={15} />
      </button>
    </div>
  );
};
