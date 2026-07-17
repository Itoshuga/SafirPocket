'use client';

import { Button, ErrorState, PageContainer } from '@safir/ui';
import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <PageContainer className="max-w-2xl py-24">
      <ErrorState message="Cette page a rencontré une erreur inattendue." />
      <Button className="mt-4" onClick={reset}>
        Réessayer
      </Button>
    </PageContainer>
  );
}
