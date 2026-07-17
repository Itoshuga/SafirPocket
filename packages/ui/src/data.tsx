import type { HTMLAttributes, ReactNode } from 'react';
import { Button, Card } from './primitives.js';
import { cn } from './utils.js';

export function PageContainer({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <main
      className={cn('mx-auto w-full max-w-screen-xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8', className)}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
}) {
  return (
    <header className="mb-7">
      <div className="mb-3">{breadcrumbs}</div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="mb-1 text-xs font-semibold text-primary">{eyebrow}</p> : null}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <div className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)}>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? (
          <div className="mt-1 text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  compact = false,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-border-strong bg-surface p-8 text-center',
        !compact && 'py-12',
      )}
    >
      <div className="mx-auto flex max-w-md flex-col items-center">
        {icon ? (
          <div className="mb-4 grid size-10 place-items-center rounded-md bg-primary-soft text-primary">
            {icon}
          </div>
        ) : null}
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? (
          <div className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</div>
        ) : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}

export function ErrorState({
  title = 'Impossible de charger les données',
  message = 'Réessayez dans quelques instants.',
  action,
}: {
  title?: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className="rounded-lg border border-danger/20 bg-danger/5 p-5">
      <h2 className="text-sm font-semibold text-danger">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
        </div>
        {icon ? <span className="text-primary">{icon}</span> : null}
      </div>
    </Card>
  );
}

export function DataList({
  items,
  className,
}: {
  items: Array<{ label: ReactNode; value: ReactNode }>;
  className?: string;
}) {
  return (
    <dl className={cn('divide-y divide-border', className)}>
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3 text-sm">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="text-right font-medium text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Table({
  children,
  caption,
  className,
}: {
  children: ReactNode;
  caption: string;
  className?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className={cn('w-full border-collapse text-left text-sm', className)}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function MobileList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'divide-y divide-border rounded-lg border border-border bg-surface md:hidden',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  label = 'Pagination',
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  label?: string;
}) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1).filter(
    (candidate) => candidate === 1 || candidate === pageCount || Math.abs(candidate - page) <= 1,
  );
  return (
    <nav aria-label={label} className="mt-6 flex items-center justify-center gap-1">
      <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Précédent
      </Button>
      {pages.map((candidate, index) => (
        <span key={candidate} className="contents">
          {index > 0 && pages[index - 1] !== candidate - 1 ? (
            <span className="px-1 text-muted-foreground" aria-hidden="true">
              …
            </span>
          ) : null}
          <Button
            variant={candidate === page ? 'secondary' : 'ghost'}
            size="sm"
            aria-current={candidate === page ? 'page' : undefined}
            onClick={() => onPageChange(candidate)}
          >
            {candidate}
          </Button>
        </span>
      ))}
      <Button
        variant="ghost"
        size="sm"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Suivant
      </Button>
    </nav>
  );
}

export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Fil d’Ariane">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <a
                href={item.href}
                className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {item.label}
              </a>
            ) : (
              <span aria-current="page" className="text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
