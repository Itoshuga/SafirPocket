import { PageContainer, PageHeader } from '@safir/ui';
import type { ReactNode } from 'react';

export function CardsPageLayout({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PageContainer>
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />
      {children}
    </PageContainer>
  );
}
