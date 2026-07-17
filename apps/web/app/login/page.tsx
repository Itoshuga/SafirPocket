import type { Metadata } from 'next';
import { LoginForm } from '@/components/login-form';

export const metadata: Metadata = { title: 'Connexion' };

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl place-items-center px-4 py-12">
      <div className="grid w-full overflow-hidden rounded-3xl border border-white/10 bg-ink-900/75 shadow-2xl lg:grid-cols-[1.05fr_.95fr]">
        <section className="gem-grid hidden min-h-[36rem] flex-col justify-end bg-gradient-to-br from-sapphire-900/70 to-purple-950/60 p-10 lg:flex">
          <div className="mb-6 size-20 rotate-45 rounded-2xl border border-sapphire-200/40 bg-gradient-to-br from-sapphire-200 to-sapphire-700 shadow-2xl shadow-sapphire-500/40" />
          <p className="max-w-md text-3xl font-black text-balance">
            Votre collection Safir, partout avec vous.
          </p>
          <p className="mt-3 max-w-md text-sapphire-200/70">
            Retrouvez vos cartes, composez vos decks et rejoignez la file de jeu depuis un seul
            espace.
          </p>
        </section>
        <section className="p-6 sm:p-10 lg:p-12">
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
