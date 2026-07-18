import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@safir/ui';
import { AdminTaxonomyView } from '@/components/admin-taxonomy-view';
export const metadata: Metadata = { title: 'Types · Administration' };
export default function Page() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Catalogue"
        title="Types"
        description="Gérez les types relationnels pouvant être associés à plusieurs cartes."
      />
      <AdminTaxonomyView kind="types" />
    </PageContainer>
  );
}
