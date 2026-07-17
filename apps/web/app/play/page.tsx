import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@safir/ui';
import { MatchmakingPanel } from '@/components/matchmaking-panel';

export const metadata: Metadata = { title: 'Jouer' };
export default function PlayPage() {
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        eyebrow="Temps réel"
        title="Jouer"
        description="Rejoignez la file de matchmaking avec un deck contrôlé par le serveur. Aucun résultat de partie n’est simulé dans le navigateur."
      />
      <MatchmakingPanel />
    </PageContainer>
  );
}
