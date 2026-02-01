'use client';

import { useEffect, useState, useRef } from 'react';
import { EditorView } from 'prosemirror-view';

interface RemoteCursorProps {
  position: number;
  username: string;
  color: string;
  editorView: EditorView | null;
}

export default function RemoteCursor({ position, username, color, editorView }: RemoteCursorProps) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editorView) return;

    const updatePosition = () => {
      try {
        // Get pixel coordinates from document position
        const domCoords = editorView.coordsAtPos(position);
        
        // Get the editor's parent container (the scrollable div)
        const scrollContainer = editorView.dom.parentElement;
        if (!scrollContainer) return;
        
        // Get bounding rectangles
        const containerRect = scrollContainer.getBoundingClientRect();
        
        // Calculate position relative to the scrollable container
        // Add ~25px to move it down one line (16px font * 1.6 line-height ≈ 25.6px)
        setCoords({
          top: domCoords.top - containerRect.top + scrollContainer.scrollTop + 26,
          left: domCoords.left - containerRect.left,
        });
      } catch (error) {
        setCoords(null);
      }
    };

    updatePosition();

    // Update on scroll
    const scrollContainer = editorView.dom.parentElement;
    scrollContainer?.addEventListener('scroll', updatePosition);

    return () => {
      scrollContainer?.removeEventListener('scroll', updatePosition);
    };
  }, [position, editorView]);

  if (!coords) return null;

  return (
    <div
      ref={cursorRef}
      style={{
        position: 'absolute',
        top: coords.top + 'px',
        left: coords.left + 'px',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      {/* Cursor line - match ProseMirror line height */}
      <div
        style={{
          width: '2px',
          height: '1.6em',
          backgroundColor: color,
          animation: 'cursor-blink 1s infinite',
        }}
      />
      
      {/* Username label */}
      <div
        style={{
          position: 'absolute',
          top: '-26px',
          left: '-2px',
          backgroundColor: color,
          color: 'white',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '11px',
          fontWeight: '500',
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      >
        {username}
      </div>
    </div>
  );
}