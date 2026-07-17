import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Navigation } from '@/components/navigation';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Safir Pocket', template: '%s · Safir Pocket' },
  description: 'Collectionnez, construisez et préparez vos parties de Safir TCG.',
};

export const viewport: Viewport = {
  themeColor: '#050713',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr">
      <body className="pb-20 antialiased md:pb-0">
        <Providers>
          <Navigation />
          {children}
        </Providers>
      </body>
    </html>
  );
}
