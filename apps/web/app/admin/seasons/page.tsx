import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@safir/ui';
import { AdminTaxonomyView } from '@/components/admin-taxonomy-view';
export const metadata: Metadata = { title: 'Saisons · Administration' };
export default function Page() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Catalogue"
        title="Saisons"
        description="Organisez les regroupements de cartes sans les confondre avec les saisons classées."
      />
      <AdminTaxonomyView kind="seasons" />
    </PageContainer>
  );
}
