"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema, DOMParser, DOMSerializer, MarkSpec } from "prosemirror-model";
import { schema } from "prosemirror-schema-basic";
import { keymap } from "prosemirror-keymap";
import { history, undo, redo } from "prosemirror-history";
import {
  baseKeymap,
  toggleMark,
  setBlockType,
  wrapIn,
} from "prosemirror-commands";
import { wrapInList, addListNodes } from "prosemirror-schema-list";

interface ProseMirrorEditorProps {
  content: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
}

export interface ProseMirrorEditorRef {
  updateContent: (newContent: string) => void;
}

const ProseMirrorEditor = forwardRef<
  ProseMirrorEditorRef,
  ProseMirrorEditorProps
>(({ content, onChange, readOnly = false }, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const schemaRef = useRef<Schema | null>(null);
  const isUpdatingRef = useRef(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Expose updateContent method to parent
  useImperativeHandle(ref, () => ({
    updateContent: (newContent: string) => {
      if (!viewRef.current || !schemaRef.current) return;

      isUpdatingRef.current = true;

      // Parse new content
      const contentElement = document.createElement("div");
      contentElement.innerHTML = newContent || "<p></p>";
      const doc = DOMParser.fromSchema(schemaRef.current).parse(contentElement);

      // Update editor state
      const newState = EditorState.create({
        doc,
        plugins: viewRef.current.state.plugins,
      });

      viewRef.current.updateState(newState);

      isUpdatingRef.current = false;
    },
  }));

  // Create toolbar
  const createToolbar = (view: EditorView, mySchema: Schema) => {
    if (!toolbarRef.current || readOnly) return;

    toolbarRef.current.innerHTML = "";
    toolbarRef.current.className = "prosemirror-toolbar";

    type ToolbarItem = {
      separator?: boolean;
      title?: string;
      content?: string;
      className?: string;
      command?: (state: any, dispatch: any, view: any) => boolean;
    };

    const buttons: ToolbarItem[] = [
      {
        title: "Bold (Ctrl+B)",
        content: "B",
        className: "toolbar-btn bold",
        command: toggleMark(mySchema.marks.strong),
      },
      {
        title: "Italic (Ctrl+I)",
        content: "I",
        className: "toolbar-btn italic",
        command: toggleMark(mySchema.marks.em),
      },
      {
        title: "Underline (Ctrl+U)",
        content: "U",
        className: "toolbar-btn underline",
        command: toggleMark(mySchema.marks.underline),
      },
      {
        title: "Strikethrough",
        content: "S",
        className: "toolbar-btn strikethrough",
        command: toggleMark(mySchema.marks.strikethrough),
      },
      {
        title: "Inline Code",
        content: "</>",
        className: "toolbar-btn",
        command: toggleMark(mySchema.marks.code),
      },
      { separator: true },
      {
        title: "Heading 1",
        content: "H1",
        className: "toolbar-btn",
        command: setBlockType(mySchema.nodes.heading, { level: 1 }),
      },
      {
        title: "Heading 2",
        content: "H2",
        className: "toolbar-btn",
        command: setBlockType(mySchema.nodes.heading, { level: 2 }),
      },
      {
        title: "Heading 3",
        content: "H3",
        className: "toolbar-btn",
        command: setBlockType(mySchema.nodes.heading, { level: 3 }),
      },
      {
        title: "Paragraph",
        content: "P",
        className: "toolbar-btn",
        command: setBlockType(mySchema.nodes.paragraph),
      },
      { separator: true },
      {
        title: "Bullet List",
        content: "•",
        className: "toolbar-btn",
        command: wrapInList(mySchema.nodes.bullet_list),
      },
      {
        title: "Ordered List",
        content: "1.",
        className: "toolbar-btn",
        command: wrapInList(mySchema.nodes.ordered_list),
      },
      { separator: true },
      {
        title: "Blockquote",
        content: '"',
        className: "toolbar-btn",
        command: wrapIn(mySchema.nodes.blockquote),
      },
      {
        title: "Horizontal Rule",
        content: "—",
        className: "toolbar-btn",
        command: (state, dispatch) => {
          if (dispatch) {
            const hr = mySchema.nodes.horizontal_rule.create();
            dispatch(state.tr.replaceSelectionWith(hr));
          }
          return true;
        },
      },
      { separator: true },
      {
        title: "Undo (Ctrl+Z)",
        content: "↶",
        className: "toolbar-btn",
        command: undo,
      },
      {
        title: "Redo (Ctrl+Y)",
        content: "↷",
        className: "toolbar-btn",
        command: redo,
      },
    ];

    buttons.forEach((item) => {
      if (item.separator) {
        const separator = document.createElement("span");
        separator.className = "toolbar-separator";
        toolbarRef.current?.appendChild(separator);
        return;
      }

      const button = document.createElement("button");
      button.className = item.className || "";
      button.title = item.title || "";
      button.textContent = item.content || "";
      button.type = "button";

      button.addEventListener("mousedown", (e) => {
        e.preventDefault();
        if (item.command) {
          item.command(view.state, view.dispatch, view);
          view.focus();
        }
      });

      toolbarRef.current?.appendChild(button);
    });
  };

  useEffect(() => {
    if (!editorRef.current) return;

    const basicMarks = schema.spec.marks;

    const extendedMarks = basicMarks.append({
      strikethrough: {
        parseDOM: [
          { tag: "s" },
          { tag: "strike" },
          { style: "text-decoration=line-through" },
        ],
        toDOM() {
          return ["s", 0];
        },
      } as MarkSpec,
      underline: {
        parseDOM: [{ tag: "u" }, { style: "text-decoration=underline" }],
        toDOM() {
          return ["u", 0];
        },
      } as MarkSpec,
    });

    // Create schema with lists
    const mySchema = new Schema({
      nodes: addListNodes(schema.spec.nodes, "paragraph block*", "block"),
      marks: extendedMarks,
    });

    schemaRef.current = mySchema;

    // Parse initial content from HTML
    const contentElement = document.createElement("div");
    contentElement.innerHTML = content || "<p></p>";
    const doc = DOMParser.fromSchema(mySchema).parse(contentElement);

    // Create editor state
    const state = EditorState.create({
      doc,
      plugins: [
        history(),
        keymap({
          "Mod-z": undo,
          "Mod-y": redo,
          "Mod-Shift-z": redo,
          "Mod-b": toggleMark(mySchema.marks.strong),
          "Mod-i": toggleMark(mySchema.marks.em),
          "Mod-u": toggleMark(mySchema.marks.underline),
          "Mod-`": toggleMark(mySchema.marks.code),
        }),
        keymap(baseKeymap),
      ],
    });

    // Create editor view
    const view = new EditorView(editorRef.current, {
      state,
      editable: () => !readOnly,
      dispatchTransaction(transaction) {
        const newState = view.state.apply(transaction);
        view.updateState(newState);

        // Call onChange when content changes (only if not from external update)
        if (transaction.docChanged && !readOnly && !isUpdatingRef.current) {
          const html = getHTMLFromState(newState, mySchema);
          onChange(html);
        }
      },
    });

    viewRef.current = view;

    createToolbar(view, mySchema);

    // Cleanup
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Update read-only state
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.setProps({
        editable: () => !readOnly,
      });
    }
  }, [readOnly]);

  // Helper to convert ProseMirror state to HTML
  const getHTMLFromState = (state: EditorState, schema: Schema): string => {
    const div = document.createElement("div");
    const fragment = state.doc.content;
    const serializer = DOMSerializer.fromSchema(schema);
    div.appendChild(serializer.serializeFragment(fragment));
    return div.innerHTML;
  };

  return (
    <div style={{ 
    display: 'flex', 
    flexDirection: 'column',
    height: '70vh',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
    overflow: 'hidden'
  }}>
    {!readOnly && <div ref={toolbarRef} style={{ flexShrink: 0 }} />}
    <div 
      ref={editorRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        background: readOnly ? '#f8f9fa' : 'white',
        padding: '20px',
      }}
    />
  </div>
  );
});

ProseMirrorEditor.displayName = "ProseMirrorEditor";

export default ProseMirrorEditor;
