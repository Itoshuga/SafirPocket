import { Gem } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@safir/ui';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2 rounded-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      aria-label="Safir Pocket, accueil"
    >
      <span className="grid size-9 place-items-center rounded-md bg-primary text-white">
        <Gem className="size-5" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <span className={cn('text-base font-semibold tracking-tight', compact && 'sr-only')}>
        Safir Pocket
      </span>
    </Link>
  );
}
