import { PageContainer } from '@safir/ui';
import Link from 'next/link';

export default function NotFound() {
  return (
    <PageContainer className="grid min-h-[70vh] place-items-center text-center">
      <div>
        <p className="text-8xl font-black text-sapphire-500/30">404</p>
        <h1 className="mt-3 text-3xl font-black">Éclat introuvable</h1>
        <p className="mt-2 text-slate-400">Cette page ne fait pas partie de votre collection.</p>
        <Link href="/" className="mt-6 inline-flex rounded-xl bg-sapphire-500 px-5 py-3 font-bold">
          Retour à l’accueil
        </Link>
      </div>
    </PageContainer>
  );
}
