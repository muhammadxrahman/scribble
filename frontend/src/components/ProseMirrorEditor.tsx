'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema, DOMParser, DOMSerializer } from 'prosemirror-model';
import { schema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { exampleSetup } from 'prosemirror-example-setup';

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
        plugins: readOnly ? [] : exampleSetup({ schema: mySchema })
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
      <div 
        ref={editorRef}
        style={{
          minHeight: '70vh',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          background: readOnly ? '#f8f9fa' : 'white'
        }}
      />
    );
  }
);

ProseMirrorEditor.displayName = 'ProseMirrorEditor';

export default ProseMirrorEditor;