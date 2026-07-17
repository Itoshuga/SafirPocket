import type { Metadata } from 'next';
import { PageContainer } from '@safir/ui';
import { PageHeading } from '@/components/page-heading';
import { ProfileForm } from '@/components/profile-form';

export const metadata: Metadata = { title: 'Profil' };
export default function ProfilePage() {
  return (
    <PageContainer className="max-w-3xl">
      <PageHeading eyebrow="Identité" title="Mon profil">
        Votre rôle et votre identifiant restent protégés côté base et ne sont jamais modifiables
        depuis ce formulaire.
      </PageHeading>
      <ProfileForm />
    </PageContainer>
  );
}
