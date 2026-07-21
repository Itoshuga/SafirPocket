import type { Metadata } from 'next';
import { PageContainer } from '@safir/ui';
import { SeasonCollectionView } from '@/components/season-collection-view';

export const metadata: Metadata = { title: 'Collection par saison' };

export default async function ProfileSeasonCollectionPage({
  params,
}: {
  params: Promise<{ seasonSlug: string }>;
}) {
  const { seasonSlug } = await params;
  return (
    <PageContainer className="max-w-7xl">
      <SeasonCollectionView seasonSlug={seasonSlug} username="me" ownProfile />
    </PageContainer>
  );
}
