import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@safir/ui';
import { AdminBoosterForm } from '@/components/admin-booster-form';

export const metadata: Metadata = { title: 'Nouveau booster · Administration' };

export default function Page() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Boosters"
        title="Nouveau booster"
        description="Associez un design à une saison et répartissez les deux tirages premium."
      />
      <AdminBoosterForm />
    </PageContainer>
  );
}
