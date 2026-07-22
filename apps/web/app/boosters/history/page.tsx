import type { Metadata } from 'next';
import { Button, PageContainer, PageHeader } from '@safir/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { BoosterOpeningHistory } from '@/components/booster-opening-history';

export const metadata: Metadata = { title: "Historique d'ouverture" };

export default function BoosterHistoryPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Collection"
        title="Historique des ouvertures"
        description="Consultez un résultat ou rejouez sa séquence visuelle sans effectuer un nouveau tirage."
        actions={
          <Button asChild variant="outline">
            <Link href="/boosters">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Boosters
            </Link>
          </Button>
        }
      />
      <BoosterOpeningHistory />
    </PageContainer>
  );
}
