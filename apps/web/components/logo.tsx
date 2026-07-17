import Link from 'next/link';

export function Logo() {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-2.5"
      aria-label="Safir Pocket, accueil"
    >
      <span className="relative grid size-9 rotate-45 place-items-center rounded-[10px] border border-sapphire-300/50 bg-gradient-to-br from-sapphire-300 via-sapphire-500 to-sapphire-900 shadow-lg shadow-sapphire-500/20">
        <span className="size-3 rounded-sm border border-white/70 bg-white/20" />
      </span>
      <span className="ml-1 text-lg font-black tracking-tight">
        Safir <span className="text-sapphire-300">Pocket</span>
      </span>
    </Link>
  );
}
