'use client';

import { cn } from '@/lib/utils';
import { Minus, Plus, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const STEP = 0.5;

type Point = { x: number; y: number };

// Fullscreen image viewer with wheel/pinch-free zoom, buttons, double-click
// zoom, and click-drag panning while zoomed. Rendered into a body portal so it
// escapes any chat stacking/overflow context.
export function ImageLightbox({
  src,
  alt,
  open,
  onClose,
}: {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const dragStart = useRef<{ pointer: Point; offset: Point } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => setMounted(true), []);

  // Reset the transform every time the viewer opens (or the image changes).
  useEffect(() => {
    if (open) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [open, src]);

  // Lock body scroll + wire Esc while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const zoomTo = useCallback((next: number) => {
    setScale((prev) => {
      const s = clampScale(next);
      // Recenter when returning to 1× so the image never sits off-screen.
      if (s === 1) setOffset({ x: 0, y: 0 });
      return s;
    });
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? STEP : -STEP;
      zoomTo(scale + delta);
    },
    [scale, zoomTo],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (scale === 1) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragStart.current = { pointer: { x: e.clientX, y: e.clientY }, offset };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.pointer.x;
    const dy = e.clientY - dragStart.current.pointer.y;
    setOffset({
      x: dragStart.current.offset.x + dx,
      y: dragStart.current.offset.y + dy,
    });
  };

  const endDrag = (e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    dragStart.current = null;
    setDragging(false);
  };

  const onDoubleClick = () => zoomTo(scale > 1 ? 1 : 2.5);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      // pointer-events-auto: when opened over a modal (e.g. Radix Dialog sets
      // `pointer-events: none` on <body>), this body-portaled layer would
      // inherit it and go dead — re-enable so the toolbar/backdrop stay usable.
      className='pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm'
      onClick={onClose}
    >
      {/* Toolbar */}
      <div
        className='absolute top-4 right-4 z-10 flex items-center gap-1 rounded-full bg-white/10 p-1 backdrop-blur'
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type='button'
          onClick={() => zoomTo(scale - STEP)}
          disabled={scale <= MIN_SCALE}
          className='grid size-9 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/15 disabled:opacity-40'
          aria-label={t('chat.lightbox.zoomOut')}
        >
          <Minus className='size-4' />
        </button>
        <span className='min-w-12 text-center text-sm text-white/80 tabular-nums'>
          {Math.round(scale * 100)}%
        </span>
        <button
          type='button'
          onClick={() => zoomTo(scale + STEP)}
          disabled={scale >= MAX_SCALE}
          className='grid size-9 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/15 disabled:opacity-40'
          aria-label={t('chat.lightbox.zoomIn')}
        >
          <Plus className='size-4' />
        </button>
        <button
          type='button'
          onClick={() => zoomTo(1)}
          disabled={scale === 1 && offset.x === 0 && offset.y === 0}
          className='grid size-9 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/15 disabled:opacity-40'
          aria-label={t('chat.lightbox.resetZoom')}
        >
          <RotateCcw className='size-4' />
        </button>
        <button
          type='button'
          onClick={onClose}
          className='grid size-9 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/15'
          aria-label={t('chat.lightbox.close')}
        >
          <X className='size-4' />
        </button>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ''}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={onDoubleClick}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transition: dragging ? 'none' : 'transform 0.15s ease-out',
        }}
        className={cn(
          'max-h-[90vh] max-w-[92vw] touch-none rounded-lg object-contain shadow-2xl select-none',
          scale > 1
            ? dragging
              ? 'cursor-grabbing'
              : 'cursor-grab'
            : 'cursor-zoom-in',
        )}
      />
    </div>,
    document.body,
  );
}
