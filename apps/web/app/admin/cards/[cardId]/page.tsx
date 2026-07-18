import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@safir/ui';
import { AdminCardForm } from '@/components/admin-card-form';
export const metadata: Metadata = { title: 'Modifier une carte · Administration' };
export default async function Page({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  return (
    <PageContainer>
      <PageHeader eyebrow="Catalogue" title="Modifier la carte" />
      <AdminCardForm cardId={cardId} />
    </PageContainer>
  );
}
