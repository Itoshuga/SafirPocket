'use client';

import type { PackOpening } from '@safir/shared-types';
import { Button, Dialog, IconButton } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { History, LoaderCircle, PackageOpen, RotateCcw, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { apiFetch } from '@/lib/api-client';
import {
  BOOSTER_ASSET_TIMEOUT_MS,
  BOOSTER_OPENING_CARD_COUNT,
  boosterOpeningReducer,
  consumeFreshOpeningMarker,
  createBoosterOpeningState,
  decideBoosterOpeningEntry,
  normalizePackOpening,
  openingAssetUrls,
  readStoredOpeningProgress,
  removeStoredOpeningProgress,
  writeStoredOpeningProgress,
  type StoredBoosterOpeningProgress,
  type GestureDirection,
} from '@/lib/booster-opening';
import { preloadImages } from '@/lib/preload-images';
import { queryKeys } from '@/lib/query-keys';
import { BoosterOpeningRecap } from './booster-opening-recap';
import { InteractiveBoosterPack } from './interactive-booster-pack';
import { InteractiveOpeningCard } from './interactive-opening-card';

const BoosterStudioCanvas = dynamic(
  () => import('./booster-studio-canvas').then((module) => module.BoosterStudioCanvas),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-background" aria-hidden="true" />,
  },
);

