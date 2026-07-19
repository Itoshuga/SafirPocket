'use client';

import { cn } from '@safir/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isNavigationItemActive, settingsNavigationItems } from '@/lib/navigation';

export function SettingsNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections des préférences" className="min-w-0 lg:w-52 lg:shrink-0">
      <div className="flex gap-1 overflow-x-auto border-b border-border pb-2 lg:block lg:space-y-1 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5">
        {settingsNavigationItems.map((item) => {
          const Icon = item.icon;
          const active = isNavigationItemActive(pathname, item);
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                active && 'bg-primary-soft text-primary',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
