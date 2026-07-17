# Safir Pocket

Safir Pocket est la fondation web de collection pour Safir TCG : catalogue de cartes, collection, decks, boosters transactionnels et architecture temps réel pour les futurs matchs. Cette étape ne prétend définir aucune règle officielle du jeu. Le moteur partagé contient uniquement un scénario technique minimal, explicitement versionné.

## Stack

- Monorepo pnpm 11 + Turborepo, Node.js 24 LTS, TypeScript strict
- Next.js 16, React 19, App Router, Tailwind CSS 4, TanStack Query, Zustand
- Radix UI, Lucide, class-variance-authority, React Hook Form et Zod
- NestJS 11, REST, Socket.IO, Helmet, CORS strict, rate limiting, Pino
- Supabase Auth, PostgreSQL, Storage, migrations SQL et RLS
- Prisma 7 comme client typé, avec l’adaptateur PostgreSQL
- Redis 8 préparé via Docker Compose; file mémoire par défaut en local
- Vitest, tests HTTP et Playwright

## Architecture

```text
apps/
  web/                 application Next.js mobile-first
  api/                 API NestJS et gateway /match
packages/
  ui/                  composants accessibles partagés
  shared-types/        contrats REST et Socket.IO
  validation/          schémas Zod des entrées externes
  game-engine/         transitions pures et registre d’effets
  config/              validation typée de l’environnement API
  eslint-config/       conventions lint réutilisables
  typescript-config/   configurations strictes
supabase/
  migrations/          unique historique de schéma
  seed.sql             données fictives locales uniquement
prisma/schema.prisma   reflet typé des tables applicatives
```

Le frontend n’accède directement qu’aux données autorisées par RLS. Les opérations sensibles passent par l’API, qui vérifie le JWT Supabase par JWKS et dérive l’utilisateur du claim `sub`. L’ouverture d’un booster débite le portefeuille, écrit l’audit, tire les cartes côté serveur, crée l’historique et met à jour la collection dans une transaction PostgreSQL sérialisable.

## Prérequis macOS

