import type { Metadata } from 'next';
import { BoosterOpeningRouteView } from '@/components/booster-opening-route-view';

export const metadata: Metadata = { title: 'Ouverture du booster' };

export default async function BoosterOpeningPage({
  params,
  searchParams,
}: {
  params: Promise<{ openingId: string }>;
  searchParams: Promise<{ recap?: string; replay?: string }>;
}) {
  const [{ openingId }, query] = await Promise.all([params, searchParams]);
  const requestedMode = query.recap === '1' ? 'recap' : query.replay === '1' ? 'replay' : undefined;
  return (
    <BoosterOpeningRouteView
      key={`${openingId}:${requestedMode ?? 'default'}`}
      openingId={openingId}
      requestedMode={requestedMode}
    />
  );
}
