import { Button, PageContainer } from '@safir/ui';
import { FileQuestion } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <PageContainer className="grid min-h-[70vh] place-items-center text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-12 place-items-center rounded-md bg-primary-soft text-primary">
          <FileQuestion className="size-6" />
        </span>
        <p className="mt-5 text-sm font-semibold text-primary">Erreur 404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Page introuvable</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Cette adresse ne correspond à aucune page disponible de Safir Pocket.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Retour à l’accueil</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
