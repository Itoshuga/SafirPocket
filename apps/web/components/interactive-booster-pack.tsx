'use client';

import { Button, cn } from '@safir/ui';
import { Scissors } from 'lucide-react';
import { useHorizontalOpeningGesture } from '@/hooks/use-horizontal-opening-gesture';
import { evaluateCutGesture } from '@/lib/booster-opening';
import { TransparentBoosterArtwork } from './booster-artwork';

export function InteractiveBoosterPack({
  imageUrl,
  name,
  cutProgress,
  opened,
  disabled,
  reducedMotion,
  onCutStart,
  onCutProgress,
  onCutCancel,
  onCutComplete,
}: {
  imageUrl: string | null;
  name: string;
  cutProgress: number;
  opened: boolean;
  disabled: boolean;
  reducedMotion: boolean;
  onCutStart: () => void;
  onCutProgress: (progress: number) => void;
  onCutCancel: () => void;
  onCutComplete: () => void;
}) {
  const gesture = useHorizontalOpeningGesture({
    disabled,
    evaluate: evaluateCutGesture,
    onStart: onCutStart,
    onProgress: onCutProgress,
    onCancel: onCutCancel,
    onComplete: onCutComplete,
  });
  const topOffset = opened ? 180 : gesture.offset.x * 0.08;
  const topRotation = opened ? 14 : gesture.offset.x * 0.015;

  return (
    <div className="flex flex-col items-center">
      <div
        data-testid="interactive-booster-pack"
        className="relative w-[min(78vw,calc(65dvh*2/3),380px)] touch-none select-none bg-transparent [aspect-ratio:2/3] lg:w-[min(34vw,calc(72dvh*2/3),480px)]"
        style={{ perspective: '1200px' }}
      >
        <div
          data-testid="booster-pack-visual"
          className="absolute inset-0 bg-transparent [filter:drop-shadow(var(--shadow-booster))]"
        >
          <div
            className={cn(
              'absolute inset-0 bg-transparent transition duration-500 motion-reduce:transition-none',
              opened && 'translate-y-4 opacity-80',
            )}
            style={{ clipPath: 'inset(18% 0 0 0)' }}
          >
            <TransparentBoosterArtwork imageUrl={imageUrl} name={name} priority />
          </div>
          <div
            className={cn(
              'absolute inset-0 origin-bottom bg-transparent transition duration-500 motion-reduce:transition-none',
              gesture.offset.x !== 0 && 'will-change-transform',
            )}
            style={{
              clipPath: 'inset(0 0 82% 0)',
              transform: `translate3d(${topOffset}px, ${opened ? -28 : 0}px, 24px) rotate(${topRotation}deg)`,
              opacity: opened && reducedMotion ? 0 : 1,
            }}
          >
            <TransparentBoosterArtwork
              imageUrl={imageUrl}
              name={`${name}, partie supérieure`}
              priority
            />
          </div>
        </div>
        <div
          data-testid="booster-cut-zone"
          aria-label="Zone de découpe du booster"
          className={cn(
            'absolute inset-x-[-2.5rem] top-[calc(18%_-_2rem)] z-10 h-16 cursor-ew-resize touch-none',
            disabled && 'pointer-events-none',
          )}
          {...gesture.gestureProps}
        >
          <div className="absolute inset-x-10 top-1/2 h-px -translate-y-1/2 bg-border-strong" />
          <div
            className="absolute left-10 top-1/2 h-1 -translate-y-1/2 rounded-sm bg-primary transition-[width] motion-reduce:transition-none"
            style={{ width: `calc((100% - 5rem) * ${cutProgress})` }}
          />
          <span
            className="absolute top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md border border-border bg-surface text-primary shadow-control"
            style={{ left: `calc(2.5rem + (100% - 5rem) * ${cutProgress} - 1.125rem)` }}
          >
            <Scissors className="size-4" aria-hidden="true" />
          </span>
        </div>
      </div>
      <p
        data-testid="booster-cut-instruction"
        className="mt-4 text-center text-sm font-medium text-foreground"
      >
        Faites glisser horizontalement sur le haut du booster
      </p>
      <Button
        className="mt-3"
        variant="outline"
        onClick={onCutComplete}
        disabled={disabled}
        data-testid="open-booster-button"
      >
        <Scissors className="size-4" aria-hidden="true" />
        Ouvrir le booster
      </Button>
    </div>
  );
}
