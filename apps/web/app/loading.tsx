import { Spinner } from '@safir/ui';

export default function Loading() {
  return (
    <main className="grid min-h-[60vh] place-items-center text-sapphire-300">
      <Spinner label="Chargement de Safir Pocket" />
    </main>
  );
}
