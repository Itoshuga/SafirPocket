import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@safir/ui';
import { AdminBoosterForm } from '@/components/admin-booster-form';

export const metadata: Metadata = { title: 'Modifier le booster · Administration' };

export default async function Page({ params }: { params: Promise<{ boosterId: string }> }) {
  const { boosterId } = await params;
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Boosters"
        title="Modifier le booster"
        description="Les changements de configuration et de taux sont validés et audités côté serveur."
      />
      <AdminBoosterForm boosterId={boosterId} />
    </PageContainer>
  );
}
