import { Skeleton } from '@safir/ui';

export interface ProfileSocialStatItem {
  label: string;
  value: number | string;
}

export function ProfileSocialStats({
  items,
  completion,
  loading = false,
}: {
  items: ProfileSocialStatItem[];
  completion?: number;
  loading?: boolean;
}) {
  return (
    <section aria-labelledby="profile-social-stats-title" className="border-b border-border py-5">
      <h2 id="profile-social-stats-title" className="sr-only">
        Statistiques du profil
      </h2>
      <dl className="grid grid-cols-2 gap-y-5 sm:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="px-4 first:pl-0">
                <Skeleton className="h-7 w-14" />
                <Skeleton className="mt-2 h-3 w-24" />
              </div>
            ))
          : items.slice(0, 5).map((item) => (
              <div
                key={item.label}
                className="min-w-0 border-r border-border px-4 first:pl-0 last:border-r-0"
              >
                <dd className="text-xl font-semibold text-foreground">{item.value}</dd>
                <dt className="mt-1 text-xs font-medium text-muted-foreground">{item.label}</dt>
              </div>
            ))}
      </dl>
      {completion !== undefined ? (
        <div className="mt-5 max-w-xl">
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="font-medium text-foreground">Collection complétée</span>
            <span className="text-muted-foreground">{completion} %</span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
            role="progressbar"
            aria-label="Progression globale de la collection"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completion}
          >
            <div className="h-full bg-primary" style={{ width: `${completion}%` }} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
