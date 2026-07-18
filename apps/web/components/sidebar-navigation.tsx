'use client';

import type { AppRole } from '@safir/shared-types';
import { cn } from '@safir/ui';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import {
  adminNavigationGroup,
  getVisibleAdminNavigationItems,
  isAdministrationPath,
  isNavigationItemActive,
  type NavigationItem,
} from '@/lib/navigation';

export function SidebarNavigationItem({
  item,
  pathname,
  nested = false,
  onNavigate,
  tabIndex,
}: {
  item: NavigationItem;
  pathname: string;
  nested?: boolean;
  onNavigate?: () => void;
  tabIndex?: number;
}) {
  const Icon = item.icon;
  const active = isNavigationItemActive(pathname, item);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      tabIndex={tabIndex}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center rounded-md font-medium text-muted-foreground transition-colors duration-150 hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-reduce:transition-none',
        nested ? 'min-h-9 gap-2.5 px-2.5 text-[13px]' : 'min-h-10 gap-3 px-3 text-sm',
        active && 'bg-primary-soft text-primary',
      )}
    >
      <Icon className={nested ? 'size-4' : 'size-4.5'} aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}

export function AdministrationNavigationGroup({
  id,
  role,
  pathname,
  open,
  onOpenChange,
  onNavigate,
}: {
  id: string;
  role: AppRole;
  pathname: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: () => void;
}) {
  const items = getVisibleAdminNavigationItems(role);
  if (items.length === 0) return null;

  const GroupIcon = adminNavigationGroup.icon;
  const active = isAdministrationPath(pathname);
  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => onOpenChange(!open)}
        className={cn(
          'flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-semibold text-muted-foreground transition-colors duration-150 hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-reduce:transition-none',
          active && 'text-primary',
        )}
      >
        <GroupIcon className="size-4.5" aria-hidden="true" />
        <span>{adminNavigationGroup.label}</span>
        <ChevronDown
          className={cn(
            'ml-auto size-4 transition-transform duration-150 motion-reduce:transition-none',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      <div
        id={id}
        aria-hidden={!open}
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-150 motion-reduce:transition-none',
          open ? 'grid-rows-[1fr] opacity-100' : 'invisible grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
            {items.map((item) => (
              <SidebarNavigationItem
                key={item.key}
                item={item}
                pathname={pathname}
                nested
                onNavigate={onNavigate}
                tabIndex={open ? undefined : -1}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
