import { PageContainer } from '@safir/ui';
import { DeckDetailView } from '@/components/deck-detail-view';

export default async function DeckDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageContainer>
      <DeckDetailView id={id} />
    </PageContainer>
  );
}
