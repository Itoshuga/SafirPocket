'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="grid min-h-screen place-items-center bg-[#f7f8fa] p-6 text-[#172033]">
        <main className="max-w-lg rounded-[14px] border border-[#dfe3eb] bg-white p-8 text-center">
          <p className="text-sm font-semibold text-[#1f5fc4]">Safir Pocket</p>
          <h1 className="mt-3 text-3xl font-semibold">L’application doit être relancée</h1>
          <p className="mt-3 text-sm text-[#647087]">Une erreur globale est survenue.</p>
          <button
            className="mt-6 rounded-[10px] bg-[#1f5fc4] px-5 py-3 text-sm font-semibold text-white"
            onClick={reset}
          >
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
