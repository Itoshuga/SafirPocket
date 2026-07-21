import { Skeleton } from '@safir/ui';

export interface ProfileStatItem {
  label: string;
  value: number | string;
  hint?: string;
}

export function ProfileStatsBar({
  items,
  loading = false,
}: {
  items: ProfileStatItem[];
  loading?: boolean;
}) {
  return (
    <section aria-labelledby="profile-stats-title">
      <h2 id="profile-stats-title" className="sr-only">
        Statistiques du profil
      </h2>
      <dl className="grid grid-cols-2 border-y border-border bg-surface sm:grid-cols-3 lg:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="min-w-0 border-b border-r border-border p-4 lg:border-b-0"
              >
                <Skeleton className="h-7 w-16" />
                <Skeleton className="mt-2 h-3 w-24" />
              </div>
            ))
          : items.slice(0, 5).map((item) => (
              <div
                key={item.label}
                className="min-w-0 border-b border-r border-border p-4 last:border-r-0 lg:border-b-0"
              >
                <dd className="truncate text-xl font-semibold text-foreground">{item.value}</dd>
                <dt className="mt-1 text-xs font-medium text-muted-foreground">{item.label}</dt>
                {item.hint ? (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{item.hint}</p>
                ) : null}
              </div>
            ))}
      </dl>
    </section>
  );
}
