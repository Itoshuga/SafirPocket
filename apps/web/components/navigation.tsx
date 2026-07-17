'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthControls } from './auth-controls';
import { Logo } from './logo';

const links = [
  { href: '/cards', label: 'Cartes', short: 'Cartes', icon: '✦' },
  { href: '/collection', label: 'Collection', short: 'Collection', icon: '◆' },
  { href: '/decks', label: 'Decks', short: 'Decks', icon: '▤' },
  { href: '/boosters', label: 'Boosters', short: 'Boosters', icon: '◇' },
  { href: '/play', label: 'Jouer', short: 'Jouer', icon: '⚔' },
];

export function Navigation() {
  const pathname = usePathname();
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/8 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation principale">
            {links.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${active ? 'bg-sapphire-500/15 text-sapphire-200' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <AuthControls />
        </div>
      </header>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 bg-ink-950/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        aria-label="Navigation mobile"
      >
        {links.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${active ? 'text-sapphire-300' : 'text-slate-500'}`}
            >
              <span className="text-lg" aria-hidden="true">
                {link.icon}
              </span>
              {link.short}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
