/**
 * @fileoverview Drag-to-move and edge-resize behaviour for the floating
 * player, with mouse and touch handled the same way.
 */

'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export type ResizeEdge = 'left' | 'right' | 'bottom-left' | 'bottom-right';

export interface DragResizeOptions {
  minWidth?: number;
  maxWidth?: number;
}

export function useDragResize(
  containerRef: RefObject<HTMLDivElement | null>,
  { minWidth = 256, maxWidth = 800 }: DragResizeOptions = {},
) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const [playerWidth, setPlayerWidth] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  const resizeEdgeRef = useRef<ResizeEdge | null>(null);
  const resizeStartRef = useRef({ x: 0, width: 0, posX: 0 });

  const startDrag = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      dragOffsetRef.current = { x: clientX - rect.left, y: clientY - rect.top };
      // Switch from the CSS-anchored default position to explicit coordinates.
      setPosition({ x: rect.left, y: rect.top });
      isDraggingRef.current = true;
      setIsDragging(true);
    },
    [containerRef],
  );

  const startResize = useCallback(
    (clientX: number, _clientY: number, edge: ResizeEdge) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (!position) setPosition({ x: rect.left, y: rect.top });
      resizeStartRef.current = { x: clientX, width: el.offsetWidth, posX: rect.left };
      resizeEdgeRef.current = edge;
      isResizingRef.current = true;
      setIsResizing(true);
    },
    [containerRef, position],
  );

  const clampPosition = useCallback(
    (x: number, y: number) => {
      const el = containerRef.current;
      if (!el) return { x, y };
      return {
        x: Math.max(0, Math.min(window.innerWidth - el.offsetWidth, x)),
        y: Math.max(0, Math.min(window.innerHeight - el.offsetHeight, y)),
      };
    },
    [containerRef],
  );

  useEffect(() => {
    const applyResize = (clientX: number) => {
      const edge = resizeEdgeRef.current;
      const { x: startX, width: startWidth, posX: startPosX } = resizeStartRef.current;
      const dx = clientX - startX;
      // Dragging a left edge outward grows the player leftwards, so the widget
      // has to move by however much it grew to keep its right edge pinned.
      const isLeft = edge === 'left' || edge === 'bottom-left';
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + (isLeft ? -dx : dx)));
      setPlayerWidth(newWidth);
      if (isLeft) {
        setPosition((prev) => (prev ? { x: startPosX + (startWidth - newWidth), y: prev.y } : prev));
      }
    };

    const endGesture = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        resizeEdgeRef.current = null;
        setIsResizing(false);
        return;
      }
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingRef.current) {
        applyResize(e.clientX);
        return;
      }
      if (!isDraggingRef.current) return;
      setPosition(clampPosition(e.clientX - dragOffsetRef.current.x, e.clientY - dragOffsetRef.current.y));
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      if (isResizingRef.current) {
        applyResize(touch.clientX);
        e.preventDefault();
        return;
      }
      if (!isDraggingRef.current) return;
      setPosition(clampPosition(touch.clientX - dragOffsetRef.current.x, touch.clientY - dragOffsetRef.current.y));
      e.preventDefault();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', endGesture);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', endGesture);
    document.addEventListener('touchcancel', endGesture);
    // A release the page never sees (focus stolen mid-drag) would otherwise
    // leave the gesture — and the resize shield over the player — stuck on.
    window.addEventListener('blur', endGesture);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', endGesture);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', endGesture);
      document.removeEventListener('touchcancel', endGesture);
      window.removeEventListener('blur', endGesture);
    };
  }, [clampPosition, minWidth, maxWidth]);

  return { position, isDragging, isResizing, playerWidth, startDrag, startResize };
}
