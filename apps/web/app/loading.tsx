import { PageContainer, Skeleton } from '@safir/ui';

export default function Loading() {
  return (
    <PageContainer>
      <Skeleton className="h-24 max-w-2xl" />
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-48" />
        ))}
      </div>
    </PageContainer>
  );
}
