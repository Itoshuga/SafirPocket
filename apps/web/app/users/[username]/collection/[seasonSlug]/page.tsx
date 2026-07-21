import { PageContainer } from '@safir/ui';
import { SeasonCollectionView } from '@/components/season-collection-view';

export default async function PublicSeasonCollectionPage({
  params,
}: {
  params: Promise<{ username: string; seasonSlug: string }>;
}) {
  const { username, seasonSlug } = await params;
  return (
    <PageContainer className="max-w-7xl">
      <SeasonCollectionView seasonSlug={seasonSlug} username={username} ownProfile={false} />
    </PageContainer>
  );
}
