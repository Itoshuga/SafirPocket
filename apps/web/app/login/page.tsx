import type { Metadata } from 'next';
import { Badge } from '@safir/ui';
import { BookOpen, Layers3, ShieldCheck } from 'lucide-react';
import { Suspense } from 'react';
import { LoginForm } from '@/components/login-form';

export const metadata: Metadata = { title: 'Connexion' };

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100dvh-3.5rem)] max-w-5xl place-items-center px-4 py-10">
      <div className="grid w-full overflow-hidden rounded-lg border border-border bg-surface shadow-card lg:grid-cols-[1fr_1fr]">
        <section className="hidden border-r border-border bg-primary-soft p-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <Badge tone="primary">Safir Pocket</Badge>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-balance">
              Votre collection, structurée et synchronisée.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
              Un espace unique pour consulter vos cartes, construire vos decks et rejoindre les
              services de jeu.
            </p>
          </div>
          <ul className="space-y-4 text-sm">
            {[
              { icon: BookOpen, label: 'Catalogue public filtrable' },
              { icon: Layers3, label: 'Decks liés à votre inventaire' },
              { icon: ShieldCheck, label: 'Opérations sensibles côté serveur' },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-md bg-surface text-primary">
                  <Icon className="size-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </section>
        <section className="p-6 sm:p-10 lg:p-12">
          <Suspense>
            <LoginForm />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
