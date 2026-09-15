/**
 * @fileoverview Invisible grab strips along the player's edges and bottom
 * corners that start a resize gesture.
 */

'use client';

import type { ResizeEdge } from './useDragResize';

interface PlayerResizeHandlesProps {
  isResizing: boolean;
  startResize: (clientX: number, clientY: number, edge: ResizeEdge) => void;
}

const HANDLES: Array<{ edge: ResizeEdge; className: string }> = [
  { edge: 'left', className: 'eytp-handle eytp-handle-left' },
  { edge: 'right', className: 'eytp-handle eytp-handle-right' },
  { edge: 'bottom-left', className: 'eytp-handle eytp-handle-bl' },
  { edge: 'bottom-right', className: 'eytp-handle eytp-handle-br' },
];

export function PlayerResizeHandles({ isResizing, startResize }: PlayerResizeHandlesProps) {
  return (
    <>
      {isResizing && <div className="eytp-resize-shield" />}
      {HANDLES.map(({ edge, className }) => (
        <div
          key={edge}
          className={className}
          onMouseDown={(e) => {
            e.preventDefault();
            startResize(e.clientX, e.clientY, edge);
          }}
          onTouchStart={(e) => startResize(e.touches[0].clientX, e.touches[0].clientY, edge)}
        />
      ))}
    </>
  );
}
