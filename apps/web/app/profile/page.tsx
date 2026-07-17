import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@safir/ui';
import { ProfileForm } from '@/components/profile-form';

export const metadata: Metadata = { title: 'Profil' };
export default function ProfilePage() {
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        eyebrow="Compte"
        title="Mon profil"
        description="Gérez votre identité publique et consultez les statistiques confirmées par le serveur. Le rôle du compte reste en lecture seule."
      />
      <ProfileForm />
    </PageContainer>
  );
}
