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
  themeColor: '#f7f8fa',
  colorScheme: 'light',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr" data-scroll-behavior="smooth">
      <body className="pb-20 antialiased lg:pb-0 lg:pl-64">
        <Providers>
          <Navigation />
          {children}
        </Providers>
      </body>
    </html>
  );
}
