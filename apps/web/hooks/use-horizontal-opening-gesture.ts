'use client';

import type { PointerEventHandler } from 'react';
import { useCallback, useRef, useState } from 'react';
import type { GestureDirection, HorizontalGestureResult } from '@/lib/booster-opening';

interface GestureOptions {
  disabled?: boolean;
  evaluate: (sample: { deltaX: number; elapsedMs: number }) => HorizontalGestureResult;
  onStart?: () => void;
  onProgress?: (progress: number) => void;
  onComplete: (direction: GestureDirection) => void;
  onCancel?: () => void;
}

export function useHorizontalOpeningGesture({
  disabled = false,
  evaluate,
  onStart,
  onProgress,
  onComplete,
  onCancel,
}: GestureOptions) {
  const origin = useRef<{ pointerId: number; x: number; y: number; time: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const reset = useCallback(() => {
    origin.current = null;
    setOffset({ x: 0, y: 0 });
    onProgress?.(0);
  }, [onProgress]);

  const onPointerDown = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      origin.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        time: performance.now(),
      };
      setOffset({ x: 0, y: 0 });
      onStart?.();
    },
    [disabled, onStart],
  );

  const onPointerMove = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      const start = origin.current;
      if (!start || start.pointerId !== event.pointerId) return;
      const next = { x: event.clientX - start.x, y: event.clientY - start.y };
      setOffset(next);
      onProgress?.(
        evaluate({ deltaX: next.x, elapsedMs: performance.now() - start.time }).progress,
      );
    },
    [evaluate, onProgress],
  );

  const finish = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      const start = origin.current;
      if (!start || start.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - start.x;
      const result = evaluate({ deltaX, elapsedMs: performance.now() - start.time });
      origin.current = null;
      if (result.completed) onComplete(result.direction);
      else onCancel?.();
      setOffset({ x: 0, y: 0 });
      onProgress?.(result.completed ? 1 : 0);
    },
    [evaluate, onCancel, onComplete, onProgress],
  );

  const onLostPointerCapture = useCallback(() => {
    if (origin.current) {
      reset();
      onCancel?.();
    }
  }, [onCancel, reset]);

  return {
    offset,
    gestureProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      onLostPointerCapture,
    },
  };
}
