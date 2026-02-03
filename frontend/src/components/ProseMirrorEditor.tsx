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
  onCursorChange?: (position: number) => void;
}

export interface ProseMirrorEditorRef {
  updateContent: (newContent: string) => void;
  getView: () => EditorView | null;
}

const ProseMirrorEditor = forwardRef<
  ProseMirrorEditorRef,
  ProseMirrorEditorProps
>(({ content, onChange, readOnly = false, onCursorChange }, ref) => {
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
    getView: () => viewRef.current,
  }));

  // Create toolbar
  const createToolbar = (view: EditorView, mySchema: Schema) => {
    if (!toolbarRef.current || readOnly) return;

    toolbarRef.current.innerHTML = "";
    toolbarRef.current.className = "prosemirror-toolbar";

    // Helper to apply mark with attributes
    const applyMarkWithAttrs = (markType: any, attrs: any) => {
      return (state: any, dispatch: any) => {
        const { from, to } = state.selection;
        const mark = markType.create(attrs);

        if (dispatch) {
          dispatch(state.tr.addMark(from, to, mark));
        }
        return true;
      };
    };

    type ToolbarItem = {
      separator?: boolean;
      title?: string;
      content?: string;
      className?: string;
      command?: (
        state: any,
        dispatch: any,
        view?: any,
        value?: string,
      ) => boolean;
      isSelect?: boolean;
      isColorPicker?: boolean;
      selectOptions?: { value: string; label: string }[];
      colorType?: "text" | "background";
    };

    const buttons: ToolbarItem[] = [
      // Font Family Select
      {
        title: "Font Family",
        isSelect: true,
        selectOptions: [
          { value: "", label: "Font" },
          { value: "Arial, sans-serif", label: "Arial" },
          { value: "'Times New Roman', serif", label: "Times New Roman" },
          { value: "'Courier New', monospace", label: "Courier New" },
          { value: "Georgia, serif", label: "Georgia" },
          { value: "Verdana, sans-serif", label: "Verdana" },
          { value: "'Comic Sans MS', cursive", label: "Comic Sans MS" },
        ],
        command: (state, dispatch, view, value) => {
          if (value) {
            applyMarkWithAttrs(mySchema.marks.fontFamily, {
              fontFamily: value,
            })(state, dispatch);
          }
          return true;
        },
      },
      // Font Size Select
      {
        title: "Font Size",
        isSelect: true,
        selectOptions: [
          { value: "", label: "Size" },
          { value: "12px", label: "12" },
          { value: "14px", label: "14" },
          { value: "16px", label: "16" },
          { value: "18px", label: "18" },
          { value: "20px", label: "20" },
          { value: "24px", label: "24" },
          { value: "28px", label: "28" },
          { value: "32px", label: "32" },
        ],
        command: (state, dispatch, view, value) => {
          if (value) {
            applyMarkWithAttrs(mySchema.marks.fontSize, { fontSize: value })(
              state,
              dispatch,
            );
          }
          return true;
        },
      },
      // Text Color
      {
        title: "Text Color",
        isColorPicker: true,
        colorType: "text",
        command: (state, dispatch, view, value) => {
          applyMarkWithAttrs(mySchema.marks.color, { color: value })(
            state,
            dispatch,
          );
          return true;
        },
      },
      // Background Color
      {
        title: "Highlight Color",
        isColorPicker: true,
        colorType: "background",
        command: (state, dispatch, view, value) => {
          applyMarkWithAttrs(mySchema.marks.backgroundColor, {
            backgroundColor: value,
          })(state, dispatch);
          return true;
        },
      },
      { separator: true },
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

      // Handle select dropdowns
      if (item.isSelect && item.selectOptions) {
        const select = document.createElement("select");
        select.className = "toolbar-select";
        select.title = item.title || "";

        item.selectOptions.forEach((opt) => {
          const option = document.createElement("option");
          option.value = opt.value;
          option.textContent = opt.label;
          select.appendChild(option);
        });

        select.addEventListener("change", (e) => {
          const value = (e.target as HTMLSelectElement).value;
          if (item.command && value) {
            item.command(view.state, view.dispatch, view, value);
            view.focus();
          }
          select.value = ""; // Reset to placeholder
        });

        toolbarRef.current?.appendChild(select);
        return;
      }

      // Handle color pickers
      if (item.isColorPicker) {
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.className = "toolbar-color-picker";
        colorInput.title = item.title || "";
        if (item.colorType === "background") {
          colorInput.value = "#ffff00"; // Default yellow for highlight
        }

        colorInput.addEventListener("change", (e) => {
          const value = (e.target as HTMLInputElement).value;
          if (item.command) {
            item.command(view.state, view.dispatch, view, value);
            view.focus();
          }
        });

        toolbarRef.current?.appendChild(colorInput);
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

    const colorMark: MarkSpec = {
      attrs: { color: { default: null } },
      parseDOM: [
        {
          tag: "span[style*=color]",
          getAttrs: (dom) => {
            const element = dom as HTMLElement;
            const color = element.style.color;
            return color ? { color } : false;
          },
        },
      ],
      toDOM: (mark) => {
        return ["span", { style: `color: ${mark.attrs.color}` }, 0];
      },
    };

    const backgroundColorMark: MarkSpec = {
      attrs: { backgroundColor: { default: null } },
      parseDOM: [
        {
          tag: "span[style*=background-color]",
          getAttrs: (dom) => {
            const element = dom as HTMLElement;
            const backgroundColor = element.style.backgroundColor;
            return backgroundColor ? { backgroundColor } : false;
          },
        },
      ],
      toDOM: (mark) => {
        return [
          "span",
          { style: `background-color: ${mark.attrs.backgroundColor}` },
          0,
        ];
      },
    };

    const fontSizeMark: MarkSpec = {
      attrs: { fontSize: { default: null } },
      parseDOM: [
        {
          tag: "span[style*=font-size]",
          getAttrs: (dom) => {
            const element = dom as HTMLElement;
            const fontSize = element.style.fontSize;
            return fontSize ? { fontSize } : false;
          },
        },
      ],
      toDOM: (mark) => {
        return ["span", { style: `font-size: ${mark.attrs.fontSize}` }, 0];
      },
    };

    const fontFamilyMark: MarkSpec = {
      attrs: { fontFamily: { default: null } },
      parseDOM: [
        {
          tag: "span[style*=font-family]",
          getAttrs: (dom) => {
            const element = dom as HTMLElement;
            const fontFamily = element.style.fontFamily;
            return fontFamily ? { fontFamily } : false;
          },
        },
      ],
      toDOM: (mark) => {
        return ["span", { style: `font-family: ${mark.attrs.fontFamily}` }, 0];
      },
    };

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
      color: colorMark,
      backgroundColor: backgroundColorMark,
      fontSize: fontSizeMark,
      fontFamily: fontFamilyMark,
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

        // Send cursor position when selection changes
        if (onCursorChange && !readOnly && transaction.selectionSet) {
          const position = newState.selection.from;
          onCursorChange(position);
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "70vh",
        border: "1px solid #dee2e6",
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      {!readOnly && <div ref={toolbarRef} style={{ flexShrink: 0 }} />}
      <div
        ref={editorRef}
        style={{
          flex: 1,
          overflowY: "auto",
          background: readOnly ? "#f8f9fa" : "white",
          padding: "20px",
        }}
      />
    </div>
  );
});

ProseMirrorEditor.displayName = "ProseMirrorEditor";

export default ProseMirrorEditor;
