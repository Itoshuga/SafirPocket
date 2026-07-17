'use client';

import { Button, Drawer, cn } from '@safir/ui';
import {
  BookOpen,
  Boxes,
  ChartNoAxesColumnIncreasing,
  CircleUserRound,
  Gem,
  House,
  Layers3,
  Menu,
  PackageOpen,
  ShieldCheck,
  Swords,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { AuthControls } from './auth-controls';
import { useAuth } from './auth-provider';
import { Logo } from './logo';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  private?: boolean;
  admin?: boolean;
}

const items: NavItem[] = [
  { href: '/', label: 'Accueil', icon: House },
  { href: '/cards', label: 'Cartes', icon: BookOpen },
  { href: '/collection', label: 'Collection', icon: Boxes, private: true },
  { href: '/decks', label: 'Decks', icon: Layers3, private: true },
  { href: '/boosters', label: 'Boosters', icon: PackageOpen, private: true },
  { href: '/play', label: 'Jouer', icon: Swords, private: true },
  { href: '/rankings', label: 'Classement', icon: ChartNoAxesColumnIncreasing },
  { href: '/profile', label: 'Profil', icon: CircleUserRound, private: true },
  { href: '/admin', label: 'Administration', icon: ShieldCheck, admin: true },
];

const mobilePrimary = ['/cards', '/collection', '/decks', '/boosters'];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-reduce:transition-none',
        active && 'bg-primary-soft text-primary',
      )}
    >
      <Icon className="size-4.5" aria-hidden="true" />
      {item.label}
    </Link>
  );
}

export function Navigation() {
  const pathname = usePathname();
  const { user, role } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleItems = items.filter((item) => !item.admin || role === 'admin');
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-surface lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navigation principale">
          {visibleItems.map((item) => (
            <NavigationLink key={item.href} item={item} pathname={pathname} />
          ))}
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
          <AuthControls />
          <Drawer
            open={menuOpen}
            onOpenChange={setMenuOpen}
            title="Navigation"
            description="Accédez à toutes les sections de Safir Pocket."
            trigger={
              <Button variant="ghost" size="icon" aria-label="Ouvrir la navigation">
                <Menu className="size-5" />
              </Button>
            }
          >
            <nav className="grid gap-1" aria-label="Toutes les sections">
              {visibleItems.map((item) => (
                <NavigationLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onNavigate={() => setMenuOpen(false)}
                />
              ))}
            </nav>
          </Drawer>
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Navigation mobile"
      >
        {items
          .filter((item) => mobilePrimary.includes(item.href))
          .map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring',
                  active && 'text-primary',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
        >
          {menuOpen ? <X className="size-5" /> : <Gem className="size-5" />}
          Plus
        </button>
      </nav>
    </>
  );
}
