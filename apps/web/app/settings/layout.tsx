import type { ReactNode } from 'react';
import { PageContainer, PageHeader } from '@safir/ui';
import { SettingsNavigation } from '@/components/settings-navigation';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <PageContainer className="max-w-6xl">
      <PageHeader
        eyebrow="Espace personnel"
        title="Préférences"
        description="Gérez votre profil, votre confidentialité et la sécurité de votre compte."
      />
      <div className="grid min-w-0 gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
        <SettingsNavigation />
        <div className="min-w-0">{children}</div>
      </div>
    </PageContainer>
  );
}
