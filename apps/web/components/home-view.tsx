'use client';

import type {
  BoosterProductSummary,
  CardSummary,
  DeckSummary,
  PaginatedResponse,
  ProfileSummary,
} from '@safir/shared-types';
import { Badge, Button, Card, ErrorState, PageContainer, Skeleton, StatCard } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Boxes, Layers3, PackageOpen, Swords } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from './auth-provider';
import { TcgCard } from './tcg-card';

const capabilities = [
  {
    icon: BookOpen,
    title: 'Catalogue public',
    text: 'Recherchez les cartes publiées par extension, rareté et type.',
    href: '/cards',
  },
  {
    icon: Layers3,
    title: 'Decks vérifiés',
    text: 'Composez vos listes avec les exemplaires réellement possédés.',
    href: '/decks',
  },
  {
    icon: Swords,
    title: 'Jeu autoritaire',
    text: 'La file et l’état de partie restent calculés exclusivement côté serveur.',
    href: '/play',
  },
];

export function HomeView() {
  const { user, loading } = useAuth();
  const summary = useQuery({
    queryKey: queryKeys.profileSummary,
    queryFn: () => apiFetch<ProfileSummary>('/api/v1/me/profile/summary'),
    enabled: Boolean(user),
  });
  const decks = useQuery({
    queryKey: queryKeys.decks,
    queryFn: () => apiFetch<DeckSummary[]>('/api/v1/me/decks'),
    enabled: Boolean(user),
  });
  const boosters = useQuery({
    queryKey: queryKeys.boosterProducts,
    queryFn: () => apiFetch<BoosterProductSummary[]>('/api/v1/booster-products'),
  });
  const cards = useQuery({
    queryKey: queryKeys.cards('home'),
    queryFn: () =>
      apiFetch<PaginatedResponse<CardSummary>>('/api/v1/cards?page=1&pageSize=2&sort=-createdAt'),
  });

  if (loading) {
    return (
      <PageContainer>
        <Skeleton className="h-52 w-full" />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </PageContainer>
    );
  }
  if (!user) {
    return (
      <>
        <section className="border-b border-border bg-surface">
          <PageContainer className="grid items-center gap-10 py-14 md:grid-cols-[1fr_22rem] md:py-20">
            <div>
              <Badge tone="primary">Safir TCG, dans votre poche</Badge>
              <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Une collection claire. Des décisions rapides.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
                Explorez les cartes Safir, organisez vos exemplaires et préparez des decks
                synchronisés avec le serveur.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/cards">Explorer les cartes</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/login">Créer un compte</Link>
                </Button>
              </div>
            </div>
            <div
              className="rounded-lg border border-border bg-background p-4"
              aria-label="Aperçu du catalogue Safir"
            >
              {cards.isLoading ? (
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="aspect-[5/8]" />
                  <Skeleton className="aspect-[5/8]" />
                </div>
              ) : cards.data?.data.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {cards.data.data.map((card) => (
                    <TcgCard key={card.id} card={card} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 flex items-center gap-3 rounded-md border border-border bg-surface p-4">
                    <BookOpen className="size-5 text-primary" />
                    <span className="text-sm font-semibold">
                      Catalogue prêt à accueillir les cartes publiées
                    </span>
                  </div>
                  <div className="rounded-md border border-border bg-surface p-4">
                    <Boxes className="size-5 text-primary" />
                    <span className="mt-3 block text-xs text-muted-foreground">Collection</span>
                  </div>
                  <div className="rounded-md border border-border bg-surface p-4">
                    <Layers3 className="size-5 text-primary" />
                    <span className="mt-3 block text-xs text-muted-foreground">Decks</span>
                  </div>
                </div>
              )}
            </div>
          </PageContainer>
        </section>
        <PageContainer className="py-12">
          <div className="grid gap-4 md:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, text, href }) => (
              <Link href={href} key={title} className="group focus-visible:outline-none">
                <Card className="h-full group-hover:border-border-strong group-focus-visible:ring-2 group-focus-visible:ring-focus-ring">
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <h2 className="mt-4 font-semibold">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                </Card>
              </Link>
            ))}
          </div>
        </PageContainer>
      </>
    );
  }
  return (
    <PageContainer>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-primary">Tableau de bord</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Bonjour</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Voici l’état actuel de votre espace Safir.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/cards">Catalogue</Link>
          </Button>
          <Button asChild>
            <Link href="/play">Jouer</Link>
          </Button>
        </div>
      </div>
      {summary.isError ? (
        <ErrorState message="Les indicateurs du profil ne sont pas disponibles." />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summary.isLoading
          ? Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28" />)
          : null}
        {summary.data ? (
          <>
            <StatCard
              label="Cartes uniques"
              value={summary.data.collection.uniqueCards}
              hint={`${summary.data.collection.completionRate} % du catalogue`}
            />
            <StatCard label="Decks" value={summary.data.deckCount} />
            <StatCard
              label="Parties"
              value={summary.data.matchCount}
              hint={`${summary.data.wins} victoire${summary.data.wins > 1 ? 's' : ''}`}
            />
            <StatCard
              label="Classement"
              value={summary.data.currentRank ? `#${summary.data.currentRank}` : 'Non classé'}
              hint={summary.data.currentRating ? `${summary.data.currentRating} points` : undefined}
            />
          </>
        ) : null}
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Decks récents</h2>
              <p className="mt-1 text-sm text-muted-foreground">Synchronisés avec votre compte.</p>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link href="/decks">Voir tout</Link>
            </Button>
          </div>
          <div className="mt-4 divide-y divide-border">
            {decks.data?.slice(0, 3).map((deck) => (
              <Link
                key={deck.id}
                href={`/decks/${deck.id}`}
                className="flex items-center justify-between py-3 text-sm hover:text-primary"
              >
                <span className="font-medium">{deck.name}</span>
                <span className="text-muted-foreground">{deck.cardCount} cartes</span>
              </Link>
            ))}
            {decks.data?.length === 0 ? (
              <p className="py-5 text-sm text-muted-foreground">Aucun deck créé.</p>
            ) : null}
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Boosters disponibles</h2>
              <p className="mt-1 text-sm text-muted-foreground">Produits actuellement publiés.</p>
            </div>
            <PackageOpen className="size-5 text-primary" />
          </div>
          <div className="mt-4 divide-y divide-border">
            {boosters.data?.slice(0, 3).map((booster) => (
              <Link
                key={booster.id}
                href="/boosters"
                className="flex items-center justify-between py-3 text-sm hover:text-primary"
              >
                <span className="font-medium">{booster.name}</span>
                <span className="text-muted-foreground">{booster.cardsPerPack} cartes</span>
              </Link>
            ))}
            {boosters.data?.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Aucun produit publié.</p>
            ) : null}
          </div>
          <Button asChild className="mt-3" variant="outline" size="sm">
            <Link href="/boosters">Voir les boosters</Link>
          </Button>
        </Card>
      </div>
    </PageContainer>
  );
}
