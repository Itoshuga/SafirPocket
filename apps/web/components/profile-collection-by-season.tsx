'use client';

import type {
  CollectionVisibility,
  ProfilePermissions,
  ProfileSeasonCollectionSummary,
  SeasonCollectionCardItem,
} from '@safir/shared-types';
import { Button, ErrorState, Panel, Progress, Skeleton } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { profileSeasonCollectionHref } from '@/lib/profile-routes';
import { queryKeys } from '@/lib/query-keys';
import { BoosterArtwork } from './booster-artwork';
import { TcgCard } from './tcg-card';

export function ProfileCollectionBySeason({
  username,
  ownProfile,
  visibility = 'PUBLIC',
  permissions,
}: {
  username: string;
  ownProfile: boolean;
  visibility?: CollectionVisibility;
  permissions?: ProfilePermissions;
}) {
  const canView = ownProfile || Boolean(permissions?.canViewCollection);
  const ownerKey = ownProfile ? 'me' : username;
  const summaries = useQuery({
    queryKey: queryKeys.profileSeasonCollections(ownerKey),
    queryFn: () =>
      apiFetch<ProfileSeasonCollectionSummary[]>(
        ownProfile
          ? '/api/v1/me/collection/seasons'
          : `/api/v1/users/${encodeURIComponent(username)}/collection/seasons`,
      ),
    enabled: canView,
  });

  return (
    <section id="collection" aria-labelledby="collection-title" className="scroll-mt-20 pt-2">
      <div className="mb-2 border-b border-border pb-5">
        <p className="text-xs font-semibold text-primary">Cartes du joueur</p>
        <h2 id="collection-title" className="mt-1 text-xl font-semibold text-foreground">
          Collection
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {ownProfile
            ? 'Retrouvez votre progression et vos cartes pour chaque saison.'
            : `Découvrez la progression de @${username} à travers les saisons de Safir.`}
        </p>
      </div>
      {!canView ? (
        <Panel className="my-6 py-10 text-center" role="status">
          <LockKeyhole className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {visibility === 'FRIENDS'
              ? 'Cette collection est visible uniquement par ses amis.'
              : 'La collection de cet utilisateur est privée.'}
          </p>
        </Panel>
      ) : null}
      {canView && summaries.isLoading ? <SeasonCollectionBlocksSkeleton /> : null}
      {canView && summaries.isError ? (
        <ErrorState
          message="Impossible de charger les collections par saison."
          action={
            <Button variant="outline" size="sm" onClick={() => void summaries.refetch()}>
              Réessayer
            </Button>
          }
        />
      ) : null}
      {canView && summaries.data?.length === 0 ? (
        <p className="py-10 text-sm text-muted-foreground">Aucune saison publiée.</p>
      ) : null}
      {summaries.data?.map((summary) => (
        <ProfileSeasonCollectionBlock
          key={summary.season.id}
          summary={summary}
          username={username}
          ownProfile={ownProfile}
        />
      ))}
    </section>
  );
}

export function ProfileSeasonCollectionBlock({
  summary,
  username,
  ownProfile,
}: {
  summary: ProfileSeasonCollectionSummary;
  username: string;
  ownProfile: boolean;
}) {
  const { season, collection, previewCards } = summary;
  const href = profileSeasonCollectionHref({ username, seasonSlug: season.slug, ownProfile });
  return (
    <article className="border-b border-border py-7 first:border-t">
      <div className="flex items-start gap-4">
        <BoosterArtwork
          imageUrl={season.imageUrl}
          name={`Visuel de ${season.name}`}
          className="hidden h-20 w-16 shrink-0 rounded-md border border-border sm:block"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-primary">{season.code ?? 'Saison Safir'}</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">{season.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {collection.uniqueOwnedCards} carte
                {collection.uniqueOwnedCards > 1 ? 's' : ''} possédée
                {collection.uniqueOwnedCards > 1 ? 's' : ''}
                {collection.totalAvailableCards !== undefined
                  ? ` sur ${collection.totalAvailableCards}`
                  : ''}
                {collection.totalCopies !== undefined
                  ? ` · ${collection.totalCopies} exemplaire${collection.totalCopies > 1 ? 's' : ''}`
                  : ''}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={href} aria-label={`Explorer la collection de la saison ${season.name}`}>
                Explorer la collection <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          {collection.completionPercentage !== undefined ? (
            <Progress
              value={collection.completionPercentage}
              label={`Progression de ${season.name}`}
            />
          ) : null}
        </div>
      </div>
      {previewCards.length ? (
        <SeasonCollectionPreview cards={previewCards} />
      ) : ownProfile ? (
        <div className="mt-5 border-l-2 border-primary-soft py-2 pl-4">
          <p className="text-sm text-muted-foreground">Aucune carte obtenue pour cette saison.</p>
          <Button asChild variant="ghost" size="sm" className="mt-1">
            <Link href="/boosters">Découvrir les boosters</Link>
          </Button>
        </div>
      ) : null}
    </article>
  );
}

export function SeasonCollectionPreview({ cards }: { cards: SeasonCollectionCardItem[] }) {
  return (
    <div
      className="mt-5 grid grid-cols-3 gap-3 min-[430px]:grid-cols-4 md:grid-cols-6 xl:grid-cols-8"
      aria-label="Aperçu des cartes de la saison"
    >
      {cards.map((item) => {
        const variant = item.ownedVariants[0];
        return (
          <TcgCard
            key={item.card.id}
            card={{
              ...item.card,
              artworkPath: variant?.artworkPath ?? item.card.imageUrl ?? item.card.artworkPath,
            }}
            mode="collection"
            variantName={variant?.name}
            quantity={item.quantity}
          />
        );
      })}
    </div>
  );
}

function SeasonCollectionBlocksSkeleton() {
  return (
    <div aria-label="Chargement des saisons">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="border-b border-border py-7 first:border-t">
          <Skeleton className="h-20 w-full" />
          <div className="mt-5 grid grid-cols-3 gap-3 md:grid-cols-6 xl:grid-cols-8">
            {Array.from({ length: 6 }, (_, cardIndex) => (
              <Skeleton key={cardIndex} className="aspect-[5/8]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