1. Installer [Homebrew](https://brew.sh/) si nécessaire.
2. Installer `nvm`, puis exécuter `nvm install && nvm use` dans le dépôt. `.nvmrc` sélectionne Node 24 LTS.
3. Activer pnpm avec `corepack enable` puis `corepack prepare pnpm@11.12.0 --activate`.
4. Installer et démarrer Docker Desktop. Supabase local et Redis en dépendent.

## Installation

```bash
pnpm install
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
pnpm prisma:generate
```

Les fichiers `.env*` réels sont ignorés par Git. Ne placez jamais une clé service role ou une URL PostgreSQL dans `apps/web`.

Pour tester depuis un autre appareil du réseau local, ajoutez son origine frontend à
`WEB_ORIGINS` sous forme de liste séparée par des virgules, par exemple
`WEB_ORIGINS=http://192.168.1.191:3000`. Le client web remplace automatiquement le nom d’hôte
`localhost` de `NEXT_PUBLIC_API_URL` par celui utilisé dans le navigateur.

## Supabase local

Le CLI est installé comme dépendance de développement. Démarrez la stack :

```bash
pnpm db:start
pnpm db:status
```

`supabase start` applique les migrations et le seed fictif à la base locale neuve. Recopiez les valeurs affichées sans les publier :

- API URL → `SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_URL`
- anon key → `SUPABASE_ANON_KEY` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- service_role key → `SUPABASE_SERVICE_ROLE_KEY`, API uniquement
- PostgreSQL local → `DATABASE_URL` et `DIRECT_URL` (en local, typiquement le port 54322)

La clé `anon` est publique par conception et limitée par RLS. La clé `service_role` contourne RLS : elle doit rester exclusivement côté serveur.

Commandes de données :

```bash
pnpm db:migration:new nom_additif
pnpm db:migrations:list
pnpm db:types
pnpm prisma:generate
pnpm db:stop
```

Le script `db:types` écrit les types Supabase locaux dans `packages/shared-types/src/database.generated.ts`. Générez-les uniquement lorsque la stack locale tourne.

### Convention de migration obligatoire

Les fichiers SQL de `supabase/migrations` constituent l’unique source de vérité. Prisma sert uniquement à générer un client, interroger PostgreSQL et gérer des transactions. **N’exécutez jamais** `prisma migrate dev` ou `prisma migrate deploy`. Après une migration Supabase, mettez prudemment à jour `prisma/schema.prisma`, lancez `pnpm prisma:generate`, `pnpm typecheck`, les tests et le build. `prisma db pull` n’est acceptable qu’après inspection et sauvegarde des personnalisations du schéma.

## Projet Supabase distant

Créez un projet depuis le tableau de bord Supabase, puis renseignez localement :

```dotenv
SUPABASE_PROJECT_REF=...
SUPABASE_ACCESS_TOKEN=...
DATABASE_URL=postgresql://...       # endpoint poolé pour l’API
DIRECT_URL=postgresql://...         # endpoint direct pour les outils
```

Avant tout push distant : vérifiez la référence cible sans afficher de secrets, l’authentification CLI, les URLs et l’historique distant. Procédure non destructive :

```bash
pnpm exec supabase link --project-ref "$SUPABASE_PROJECT_REF"
pnpm db:migrations:list
pnpm db:push
pnpm exec supabase migration list
pnpm db:types
pnpm prisma:generate
pnpm typecheck && pnpm test && pnpm build
```

N’appliquez jamais automatiquement `supabase/seed.sql` à une base distante existante. La CI ne lie aucun projet et ne déploie aucune migration.

## Redis

Redis est facultatif pour démarrer : la file de matchmaking locale utilise `InMemoryMatchmakingQueue` derrière une interface remplaçable. Pour préparer Redis :

```bash
pnpm redis:start
pnpm redis:stop
```

La valeur locale par défaut est `REDIS_URL=redis://localhost:6379`.

## Démarrage

Avec Supabase local configuré :

```bash
pnpm dev
```

Ou séparément :

```bash
pnpm dev:web   # http://localhost:3000
pnpm dev:api   # http://localhost:3001, santé sur /health
```

L’API valide toutes ses variables au démarrage et cite uniquement les noms invalides. Elle refuse de démarrer si une URL, une clé ou une connexion obligatoire manque.

## Authentification

`/login` prend en charge inscription, connexion et récupération de mot de passe par e-mail. `/auth/callback` échange le code PKCE. `proxy.ts` rafraîchit la session et protège les pages privées; `/admin` exige le rôle `admin`. L’API protège toutes les routes par défaut et marque explicitement les routes publiques. Le SDK Supabase gère la persistance de session; aucun code applicatif ne recopie le JWT manuellement dans `localStorage`.

L’architecture Supabase accepte un futur provider Google OAuth, mais aucun bouton inactif n’est affiché tant que le provider et ses URLs de redirection ne sont pas configurés.

## Interface et design system

L’application utilise exclusivement un thème clair, y compris lorsque le système est en mode sombre. Les tokens sémantiques Tailwind vivent dans `apps/web/app/globals.css`; les primitives accessibles sont regroupées dans `packages/ui`. Les composants métier (`TcgCard`, construction de deck, catalogue, booster) restent dans `apps/web/components` et composent ces primitives.

- Navigation latérale sur bureau, en-tête et navigation basse sur mobile.
- Rayons limités à `sm`, `md` et `lg`, ombres légères et accent saphir unique.
- Filtres de catalogue et de collection synchronisés avec l’URL et exécutés par l’API.
- `next/image` conserve le ratio des cartes; la route `/artwork/card/*` relaie Storage avec la clé anon publique et laisse les policies RLS contrôler la lecture.
- `prefers-reduced-motion` est respecté; le profil permet aussi une préférence locale de réduction des animations.

Voir [docs/design-system.md](docs/design-system.md) pour les conventions complètes.

## Routes et endpoints applicatifs

Pages publiques : `/`, `/login`, `/cards`, `/cards/[id]`, `/rankings`. Pages authentifiées : `/collection`, `/decks`, `/decks/new`, `/decks/[id]`, `/boosters`, `/play`, `/profile`. `/admin` est réservé au rôle `admin` côté proxy et côté API.

Les endpoints ajoutés pour la refonte sont notamment :

- `GET /api/v1/card-facets` pour les filtres du catalogue ;
- `GET /api/v1/me/collection` paginé et filtrable, plus `/summary` et `/card/:cardId` ;
- `GET /api/v1/me/profile/summary` pour le tableau de bord et le profil ;
- `GET /api/v1/rankings` et `GET /api/v1/me/ranking` ;
- `GET /api/v1/me/wallets` et `GET /api/v1/me/booster-openings` ;
- `GET /api/v1/admin/overview` pour les compteurs autorisés.

Les erreurs API restent enveloppées sous `{ error: ... }` et exposent `code`, `message`, `details`, `fieldErrors` et `requestId` lorsque disponibles. `ApiClientError` conserve ces informations afin que les formulaires puissent rattacher les erreurs aux champs.

## Sécurité et données

- RLS est actif sur toutes les tables, y compris le catalogue afin de masquer les brouillons.
- Les clients ne peuvent pas écrire `user_cards`, `wallets`, `currency_transactions`, tirages ou résultats de match.
- Les probabilités de boosters sont invisibles aux clients; le tirage utilise `crypto.randomInt` côté serveur.
- Les transactions monétaires sont immuables et toutes les ouvertures utilisent un UUID d’idempotence.
- Les effets stockés sont des identifiants et paramètres JSON validés. Aucun JavaScript en base n’est exécuté.
- Les uploads sont bornés par bucket, MIME, taille et propriétaire. L’API devra aussi inspecter le contenu réel avant les futurs endpoints d’upload.
- Les logs expurgent Authorization, cookies, mots de passe et tokens, et chaque réponse HTTP porte un identifiant de requête.

Voir [docs/security.md](docs/security.md) et [AGENTS.md](AGENTS.md).

## Qualité et tests

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Les tests couvrent notamment santé, JWT invalide, catalogue public, refus d’une collection anonyme, ownership et réservations des decks, agrégats de collection, classement, idempotence/rollback booster, file Socket.IO et transitions/rejets du moteur. Playwright vérifie l’accueil, la navigation, le catalogue, les filtres, le détail, le classement, la validation de connexion, les gardes de routes et les largeurs 375/430/768/1024/1280/1440. Les tests unitaires ne nécessitent aucune base distante.

## Dépannage

- **Variables API invalides** : comparez `apps/api/.env` à son exemple; le message ne révèle aucune valeur.
- **Prisma Client absent** : renseignez au moins `DIRECT_URL` puis lancez `pnpm prisma:generate`.
- **API incapable de joindre PostgreSQL** : vérifiez `pnpm db:status`, le port 54322 et `DATABASE_URL`.
- **Docker indisponible** : démarrez Docker Desktop avant Supabase/Redis.
- **Session en boucle** : vérifiez `site_url`, l’URL `/auth/callback` et les deux variables publiques Supabase.
- **CORS Socket.IO/REST** : `WEB_ORIGIN` définit l’origine principale et `WEB_ORIGINS` les origines supplémentaires autorisées, séparées par des virgules.
- **Types après migration** : ne lancez pas Prisma Migrate; actualisez le reflet Prisma, générez le client et relancez les vérifications.
