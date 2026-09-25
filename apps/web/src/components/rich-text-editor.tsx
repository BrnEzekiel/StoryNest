"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (plainText: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
};

/** Convert plain text (paragraphs separated by blank lines) into simple HTML for TipTap. */
function textToHtml(text: string): string {
  if (!text.trim()) return "";
  if (text.includes("<p>") || text.includes("<h")) return text;
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** TipTap document → plain text with blank lines between paragraphs (reader-friendly). */
function htmlToPlain(editor: ReturnType<typeof useEditor>): string {
  if (!editor) return "";
  const json = editor.getJSON();
  const parts: string[] = [];
  const walk = (node: { type?: string; text?: string; content?: unknown[] }) => {
    if (node.type === "text" && node.text) {
      parts[parts.length - 1] = (parts[parts.length - 1] || "") + node.text;
    }
    if (node.type === "hardBreak") {
      parts[parts.length - 1] = (parts[parts.length - 1] || "") + "\n";
    }
    if (node.type === "paragraph" || node.type === "heading") {
      parts.push("");
      (node.content || []).forEach((c) => walk(c as typeof node));
    } else if (node.content) {
      node.content.forEach((c) => walk(c as typeof node));
    }
  };
  walk(json as { type?: string; content?: unknown[] });
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function RichTextEditor({ value, onChange, placeholder, className, minHeight }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({
        placeholder: placeholder || "Once upon a time…",
      }),
    ],
    content: textToHtml(value),
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onChange(htmlToPlain(ed));
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm sm:prose-base max-w-none focus:outline-none px-3 py-3 font-serif leading-relaxed",
          minHeight || "min-h-[280px]"
        ),
      },
    },
  });

  // Sync external value when switching chapters
  useEffect(() => {
    if (!editor) return;
    const current = htmlToPlain(editor);
    if (value !== current && value !== undefined) {
      editor.commands.setContent(textToHtml(value), false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="h-40 rounded-md border border-input bg-muted/30 animate-pulse" />
    );
  }

  return (
    <div className={cn("rounded-md border border-input bg-background overflow-hidden", className)}>
      <div className="flex flex-wrap gap-1 border-b border-border bg-muted/40 px-2 py-1.5">
        <ToolbarBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="B"
          title="Bold"
        />
        <ToolbarBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="I"
          title="Italic"
          className="italic"
        />
        <ToolbarBtn
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          label="H2"
          title="Heading"
        />
        <ToolbarBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="• List"
          title="Bullet list"
        />
        <ToolbarBtn
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          label="Quote"
          title="Quote"
        />
        <ToolbarBtn
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          label="—"
          title="Divider"
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarBtn({
  active,
  onClick,
  label,
  title,
  className,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  title: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground",
        active && "bg-background text-primary shadow-sm",
        className
      )}
    >
      {label}
    </button>
  );
}
