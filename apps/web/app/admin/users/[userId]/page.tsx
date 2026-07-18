import type { Metadata } from 'next';
import { PageContainer } from '@safir/ui';
import { AdminUserDetailView } from '@/components/admin-user-detail-view';

export const metadata: Metadata = { title: 'Gestion utilisateur · Administration' };

export default async function AdminUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return (
    <PageContainer>
      <AdminUserDetailView userId={userId} />
    </PageContainer>
  );
}
