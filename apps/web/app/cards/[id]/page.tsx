import { PageContainer } from '@safir/ui';
import { CardDetailView } from '@/components/card-detail-view';

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageContainer>
      <CardDetailView id={id} />
    </PageContainer>
  );
}
