'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="grid min-h-screen place-items-center bg-[#050713] p-6 text-white">
        <main className="max-w-lg text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-blue-300">Safir Pocket</p>
          <h1 className="mt-3 text-3xl font-black">L’application doit être relancée</h1>
          <p className="mt-3 text-slate-400">Une erreur globale est survenue.</p>
          <button className="mt-6 rounded-xl bg-blue-500 px-5 py-3 font-bold" onClick={reset}>
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
