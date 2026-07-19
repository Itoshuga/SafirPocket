import type { Metadata } from 'next';
import { PageContainer } from '@safir/ui';
import { ProfileOverview } from '@/components/profile-overview';

export const metadata: Metadata = { title: 'Profil' };

export default function ProfilePage() {
  return (
    <PageContainer className="max-w-6xl">
      <ProfileOverview />
    </PageContainer>
  );
}
