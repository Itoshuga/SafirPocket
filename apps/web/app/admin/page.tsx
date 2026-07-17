import type { Metadata } from 'next';
import { Badge, Card, PageContainer } from '@safir/ui';
import { PageHeading } from '@/components/page-heading';

export const metadata: Metadata = { title: 'Administration' };
export default function AdminPage() {
  return (
    <PageContainer>
      <PageHeading eyebrow="Accès admin" title="Administration">
        Le proxy vérifie le rôle porté par le jeton et l’API applique une seconde vérification sur
        chaque route administrative.
      </PageHeading>
      <div className="grid gap-4 md:grid-cols-3">
        {['Catalogue & extensions', 'Configuration des boosters', 'Supervision des matchs'].map(
          (title) => (
            <Card key={title}>
              <Badge>Fondation</Badge>
              <h2 className="mt-4 text-lg font-bold">{title}</h2>
              <p className="mt-2 text-sm text-slate-400">
                Interface prête à recevoir les opérations autorisées lors d’une prochaine étape.
              </p>
            </Card>
          ),
        )}
      </div>
    </PageContainer>
  );
}
