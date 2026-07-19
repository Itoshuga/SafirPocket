import { PageContainer } from '@safir/ui';
import { PublicProfileView } from '@/components/public-profile-view';

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return (
    <PageContainer className="max-w-6xl">
      <PublicProfileView username={username} />
    </PageContainer>
  );
}
