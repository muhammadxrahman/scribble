'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorState, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema, DOMParser, DOMSerializer } from 'prosemirror-model';
import { schema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { keymap } from 'prosemirror-keymap';
import { history, undo, redo } from 'prosemirror-history';
import { baseKeymap, toggleMark, setBlockType, wrapIn } from 'prosemirror-commands';
import { wrapInList, liftListItem, sinkListItem } from 'prosemirror-schema-list';

interface ProseMirrorEditorProps {
  content: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
}

export interface ProseMirrorEditorRef {
  updateContent: (newContent: string) => void;
}

const ProseMirrorEditor = forwardRef<ProseMirrorEditorRef, ProseMirrorEditorProps>(
  ({ content, onChange, readOnly = false }, ref) => {
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
        const contentElement = document.createElement('div');
        contentElement.innerHTML = newContent || '<p></p>';
        const doc = DOMParser.fromSchema(schemaRef.current).parse(contentElement);
        
        // Update editor state
        const newState = EditorState.create({
          doc,
          plugins: viewRef.current.state.plugins
        });
        
        viewRef.current.updateState(newState);
        
        isUpdatingRef.current = false;
      }
    }));

    // Create toolbar
const createToolbar = (view: EditorView, mySchema: Schema) => {
  if (!toolbarRef.current || readOnly) return;

  toolbarRef.current.innerHTML = '';
  toolbarRef.current.className = 'prosemirror-toolbar';

  type ToolbarItem = {
    separator?: boolean;
    title?: string;
    content?: string;
    className?: string;
    command?: (state: any, dispatch: any, view: any) => boolean;
  };

  const buttons: ToolbarItem[] = [
    {
      title: 'Bold',
      content: 'B',
      className: 'toolbar-btn bold',
      command: toggleMark(mySchema.marks.strong)
    },
    {
      title: 'Italic',
      content: 'I',
      className: 'toolbar-btn italic',
      command: toggleMark(mySchema.marks.em)
    },
    {
      title: 'Code',
      content: '</>',
      className: 'toolbar-btn',
      command: toggleMark(mySchema.marks.code)
    },
    {
      title: 'Heading 1',
      content: 'H1',
      className: 'toolbar-btn',
      command: setBlockType(mySchema.nodes.heading, { level: 1 })
    },
    {
      title: 'Heading 2',
      content: 'H2',
      className: 'toolbar-btn',
      command: setBlockType(mySchema.nodes.heading, { level: 2 })
    },
    {
      title: 'Paragraph',
      content: 'P',
      className: 'toolbar-btn',
      command: setBlockType(mySchema.nodes.paragraph)
    },
    {
      title: 'Bullet List',
      content: '•',
      className: 'toolbar-btn',
      command: wrapInList(mySchema.nodes.bullet_list)
    },
    {
      title: 'Ordered List',
      content: '1.',
      className: 'toolbar-btn',
      command: wrapInList(mySchema.nodes.ordered_list)
    },
    {
      title: 'Blockquote',
      content: '"',
      className: 'toolbar-btn',
      command: wrapIn(mySchema.nodes.blockquote)
    },
    { separator: true },
    {
      title: 'Undo',
      content: '↶',
      className: 'toolbar-btn',
      command: undo
    },
    {
      title: 'Redo',
      content: '↷',
      className: 'toolbar-btn',
      command: redo
    },
  ];

  buttons.forEach((item) => {
    if (item.separator) {
      const separator = document.createElement('span');
      separator.className = 'toolbar-separator';
      toolbarRef.current?.appendChild(separator);
      return;
    }

    const button = document.createElement('button');
    button.className = item.className || '';
    button.title = item.title || '';
    button.textContent = item.content || '';
    button.type = 'button';

    button.addEventListener('mousedown', (e) => {
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

      // Create schema with lists
      const mySchema = new Schema({
        nodes: addListNodes(schema.spec.nodes, 'paragraph block*', 'block'),
        marks: schema.spec.marks
      });

      schemaRef.current = mySchema;

      // Parse initial content from HTML
      const contentElement = document.createElement('div');
      contentElement.innerHTML = content || '<p></p>';
      const doc = DOMParser.fromSchema(mySchema).parse(contentElement);

      // Create editor state
      const state = EditorState.create({
        doc,
        plugins: [
          history(),
          keymap({
            'Mod-z': undo,
            'Mod-y': redo,
            'Mod-Shift-z': redo,
            'Mod-b': toggleMark(mySchema.marks.strong),
            'Mod-i': toggleMark(mySchema.marks.em),
            'Mod-`': toggleMark(mySchema.marks.code),
          }),
          keymap(baseKeymap),
        ]
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
        }
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
          editable: () => !readOnly
        });
      }
    }, [readOnly]);

    // Helper to convert ProseMirror state to HTML
    const getHTMLFromState = (state: EditorState, schema: Schema): string => {
      const div = document.createElement('div');
      const fragment = state.doc.content;
      const serializer = DOMSerializer.fromSchema(schema);
      div.appendChild(serializer.serializeFragment(fragment));
      return div.innerHTML;
    };

    return (
      <div>
        {!readOnly && <div ref={toolbarRef} />}
        <div 
          ref={editorRef}
          style={{
            minHeight: '70vh',
            border: '1px solid #dee2e6',
            borderRadius: readOnly ? '4px' : '0 0 4px 4px',
            background: readOnly ? '#f8f9fa' : 'white'
          }}
        />
      </div>
    );
  }
);

ProseMirrorEditor.displayName = 'ProseMirrorEditor';

export default ProseMirrorEditor;