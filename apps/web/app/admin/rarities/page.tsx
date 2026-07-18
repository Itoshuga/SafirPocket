import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@safir/ui';
import { AdminTaxonomyView } from '@/components/admin-taxonomy-view';
export const metadata: Metadata = { title: 'Raretés · Administration' };
export default function Page() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Catalogue"
        title="Raretés"
        description="Gérez l’ordre, la couleur et la disponibilité des raretés."
      />
      <AdminTaxonomyView kind="rarities" />
    </PageContainer>
  );
}
