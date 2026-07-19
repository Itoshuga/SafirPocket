'use client';

import { Button, Drawer, cn } from '@safir/ui';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  isAdministrationPath,
  isNavigationItemActive,
  mobileNavigationItems,
  playNavigationItem,
  sidebarNavigationItems,
} from '@/lib/navigation';
import { AuthControls } from './auth-controls';
import { useAuth } from './auth-provider';
import { Logo } from './logo';
import { AdministrationNavigationGroup, SidebarNavigationItem } from './sidebar-navigation';

export function Navigation() {
  const pathname = usePathname();
  const { user, role } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [administrationManuallyOpen, setAdministrationManuallyOpen] = useState(false);
  const [closedAdministrationPath, setClosedAdministrationPath] = useState<string | null>(null);
  const administrationActive = isAdministrationPath(pathname);
  const administrationOpen = administrationActive
    ? closedAdministrationPath !== pathname
    : administrationManuallyOpen;

  function handleAdministrationOpenChange(open: boolean) {
    if (administrationActive) {
      setClosedAdministrationPath(open ? null : pathname);
      return;
    }
    setAdministrationManuallyOpen(open);
  }

  function handleMenuOpenChange(open: boolean) {
    setMenuOpen(open);
    if (open && administrationActive) setClosedAdministrationPath(null);
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-surface lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navigation principale">
          <div className="mb-3 border-b border-border pb-3">
            <SidebarNavigationItem item={playNavigationItem} pathname={pathname} prominent />
          </div>
          {sidebarNavigationItems.map((item) => (
            <SidebarNavigationItem key={item.key} item={item} pathname={pathname} />
          ))}
          <AdministrationNavigationGroup
            id="desktop-administration-navigation"
            role={role}
            pathname={pathname}
            open={administrationOpen}
            onOpenChange={handleAdministrationOpenChange}
          />
        </nav>
        <div className="border-t border-border p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            {user ? 'Session synchronisée' : 'Catalogue public'}
          </p>
          <AuthControls />
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur-sm lg:hidden">
        <Logo compact />
        <div className="flex items-center gap-2">
          <Drawer
            open={menuOpen}
            onOpenChange={handleMenuOpenChange}
            title="Navigation"
            description="Accédez à toutes les sections de Safir Pocket."
            trigger={
              <Button variant="ghost" size="icon" aria-label="Ouvrir la navigation">
                <Menu className="size-5" />
              </Button>
            }
          >
            <nav className="grid gap-1" aria-label="Toutes les sections">
              <div className="mb-2 border-b border-border pb-3">
                <SidebarNavigationItem
                  item={playNavigationItem}
                  pathname={pathname}
                  prominent
                  onNavigate={() => setMenuOpen(false)}
                />
              </div>
              {sidebarNavigationItems.map((item) => (
                <SidebarNavigationItem
                  key={item.key}
                  item={item}
                  pathname={pathname}
                  onNavigate={() => setMenuOpen(false)}
                />
              ))}
              <AdministrationNavigationGroup
                id="mobile-administration-navigation"
                role={role}
                pathname={pathname}
                open={administrationOpen}
                onOpenChange={handleAdministrationOpenChange}
                onNavigate={() => setMenuOpen(false)}
              />
            </nav>
          </Drawer>
          <AuthControls />
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Navigation mobile"
      >
        {mobileNavigationItems.map((item) => {
          const Icon = item.icon;
          const active = isNavigationItemActive(pathname, item);
          const prominent = item.key === 'play';
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring',
                (active || prominent) && 'text-primary',
              )}
            >
              <span
                className={cn(
                  'grid size-8 place-items-center rounded-md',
                  prominent && 'bg-primary text-primary-foreground shadow-control',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
