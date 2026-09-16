'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Point = { x: number; y: number };

export type SignaturePadHandle = {
  isEmpty: () => boolean;
  toPngBlob: () => Promise<Blob | null>;
  clear: () => void;
};

type SignaturePadProps = {
  onEmptyChange?: (empty: boolean) => void;
  className?: string;
  clearLabel: string;
  undoLabel: string;
  hintLabel: string;
};

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  { onEmptyChange, className, clearLabel, undoLabel, hintLabel },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const strokes = useRef<Point[][]>([]);
  const current = useRef<Point[]>([]);
  const [revision, setRevision] = useState(0);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const nextW = Math.round(rect.width * dpr);
    const nextH = Math.round(rect.height * dpr);
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const styles = getComputedStyle(canvas);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = styles.getPropertyValue('--color-surface').trim() || 'white';
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.strokeStyle = styles.getPropertyValue('--color-border').trim() || 'gray';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, rect.height * 0.72);
    ctx.lineTo(rect.width - 24, rect.height * 0.72);
    ctx.stroke();

    ctx.strokeStyle = styles.getPropertyValue('--color-text-primary').trim() || 'black';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const paint = (stroke: Point[]) => {
      if (stroke.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0]!.x, stroke[0]!.y);
      for (let i = 1; i < stroke.length; i += 1) {
        ctx.lineTo(stroke[i]!.x, stroke[i]!.y);
      }
      ctx.stroke();
    };

    for (const stroke of strokes.current) paint(stroke);
    paint(current.current);
  }, []);

  const bump = () => setRevision((n) => n + 1);

  useEffect(() => {
    redraw();
    onEmptyChange?.(strokes.current.length === 0);
  }, [onEmptyChange, redraw, revision]);

  useEffect(() => {
    const onResize = () => redraw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [redraw]);

  const clear = () => {
    strokes.current = [];
    current.current = [];
    bump();
  };

  useImperativeHandle(ref, () => ({
    isEmpty: () => strokes.current.length === 0,
    clear,
    toPngBlob: () => {
      const canvas = canvasRef.current;
      if (!canvas) return Promise.resolve(null);
      redraw();
      return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
    },
  }));

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  return (
    <div className={cn('space-y-sm', className)}>
      <p className="t-caption text-text-secondary">{hintLabel}</p>
      <canvas
        ref={canvasRef}
        className="h-40 w-full touch-none rounded-md border border-border bg-surface"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drawing.current = true;
          current.current = [pointFromEvent(event)];
          bump();
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          current.current.push(pointFromEvent(event));
          bump();
        }}
        onPointerUp={() => {
          if (!drawing.current) return;
          drawing.current = false;
          if (current.current.length > 1) strokes.current.push(current.current);
          current.current = [];
          bump();
        }}
        onPointerCancel={() => {
          drawing.current = false;
          current.current = [];
          bump();
        }}
        aria-label={hintLabel}
      />
      <div className="flex flex-wrap gap-sm">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            strokes.current.pop();
            bump();
          }}
        >
          {undoLabel}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          {clearLabel}
        </Button>
      </div>
    </div>
  );
});
