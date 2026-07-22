'use client';

import type { PackOpening } from '@safir/shared-types';
import { Badge, Button, Dialog } from '@safir/ui';
import { Check, History, PackageOpen } from 'lucide-react';
import Link from 'next/link';
import { CardImage } from './card-image';

export function BoosterOpeningRecapList({ opening }: { opening: PackOpening }) {
  return (
    <ol className="divide-y divide-border rounded-md border border-border bg-surface">
      {opening.cards.map((item) => (
        <li
          key={item.slotPosition}
          data-slot-category={item.slotCategory}
          className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 p-3"
        >
          <CardImage
            artworkPath={item.variant.artworkPath ?? item.card.imageUrl}
            alt={item.card.name}
            className="w-[3.25rem] rounded-sm"
          />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-semibold">{item.card.name}</p>
              {item.isNew ? <Badge tone="success">Nouvelle</Badge> : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              #{item.card.number} · {item.rarity.name} ·{' '}
              {item.slotCategory === 'PREMIUM' ? 'Premium' : 'Commune'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-foreground">
              {item.previousQuantity} -&gt; {item.newQuantity}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Carte {item.slotPosition}/8</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function BoosterOpeningRecap({
  opening,
  open,
  onOpenChange,
}: {
  opening: PackOpening;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Ouverture terminée"
      description={`${opening.booster.name} · ${opening.booster.season.name} · 8 cartes enregistrées`}
      footer={
        <>
          <Button asChild variant="ghost">
            <Link href="/boosters/history">
              <Check className="size-4" aria-hidden="true" />
              Terminer
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/profile/collection/${encodeURIComponent(opening.booster.season.slug)}`}>
              <History className="size-4" aria-hidden="true" />
              Voir mon profil
            </Link>
          </Button>
          <Button asChild>
            <Link href="/boosters">
              <PackageOpen className="size-4" aria-hidden="true" />
              Ouvrir un autre
            </Link>
          </Button>
        </>
      }
    >
      <BoosterOpeningRecapList opening={opening} />
    </Dialog>
  );
}
