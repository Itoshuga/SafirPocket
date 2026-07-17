import type { CardSummary } from '@safir/shared-types';
import { Badge, Card } from '@safir/ui';
import Link from 'next/link';
import { CardImage } from './card-image';

const rarityTone = (rarity: string): 'neutral' | 'primary' | 'warning' => {
  const value = rarity.toLowerCase();
  if (value.includes('rare') || value.includes('legend')) return 'warning';
  if (value.includes('uncommon') || value.includes('inhabit')) return 'primary';
  return 'neutral';
};

export function TcgCard({
  card,
  mode = 'grid',
  variantName,
  quantity,
  lockedQuantity,
}: {
  card: CardSummary;
  mode?: 'grid' | 'compact' | 'collection' | 'deck' | 'detail';
  variantName?: string;
  quantity?: number;
  lockedQuantity?: number;
}) {
  if (mode === 'compact' || mode === 'deck') {
    return (
      <Link
        href={`/cards/${card.id}`}
        className="group flex min-w-0 items-center gap-3 rounded-md p-2 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <CardImage
          artworkPath={card.artworkPath}
          alt={`Illustration de ${card.name}`}
          className="w-12 shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{card.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {variantName ?? card.set?.code ?? card.cardType} · {card.collectionNumber}
          </span>
        </span>
        {quantity !== undefined ? (
          <span className="text-sm font-semibold">× {quantity}</span>
        ) : null}
      </Link>
    );
  }
  return (
    <Link href={`/cards/${card.id}`} className="group block h-full focus-visible:outline-none">
      <Card className="h-full p-2 transition-colors group-hover:border-border-strong group-focus-visible:ring-2 group-focus-visible:ring-focus-ring motion-reduce:transition-none">
        <CardImage artworkPath={card.artworkPath} alt={`Illustration de ${card.name}`} />
        <div className="px-1 pb-1 pt-3">
          <div className="flex items-start justify-between gap-2">
            <Badge tone={rarityTone(card.rarity)}>{card.rarity}</Badge>
            {card.cost !== null ? (
              <span
                className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary"
                aria-label={`Coût ${card.cost}`}
              >
                {card.cost}
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 truncate text-sm font-semibold text-foreground">{card.name}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {card.set?.code ? `${card.set.code} · ` : ''}
            {card.collectionNumber} · {card.cardType}
          </p>
          {mode === 'collection' ? (
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs">
              <span className="truncate text-muted-foreground">{variantName}</span>
              <span className="shrink-0 font-semibold text-foreground">
                × {quantity ?? 0}
                {lockedQuantity ? (
                  <span className="ml-1 text-muted-foreground">
                    ({lockedQuantity} réservée{lockedQuantity > 1 ? 's' : ''})
                  </span>
                ) : null}
              </span>
            </div>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}
