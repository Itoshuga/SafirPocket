import type { ProfileGameStats, ProfileStats } from '@safir/shared-types';
import { Button, Skeleton } from '@safir/ui';
import Link from 'next/link';

export interface ProfileStatItemProps {
  label: string;
  value: number | string;
  href?: string;
  ariaLabel?: string;
}

const formatNumber = (value: number) => new Intl.NumberFormat('fr-FR').format(value);
const formatPercentage = (value: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value);

export function ProfileStatItem({ label, value, href, ariaLabel }: ProfileStatItemProps) {
  const content = (
    <>
      <span className="block break-words text-xl font-semibold text-foreground sm:text-2xl">
        {typeof value === 'number' ? formatNumber(value) : value}
      </span>
      <span className="mt-1 block text-xs font-medium text-muted-foreground sm:text-sm">
        {label}
      </span>
    </>
  );

  return href ? (
    <Link
      href={href}
      aria-label={ariaLabel ?? `${label} : ${value}`}
      className="block min-h-16 rounded-sm px-4 py-4 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring motion-reduce:transition-none sm:min-h-20 sm:px-6 sm:py-5"
    >
      {content}
    </Link>
  ) : (
    <div className="min-h-16 px-4 py-4 sm:min-h-20 sm:px-6 sm:py-5">{content}</div>
  );
}

export function ProfileStatsBar({ items }: { items: ProfileStatItemProps[] }) {
  const visibleItems = items.slice(0, 4);
  const desktopColumns =
    {
      1: 'sm:grid-cols-1',
      2: 'sm:grid-cols-2',
      3: 'sm:grid-cols-3',
      4: 'sm:grid-cols-4',
    }[visibleItems.length] ?? 'sm:grid-cols-1';

  return (
    <ul
      className={`grid grid-cols-2 ${desktopColumns}`}
      data-testid="profile-stats-bar"
      aria-label="Statistiques principales du profil"
    >
      {visibleItems.map((item, index) => (
        <li
          key={item.label}
          className={`${index % 2 ? 'border-l border-border' : ''} ${index >= 2 ? 'border-t border-border sm:border-t-0' : ''} ${index > 0 ? 'sm:border-l sm:border-border' : 'sm:border-l-0'}`}
        >
          <ProfileStatItem {...item} />
        </li>
      ))}
    </ul>
  );
}

