import { Badge, Card, PageContainer } from '@safir/ui';
import Link from 'next/link';

const pillars = [
  {
    icon: '◆',
    title: 'Collection vivante',
    text: 'Explorez les extensions, filtrez les cartes et suivez chaque variante obtenue.',
  },
  {
    icon: '▤',
    title: 'Decks maîtrisés',
    text: 'Composez vos listes à partir de votre inventaire, sans règles inventées.',
  },
  {
    icon: '⚔',
    title: 'Jeu autoritaire',
    text: 'Matchmaking temps réel et état officiel calculé exclusivement par le serveur.',
  },
];

export default function HomePage() {
  return (
    <>
      <section className="gem-grid relative overflow-hidden border-b border-white/8">
        <div className="absolute left-[70%] top-16 size-80 rotate-45 rounded-[4rem] border border-sapphire-300/15 bg-sapphire-500/10 blur-sm" />
        <PageContainer className="relative grid min-h-[38rem] items-center gap-12 py-16 lg:grid-cols-[1.1fr_.9fr] lg:py-24">
          <div>
            <Badge>Fondation technique · Saison zéro</Badge>
            <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[.95] tracking-[-0.045em] text-balance sm:text-6xl lg:text-7xl">
              Votre univers{' '}
              <span className="bg-gradient-to-r from-sapphire-200 via-sapphire-400 to-purple-300 bg-clip-text text-transparent">
                Safir Pocket
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
              Collectionnez vos cartes Safir TCG, construisez vos decks et préparez vos futures
              parties dans une expérience premium pensée pour tous les écrans.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/cards"
                className="inline-flex min-h-11 items-center rounded-xl bg-sapphire-500 px-5 py-2.5 font-semibold text-white shadow-lg shadow-sapphire-900/20 transition hover:bg-sapphire-400"
              >
                Explorer les cartes
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center rounded-xl border border-white/15 px-5 font-semibold transition hover:bg-white/5"
              >
                Créer un compte
              </Link>
            </div>
          </div>
          <div className="relative mx-auto h-[25rem] w-full max-w-md" aria-hidden="true">
            <div className="absolute left-1/2 top-1/2 h-72 w-52 -translate-x-1/2 -translate-y-1/2 rotate-6 rounded-3xl border border-sapphire-200/30 bg-gradient-to-br from-sapphire-400 via-sapphire-700 to-ink-950 p-3 shadow-2xl shadow-sapphire-500/30">
              <div className="gem-grid grid h-full place-items-center rounded-2xl border border-white/15 bg-ink-900/65">
                <div className="grid size-24 rotate-45 place-items-center rounded-3xl border border-white/40 bg-sapphire-400/30">
                  <span className="size-10 rounded-xl border border-white/60" />
                </div>
              </div>
            </div>
            <div className="absolute left-5 top-16 h-64 w-44 -rotate-12 rounded-3xl border border-white/10 bg-gradient-to-b from-purple-800 to-ink-950 opacity-60" />
            <div className="absolute right-3 top-24 h-64 w-44 rotate-[18deg] rounded-3xl border border-white/10 bg-gradient-to-b from-cyan-800 to-ink-950 opacity-50" />
          </div>
        </PageContainer>
      </section>
      <PageContainer className="py-16">
        <div className="grid gap-4 md:grid-cols-3">
          {pillars.map((pillar) => (
            <Card
              key={pillar.title}
              className="group transition hover:-translate-y-1 hover:border-sapphire-300/25"
            >
              <span className="grid size-12 place-items-center rounded-xl bg-sapphire-500/10 text-2xl text-sapphire-300">
                {pillar.icon}
              </span>
              <h2 className="mt-5 text-xl font-bold">{pillar.title}</h2>
              <p className="mt-2 leading-relaxed text-slate-400">{pillar.text}</p>
            </Card>
          ))}
        </div>
      </PageContainer>
    </>
  );
}
