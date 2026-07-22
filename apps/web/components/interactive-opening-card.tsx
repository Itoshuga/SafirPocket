'use client';

import type { PackOpeningCard } from '@safir/shared-types';
import { Badge, Button, cn } from '@safir/ui';
import { ArrowRight } from 'lucide-react';
import { useHorizontalOpeningGesture } from '@/hooks/use-horizontal-opening-gesture';
import { evaluateCardGesture, type GestureDirection, rarityEmphasis } from '@/lib/booster-opening';
import { CardImage } from './card-image';

export function InteractiveOpeningCard({
  item,
  index,
  transitioning,
  transitionDirection,
  reducedMotion,
  onAdvance,
}: {
  item: PackOpeningCard;
  index: number;
  transitioning: boolean;
  transitionDirection: GestureDirection;
  reducedMotion: boolean;
  onAdvance: (direction: GestureDirection) => void;
}) {
  const gesture = useHorizontalOpeningGesture({
    disabled: transitioning,
    evaluate: evaluateCardGesture,
    onComplete: onAdvance,
  });
  const emphasis = rarityEmphasis(item);
  const transitionX = transitioning ? transitionDirection * 120 : 0;
  const x = transitionX + (transitioning ? 0 : gesture.offset.x);
  const y = transitioning ? 8 : gesture.offset.y * 0.2;
  const rotateY = transitioning || reducedMotion ? 0 : gesture.offset.x / 18;
  const rotateX = transitioning || reducedMotion ? 0 : -gesture.offset.y / 24;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[min(64vw,18rem)] [perspective:1200px] sm:w-[19rem]">
        {[2, 1].map((depth) => (
          <div
            key={depth}
            aria-hidden="true"
            className="absolute inset-0 rounded-md border border-border-strong bg-surface-muted shadow-card"
            style={{ transform: `translateY(${depth * 6}px) scale(${1 - depth * 0.018})` }}
          />
        ))}
        <div
          role="button"
          tabIndex={0}
          data-testid="opening-card"
          data-card-index={index}
          data-emphasis={emphasis}
          aria-label={`${item.card.name}, carte ${index + 1} sur 8. Faites glisser ou utilisez le bouton suivant.`}
          className={cn(
            'relative touch-none select-none rounded-md border bg-surface p-2 shadow-dialog outline-none transition-[transform,opacity] duration-300 focus-visible:ring-2 focus-visible:ring-focus-ring motion-reduce:transition-none',
            emphasis === 'neutral' && 'border-border-strong',
            emphasis === 'premium' && 'border-primary shadow-[0_18px_48px_rgb(31_95_196_/_18%)]',
            emphasis === 'exceptional' &&
              'border-success shadow-[0_18px_48px_rgb(19_122_75_/_20%)]',
            transitioning && 'opacity-0',
          )}
          style={{
            transform: `translate3d(${x}px, ${y}px, 0) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`,
          }}
          {...gesture.gestureProps}
        >
          <CardImage
            artworkPath={item.variant.artworkPath ?? item.card.imageUrl}
            alt={item.card.name}
            priority
            className="w-full"
          />
          <div className="flex min-w-0 items-start justify-between gap-3 px-1 pb-1 pt-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{item.card.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                #{item.card.number} · {item.rarity.name}
              </p>
            </div>
            <Badge tone={item.slotCategory === 'PREMIUM' ? 'primary' : 'neutral'}>
              {item.slotCategory === 'PREMIUM' ? 'Premium' : 'Commune'}
            </Badge>
          </div>
        </div>
      </div>
      <p className="mt-5 text-sm text-muted-foreground">
        Glissez dans une direction pour passer à la carte suivante
      </p>
      <Button
        className="mt-3"
        onClick={() => onAdvance(1)}
        disabled={transitioning}
        data-testid="next-card-button"
      >
        {index === 7 ? 'Voir le récapitulatif' : 'Carte suivante'}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