export function CollectionProgressOverview({
  uniqueCardsCount,
  totalAvailableCardsCount,
  missingCardsCount,
  completionPercentage,
  ownProfile,
}: {
  uniqueCardsCount: number;
  totalAvailableCardsCount: number;
  missingCardsCount: number;
  completionPercentage: number;
  ownProfile: boolean;
}) {
  const safePercentage = Math.max(0, Math.min(100, completionPercentage));
  const accessibleLabel = `Progression de la collection : ${formatPercentage(safePercentage)} %, soit ${formatNumber(uniqueCardsCount)} cartes uniques possédées sur ${formatNumber(totalAvailableCardsCount)}.`;

  return (
    <div className="border-t border-border px-4 py-5 sm:px-6">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-semibold text-foreground">Progression de la collection</h3>
        <span className="shrink-0 text-sm font-semibold text-foreground">
          {formatPercentage(safePercentage)} %
        </span>
      </div>
      <div className="mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground sm:flex-row sm:gap-2">
        <span>
          {formatNumber(uniqueCardsCount)} carte{uniqueCardsCount > 1 ? 's' : ''} unique
          {uniqueCardsCount > 1 ? 's' : ''} sur {formatNumber(totalAvailableCardsCount)}
        </span>
        <span className="hidden sm:inline" aria-hidden="true">
          ·
        </span>
        <span>
          {formatNumber(missingCardsCount)} carte{missingCardsCount > 1 ? 's' : ''} à découvrir
        </span>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-label={accessibleLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safePercentage}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${safePercentage}%` }}
        />
      </div>
      {ownProfile && uniqueCardsCount === 0 ? (
        <Button asChild variant="ghost" size="sm" className="mt-3 px-0">
          <Link href="/boosters">Ouvrir un booster</Link>
        </Button>
      ) : null}
    </div>
  );
}

export function ProfileGameSummary({ game }: { game: ProfileGameStats }) {
  const hasRanking = game.currentRank !== null || game.currentRating !== null;
  return (
    <div className="border-t border-border px-4 py-5 sm:px-6">
      <h3 className="text-sm font-semibold text-foreground">Activité de jeu</h3>
      <div className="mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-2">
        {game.gamesPlayed > 0 ? (
          <span>
            {formatNumber(game.gamesPlayed)} partie{game.gamesPlayed > 1 ? 's' : ''} ·{' '}
            {formatNumber(game.winsCount)} victoire{game.winsCount > 1 ? 's' : ''} ·{' '}
            {formatPercentage(game.winRatePercentage)} % de victoire
          </span>
        ) : null}
        {hasRanking ? (
          <span className="font-medium text-foreground">
            {game.currentRank !== null ? `Classement #${formatNumber(game.currentRank)}` : null}
            {game.currentRank !== null && game.currentRating !== null ? ' · ' : null}
            {game.currentRating !== null ? `Cote ${formatNumber(game.currentRating)}` : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function ProfileStatsOverview({
  stats,
  ownProfile,
}: {
  stats: ProfileStats;
  ownProfile: boolean;
}) {
  const collection = stats.collection;
  const items: ProfileStatItemProps[] = [
    ...(collection
      ? [
          {
            label: 'Cartes uniques',
            value: collection.uniqueCardsCount,
            href: '#collection',
            ariaLabel: `Voir la collection, ${collection.uniqueCardsCount} cartes uniques`,
          },
        ]
      : []),
    ...(collection?.totalCopiesCount !== undefined
      ? [
          {
            label: 'Cartes possédées',
            value: collection.totalCopiesCount,
            href: '#collection',
            ariaLabel: `Voir la collection, ${collection.totalCopiesCount} cartes possédées`,
          },
        ]
      : []),
    ...(stats.decks
      ? [
          {
            label: 'Decks',
            value: stats.decks.totalCount,
            ...(ownProfile
              ? { href: '/decks', ariaLabel: `Voir mes ${stats.decks.totalCount} decks` }
              : {}),
          },
        ]
      : []),
    ...(stats.social && stats.visibility.canViewFriendsCount
      ? [
          {
            label: 'Amis',
            value: stats.social.friendsCount,
            ...(ownProfile
              ? {
                  href: '/settings/friends',
                  ariaLabel: `Voir mes ${stats.social.friendsCount} amis`,
                }
              : {}),
          },
        ]
      : []),
  ];
  const canShowProgress =
    collection?.totalAvailableCardsCount !== undefined &&
    collection.missingCardsCount !== undefined &&
    collection.completionPercentage !== undefined;

  return (
    <section
      aria-labelledby="profile-stats-title"
      className="border-y border-border bg-surface"
      data-testid="profile-stats-overview"
    >
      <h2 id="profile-stats-title" className="sr-only">
        Statistiques du profil
      </h2>
      {items.length ? <ProfileStatsBar items={items} /> : null}
      {canShowProgress ? (
        <CollectionProgressOverview
          uniqueCardsCount={collection.uniqueCardsCount}
          totalAvailableCardsCount={collection.totalAvailableCardsCount!}
          missingCardsCount={collection.missingCardsCount!}
          completionPercentage={collection.completionPercentage!}
          ownProfile={ownProfile}
        />
      ) : null}
      {stats.game ? <ProfileGameSummary game={stats.game} /> : null}
    </section>
  );
}

export function ProfileStatsSkeleton() {
  return (
    <section
      className="border-y border-border bg-surface"
      aria-label="Chargement des statistiques du profil"
      aria-busy="true"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className={`${index % 2 ? 'border-l border-border' : ''} ${index >= 2 ? 'border-t border-border sm:border-t-0' : ''} ${index > 0 ? 'sm:border-l sm:border-border' : 'sm:border-l-0'} min-h-16 px-4 py-4 sm:min-h-20 sm:px-6 sm:py-5`}
            data-testid="profile-stat-skeleton"
          >
            <Skeleton className="h-7 w-16" />
            <Skeleton className="mt-2 h-3 w-24 max-w-full" />
          </div>
        ))}
      </div>
      <div className="border-t border-border px-4 py-5 sm:px-6">
        <div className="flex justify-between gap-4">
          <Skeleton className="h-4 w-48 max-w-[70%]" />
          <Skeleton className="h-4 w-10" />
        </div>
        <Skeleton className="mt-3 h-3 w-64 max-w-full" />
        <Skeleton className="mt-4 h-2 w-full rounded-full" />
      </div>
    </section>
  );
}
