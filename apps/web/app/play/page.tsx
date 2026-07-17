import type { Metadata } from 'next';
import { PageContainer } from '@safir/ui';
import { MatchmakingPanel } from '@/components/matchmaking-panel';
import { PageHeading } from '@/components/page-heading';

export const metadata: Metadata = { title: 'Jouer' };
export default function PlayPage() {
  return (
    <PageContainer className="max-w-4xl">
      <PageHeading eyebrow="Temps réel" title="Arène Safir">
        La file locale en mémoire est prête; Redis pourra la remplacer sans changer les contrats
        Socket.IO.
      </PageHeading>
      <MatchmakingPanel />
    </PageContainer>
  );
}