export function BoosterOpeningRouteView({
  openingId,
  requestedMode,
}: {
  openingId: string;
  requestedMode?: 'recap' | 'replay';
}) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [state, dispatch] = useReducer(boosterOpeningReducer, undefined, createBoosterOpeningState);
  const [failedAssets, setFailedAssets] = useState<string[]>([]);
  const entryResolution = useRef<{
    mode: ReturnType<typeof decideBoosterOpeningEntry>;
    storedProgress: StoredBoosterOpeningProgress | null;
  } | null>(null);
  const resultWasDispatched = useRef(false);
  const result = useQuery({
    queryKey: queryKeys.boosterOpening(openingId),
    queryFn: () => apiFetch<PackOpening>(`/api/v1/me/pack-openings/${openingId}`),
    retry: 1,
  });
  const normalized = useMemo(() => {
    if (!result.data) return { opening: null, error: null };
    try {
      return { opening: normalizePackOpening(result.data), error: null };
    } catch (error) {
      return {
        opening: null,
        error: error instanceof Error ? error.message : "Le résultat d'ouverture est invalide.",
      };
    }
  }, [result.data]);
  const opening = normalized.opening;

  useEffect(() => {
    if (state.phase !== 'LOADING_RESULT') return;
    if (result.isError) {
      dispatch({ type: 'FAIL', message: result.error.message });
      return;
    }
    if (normalized.error) {
      dispatch({ type: 'FAIL', message: normalized.error });
      return;
    }
    if (!opening) return;
    if (!entryResolution.current) {
      const storedProgress = requestedMode ? null : readStoredOpeningProgress(openingId);
      const mode = decideBoosterOpeningEntry({
        requestedMode,
        hasFreshMarker: requestedMode ? false : consumeFreshOpeningMarker(openingId),
        storedProgress,
      });
      entryResolution.current = {
        mode,
        storedProgress: mode === 'resume-choice' ? storedProgress : null,
      };
    }
    if (resultWasDispatched.current) return;
    resultWasDispatched.current = true;
    dispatch({
      type: 'RESULT_LOADED',
      mode: entryResolution.current.mode,
      storedProgress: entryResolution.current.storedProgress,
    });
  }, [
    normalized.error,
    opening,
    openingId,
    requestedMode,
    result.error,
    result.isError,
    state.phase,
  ]);

  useEffect(() => {
    if (state.phase !== 'PRELOADING_ASSETS' || !opening) return;
    let active = true;
    void preloadImages(openingAssetUrls(opening), BOOSTER_ASSET_TIMEOUT_MS).then((assets) => {
      if (!active) return;
      setFailedAssets(assets.failed);
      dispatch({ type: 'ASSETS_READY' });
    });
    return () => {
      active = false;
    };
  }, [opening, state.phase]);

  useEffect(() => {
    if (state.phase !== 'PACK_OPENED') return;
    const timer = window.setTimeout(
      () => dispatch({ type: 'SHOW_CARDS' }),
      reducedMotion ? 0 : 320,
    );
    return () => window.clearTimeout(timer);
  }, [reducedMotion, state.phase]);

  useEffect(() => {
    if (state.phase !== 'CARDS_EMERGING') return;
    const timer = window.setTimeout(
      () => dispatch({ type: 'REVEAL_CARD' }),
      reducedMotion ? 0 : 420,
    );
    return () => window.clearTimeout(timer);
  }, [reducedMotion, state.phase]);

  useEffect(() => {
    if (state.phase !== 'TRANSITIONING_CARD') return;
    const timer = window.setTimeout(
      () => dispatch({ type: 'FINISH_CARD_TRANSITION' }),
      reducedMotion ? 0 : 280,
    );
    return () => window.clearTimeout(timer);
  }, [reducedMotion, state.phase]);

  useEffect(() => {
    if (!opening) return;
    if (state.phase === 'CARD_REVEAL') {
      writeStoredOpeningProgress({
        version: 1,
        openingId,
        phase: 'CARD_REVEAL',
        currentCardIndex: state.currentCardIndex,
        revealedSlotPositions: Array.from(
          { length: state.currentCardIndex + 1 },
          (_, index) => index + 1,
        ),
        packWasCut: true,
        updatedAt: new Date().toISOString(),
      });
    } else if (state.phase === 'RECAP' || state.phase === 'COMPLETED') {
      removeStoredOpeningProgress(openingId);
    }
  }, [opening, openingId, state.currentCardIndex, state.phase]);

  const completeCut = useCallback(() => {
    writeStoredOpeningProgress({
      version: 1,
      openingId,
      phase: 'PACK_OPENED',
      currentCardIndex: 0,
      revealedSlotPositions: [],
      packWasCut: true,
      updatedAt: new Date().toISOString(),
    });
    dispatch({ type: 'COMPLETE_CUT' });
  }, [openingId]);

  const advance = useCallback((direction: GestureDirection) => {
    dispatch({ type: 'ADVANCE_CARD', direction });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const interactiveTarget =
        event.target instanceof HTMLElement &&
        Boolean(event.target.closest('button, a, input, select, textarea, [role="dialog"]'));
      if (event.key === 'Escape') {
        if (state.phase !== 'RECAP' && state.phase !== 'COMPLETED') {
          dispatch({ type: 'REQUEST_EXIT' });
        }
        return;
      }
      if (interactiveTarget || state.resumeChoiceOpen || state.exitConfirmationOpen) return;
      if (event.key === 'Enter' && (state.phase === 'READY_TO_CUT' || state.phase === 'CUTTING')) {
        event.preventDefault();
        completeCut();
      } else if (
        state.phase === 'CARD_REVEAL' &&
        (event.key === 'Enter' || event.key === 'ArrowRight' || event.key === 'ArrowLeft')
      ) {
        event.preventDefault();
        advance(event.key === 'ArrowLeft' ? -1 : 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [advance, completeCut, state.exitConfirmationOpen, state.phase, state.resumeChoiceOpen]);

  const retry = () => {
    entryResolution.current = null;
    resultWasDispatched.current = false;
    dispatch({ type: 'RETRY' });
    void result.refetch();
  };

  if (state.phase === 'ERROR') {
    return (
      <OpeningShell reducedMotion={reducedMotion}>
        <div role="alert" className="relative z-10 mx-auto max-w-md text-center">
          <p className="text-lg font-semibold">Ouverture indisponible</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {state.errorMessage ?? 'Impossible de récupérer cette ouverture.'}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" onClick={retry}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Réessayer
            </Button>
            <Button asChild>
              <Link href="/boosters">Retour aux boosters</Link>
            </Button>
          </div>
        </div>
      </OpeningShell>
    );
  }

  if (!opening || state.phase === 'LOADING_RESULT' || state.phase === 'PRELOADING_ASSETS') {
    return (
      <OpeningShell reducedMotion={reducedMotion}>
        <div className="relative z-10 text-center" role="status">
          <LoaderCircle className="mx-auto size-7 animate-spin text-primary motion-reduce:animate-none" />
          <p className="mt-3 text-sm font-medium">
            {state.phase === 'PRELOADING_ASSETS'
              ? "Préparation des visuels d'ouverture"
              : 'Récupération du résultat sécurisé'}
          </p>
        </div>
      </OpeningShell>
    );
  }

  const currentCard = opening.cards[state.currentCardIndex];
  const packVisible = ['READY_TO_CUT', 'CUTTING', 'PACK_OPENED'].includes(state.phase);
  const cardVisible = ['CARD_REVEAL', 'TRANSITIONING_CARD'].includes(state.phase);
  const boosterImage =
    opening.booster.imageUrl && !failedAssets.includes(opening.booster.imageUrl)
      ? opening.booster.imageUrl
      : null;

  return (
    <OpeningShell reducedMotion={reducedMotion}>
      <header className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-primary">{opening.booster.season.name}</p>
          <h1 className="truncate text-lg font-semibold sm:text-xl">{opening.booster.name}</h1>
        </div>
        <div className="flex shrink-0 gap-1">
          <IconButton asChild label="Historique" variant="ghost" size="sm">
            <Link href="/boosters/history">
              <History className="size-4" aria-hidden="true" />
            </Link>
          </IconButton>
          <IconButton
            label="Quitter l'ouverture"
            variant="ghost"
            size="sm"
            onClick={() =>
              state.phase === 'RECAP' || state.phase === 'COMPLETED'
                ? router.push('/boosters')
                : dispatch({ type: 'REQUEST_EXIT' })
            }
          >
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      </header>

      <OpeningProgress currentIndex={state.currentCardIndex} packVisible={packVisible} />

      <section className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 pb-24 pt-28 sm:pb-20">
        {packVisible ? (
          <InteractiveBoosterPack
            imageUrl={boosterImage}
            name={opening.booster.name}
            cutProgress={state.cutProgress}
            opened={state.phase === 'PACK_OPENED'}
            disabled={state.phase === 'PACK_OPENED' || state.resumeChoiceOpen}
            reducedMotion={reducedMotion}
            onCutStart={() => dispatch({ type: 'START_CUT' })}
            onCutProgress={(progress) => dispatch({ type: 'UPDATE_CUT', progress })}
            onCutCancel={() => dispatch({ type: 'RESET_CUT' })}
            onCutComplete={completeCut}
          />
        ) : state.phase === 'CARDS_EMERGING' ? (
          <EmergingCardStack reducedMotion={reducedMotion} />
        ) : cardVisible && currentCard ? (
          <InteractiveOpeningCard
            item={currentCard}
            index={state.currentCardIndex}
            transitioning={state.phase === 'TRANSITIONING_CARD'}
            transitionDirection={state.transitionDirection}
            reducedMotion={reducedMotion}
            onAdvance={advance}
          />
        ) : state.phase === 'COMPLETED' ? (
          <div className="text-center">
            <p className="text-xl font-semibold">Les huit cartes sont dans votre collection</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => dispatch({ type: 'REOPEN_RECAP' })}>
                <History className="size-4" aria-hidden="true" />
                Afficher le récapitulatif
              </Button>
              <Button asChild>
                <Link href="/boosters">
                  <PackageOpen className="size-4" aria-hidden="true" />
                  Ouvrir un autre booster
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <p className="sr-only" aria-live="polite">
        {cardVisible && currentCard
          ? `Carte ${state.currentCardIndex + 1} sur 8 : ${currentCard.card.name}`
          : state.phase === 'RECAP'
            ? 'Les huit cartes ont été révélées.'
            : ''}
      </p>

      <Dialog
        open={state.resumeChoiceOpen}
        onOpenChange={(open) => {
          if (!open) dispatch({ type: 'CHOOSE_RESUME' });
        }}
        title="Reprendre cette ouverture ?"
        description="Vous avez déjà commencé à découvrir les cartes de ce booster."
        footer={
          <>
            <Button variant="outline" onClick={() => dispatch({ type: 'SHOW_RECAP' })}>
              Voir le récapitulatif
            </Button>
            <Button onClick={() => dispatch({ type: 'CHOOSE_RESUME' })}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Continuer l&apos;ouverture
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Aucun nouveau débit ni tirage ne sera effectué.
        </p>
      </Dialog>

      <Dialog
        open={state.exitConfirmationOpen}
        onOpenChange={(open) => !open && dispatch({ type: 'CANCEL_EXIT' })}
        title="Quitter la séquence ?"
        description="Les cartes sont déjà sauvegardées dans votre collection."
        footer={
          <>
            <Button variant="ghost" onClick={() => dispatch({ type: 'CANCEL_EXIT' })}>
              Continuer l&apos;ouverture
            </Button>
            <Button onClick={() => dispatch({ type: 'SHOW_RECAP' })}>Voir le récapitulatif</Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Le récapitulatif permet de vérifier immédiatement les huit cartes obtenues.
        </p>
      </Dialog>

      <BoosterOpeningRecap
        opening={opening}
        open={state.phase === 'RECAP'}
        onOpenChange={(open) => !open && dispatch({ type: 'CLOSE_RECAP' })}
      />
    </OpeningShell>
  );
}

function OpeningShell({
  reducedMotion,
  children,
}: {
  reducedMotion: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="fixed inset-0 z-[45] flex min-h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <BoosterStudioCanvas reducedMotion={reducedMotion} />
      {children}
    </main>
  );
}

function OpeningProgress({
  currentIndex,
  packVisible,
}: {
  currentIndex: number;
  packVisible: boolean;
}) {
  return (
    <div
      className="absolute left-1/2 top-[4.75rem] z-20 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-1.5"
      aria-label={packVisible ? 'Booster fermé' : `Carte ${currentIndex + 1} sur 8`}
    >
      {Array.from({ length: BOOSTER_OPENING_CARD_COUNT }, (_, index) => (
        <span
          key={index}
          className={`h-1.5 flex-1 rounded-sm ${!packVisible && index <= currentIndex ? 'bg-primary' : 'bg-border-strong'}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function EmergingCardStack({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div
      className="relative h-[25rem] w-[min(64vw,18rem)]"
      role="status"
      aria-label="Les cartes sortent du booster"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="absolute inset-0 rounded-md border border-border-strong bg-surface-muted shadow-card transition duration-300 motion-reduce:transition-none"
          style={{
            transform: reducedMotion
              ? `translateY(${index * 5}px)`
              : `translate3d(${(index - 1.5) * 5}px, ${24 - index * 7}px, ${index * 2}px) rotate(${(index - 1.5) * 1.5}deg)`,
          }}
        />
      ))}
    </div>
  );
}
