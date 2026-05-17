"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { useEffect, useRef } from "react";
import { marked } from "marked";
import {
  Bold, Italic, List, ListOrdered,
  Heading1, Heading2, Heading3, Minus,
} from "lucide-react";

interface RichTextEditorProps {
  /** Markdown string from the agent — injected as initial content */
  initialMarkdown: string;
  /** Called when streaming appends new markdown content */
  streamingMarkdown?: string;
  isStreaming?: boolean;
  onChange?: (html: string) => void;
}

function mdToHtml(md: string): string {
  return marked.parse(md, { async: false }) as string;
}

export default function RichTextEditor({
  initialMarkdown,
  streamingMarkdown,
  isStreaming,
  onChange,
}: RichTextEditorProps) {
  const lastStreamRef = useRef<string>("");
  const userHasEdited = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: {},
        orderedList: {},
        horizontalRule: {},
      }),
      Placeholder.configure({
        placeholder: "Le résultat de l'agent apparaîtra ici…",
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: initialMarkdown ? mdToHtml(initialMarkdown) : "",
    editorProps: {
      attributes: {
        class: "outline-none min-h-[120px] prose-custom",
        spellcheck: "false",
      },
    },
    onUpdate: ({ editor: ed }) => {
      userHasEdited.current = true;
      onChange?.(ed.getHTML());
    },
  });

  // Replace content when a new initialMarkdown arrives (new task opened)
  const prevInitial = useRef(initialMarkdown);
  useEffect(() => {
    if (!editor || initialMarkdown === prevInitial.current) return;
    prevInitial.current = initialMarkdown;
    userHasEdited.current = false;
    lastStreamRef.current = "";
    editor.commands.setContent(initialMarkdown ? mdToHtml(initialMarkdown) : "");
  }, [editor, initialMarkdown]);

  // Live-update during streaming — only when user hasn't edited
  useEffect(() => {
    if (!editor || !isStreaming || !streamingMarkdown) return;
    if (userHasEdited.current) return;
    if (streamingMarkdown === lastStreamRef.current) return;
    lastStreamRef.current = streamingMarkdown;
    editor.commands.setContent(mdToHtml(streamingMarkdown));
    // Move cursor to end
    editor.commands.focus("end");
  }, [editor, isStreaming, streamingMarkdown]);

  if (!editor) return null;

  const ToolBtn = ({
    active,
    onClick,
    title,
    children,
  }: {
    active?: boolean;
    onClick: () => void;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded-lg transition-colors ${
        active
          ? "bg-brand-500/25 text-brand-300"
          : "text-white/35 hover:text-white/70 hover:bg-white/[0.07]"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-black/20">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/[0.06] bg-white/[0.03]">
        <ToolBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Gras"
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italique"
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolBtn>

        <div className="w-px h-4 bg-white/[0.08] mx-1" />

        <ToolBtn
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Titre 1"
        >
          <Heading1 className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Titre 2"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Titre 3"
        >
          <Heading3 className="w-3.5 h-3.5" />
        </ToolBtn>

        <div className="w-px h-4 bg-white/[0.08] mx-1" />

        <ToolBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Liste à puces"
        >
          <List className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Liste numérotée"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolBtn>
        <ToolBtn
          active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Séparateur"
        >
          <Minus className="w-3.5 h-3.5" />
        </ToolBtn>
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="px-3 py-2.5 text-sm text-white/80 leading-relaxed editor-content"
      />
    </div>
  );
}
